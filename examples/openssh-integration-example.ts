// examples/openssh-integration-example.ts
// Comprehensive examples demonstrating OpenSSH workflows with TypeScript.
// Features:
// 1) Basic SSH connection
// 2) Key-based authentication
// 3) Remote command execution
// 4) File transfer (SCP/SFTP)
// 5) Port forwarding (local -> remote)
// 6) Integration with A2A agents
// Includes robust error handling, timeouts, and cleanup.

/*
Prerequisites:
- Node.js 18+
- Install dependencies:
  npm i -D typescript ts-node
  npm i ssh2 ssh2-sftp-client node-ssh scp2
- Ensure OpenSSH server is reachable and you have credentials.

Environment variables used (examples):
  SSH_HOST=example.com
  SSH_PORT=22
  SSH_USERNAME=ubuntu
  SSH_PASSWORD=...            # for password example
  SSH_PRIVATE_KEY=~/.ssh/id_rsa
  SSH_PASSPHRASE=...          # if your key is encrypted
  REMOTE_CMD="uname -a"
  LOCAL_FILE=./README.md
  REMOTE_PATH=/tmp/readme.copy.md
  FORWARD_LOCAL_PORT=7000
  FORWARD_REMOTE_HOST=127.0.0.1
  FORWARD_REMOTE_PORT=80
*/

import { Client, ConnectConfig } from 'ssh2';
import SftpClient from 'ssh2-sftp-client';
import { NodeSSH } from 'node-ssh';
import { Client as ScpClient } from 'scp2';

// If this repository exposes A2A agents, we demonstrate a minimal integration stub.
// Replace with actual imports from the A2A project when available.
// For example (hypothetical):
// import { Agent, Task } from '../src';

// Utility: promisified delay
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Utility: with timeout wrapper
async function withTimeout<T>(p: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t) clearTimeout(t);
  }
}

// Gather config from env with sensible defaults
const cfg = {
  host: process.env.SSH_HOST || '127.0.0.1',
  port: Number(process.env.SSH_PORT || '22'),
  username: process.env.SSH_USERNAME || 'user',
  password: process.env.SSH_PASSWORD, // optional
  privateKey: process.env.SSH_PRIVATE_KEY, // path or key contents
  passphrase: process.env.SSH_PASSPHRASE,
  remoteCmd: process.env.REMOTE_CMD || 'echo "hello from remote"',
  localFile: process.env.LOCAL_FILE || './package.json',
  remotePath: process.env.REMOTE_PATH || '/tmp/uploaded-package.json',
  fwdLocalPort: Number(process.env.FORWARD_LOCAL_PORT || '7000'),
  fwdRemoteHost: process.env.FORWARD_REMOTE_HOST || '127.0.0.1',
  fwdRemotePort: Number(process.env.FORWARD_REMOTE_PORT || '80'),
};

function buildConnectConfig(): ConnectConfig {
  const base: ConnectConfig = {
    host: cfg.host,
    port: cfg.port,
    username: cfg.username,
    readyTimeout: 15_000,
    keepaliveInterval: 10_000,
    keepaliveCountMax: 3,
    algorithms: {
      // Add modern ciphers/mac if needed. Default is usually fine.
    },
  } as any;

  if (cfg.privateKey) {
    // Accept either a path or inline key material
    base.privateKey = cfg.privateKey.includes('BEGIN') ? cfg.privateKey : require('fs').readFileSync(cfg.privateKey);
    if (cfg.passphrase) base.passphrase = cfg.passphrase;
  } else if (cfg.password) {
    base.password = cfg.password;
  } else {
    throw new Error('No auth method provided. Set SSH_PASSWORD or SSH_PRIVATE_KEY.');
  }

  return base;
}

// 1) Basic SSH connection using ssh2
export async function exampleBasicConnection(): Promise<void> {
  console.log('[1] Basic SSH connection start');
  const conn = new Client();
  const params = buildConnectConfig();
  await new Promise<void>((resolve, reject) => {
    conn
      .on('ready', () => {
        console.log(' - SSH ready');
        resolve();
      })
      .on('error', (err) => {
        console.error(' - SSH error:', err.message);
        reject(err);
      })
      .on('end', () => console.log(' - SSH end'))
      .on('close', () => console.log(' - SSH close'))
      .connect(params);
  }).finally(() => conn.end());
}

// 2) Key-based authentication is covered by buildConnectConfig when SSH_PRIVATE_KEY is set
export async function exampleKeyAuth(): Promise<void> {
  console.log('[2] Key-based auth example start');
  if (!cfg.privateKey) throw new Error('Set SSH_PRIVATE_KEY for key-based authentication example.');
  // Reuse basic connection which prefers privateKey
  await exampleBasicConnection();
}

// 3) Remote command execution using ssh2 exec
export async function exampleRemoteCommand(): Promise<{ code: number; stdout: string; stderr: string }> {
  console.log('[3] Remote command execution start');
  const conn = new Client();
  const params = buildConnectConfig();

  return await withTimeout(
    new Promise((resolve, reject) => {
      conn
        .on('ready', () => {
          conn.exec(cfg.remoteCmd, (err, stream) => {
            if (err) return reject(err);
            let stdout = '';
            let stderr = '';
            stream
              .on('close', (code: number) => {
                console.log(` - Command closed with code ${code}`);
                resolve({ code: code ?? -1, stdout, stderr });
                conn.end();
              })
              .on('data', (data: Buffer) => (stdout += data.toString()))
              .stderr.on('data', (data: Buffer) => (stderr += data.toString()));
          });
        })
        .on('error', reject)
        .connect(params);
    }),
    30_000,
    'remote command'
  );
}

// 4) File transfer via SFTP (upload) and download using ssh2-sftp-client
export async function exampleFileTransfer(): Promise<void> {
  console.log('[4] File transfer start');
  const sftp = new SftpClient();
  const params = buildConnectConfig();

  try {
    await withTimeout(sftp.connect(params as any), 20_000, 'sftp connect');
    console.log(' - Connected to SFTP');

    // Upload
    await withTimeout(sftp.fastPut(cfg.localFile, cfg.remotePath), 60_000, 'sftp upload');
    console.log(` - Uploaded ${cfg.localFile} -> ${cfg.remotePath}`);

    // Download back to verify (to a temp path)
    const dl = cfg.remotePath + '.download';
    await withTimeout(sftp.fastGet(cfg.remotePath, dl), 60_000, 'sftp download');
    console.log(` - Downloaded ${cfg.remotePath} -> ${dl}`);
  } catch (err: any) {
    console.error(' - SFTP error:', err.message || err);
    throw err;
  } finally {
    try { await sftp.end(); } catch {}
  }
}

// 5) Port forwarding (local -> remote) using ssh2 forwardOut
export async function examplePortForwarding(): Promise<() => Promise<void>> {
  console.log('[5] Port forwarding start');
  const conn = new Client();
  const params = buildConnectConfig();

  await new Promise<void>((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect(params);
  });

  // Establish a TCP connection from localPort to remoteHost:remotePort
  // Here we demonstrate one-shot forwardOut usage. For a persistent listener,
  // see createServer + forwardOut per-connection.
  const net = await import('net');
  const server = net.createServer((socket) => {
    conn.forwardOut(
      socket.remoteAddress || '127.0.0.1',
      (socket as any).remotePort || 0,
      cfg.fwdRemoteHost,
      cfg.fwdRemotePort,
      (err, stream) => {
        if (err) {
          console.error(' - forwardOut error:', err.message);
          socket.destroy(err as any);
          return;
        }
        socket.pipe(stream).pipe(socket);
      }
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(cfg.fwdLocalPort, () => {
      console.log(` - Listening locally on ${cfg.fwdLocalPort} -> ${cfg.fwdRemoteHost}:${cfg.fwdRemotePort}`);
      resolve();
    });
  });

  // Return a disposer to stop forwarding and close SSH
  return async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    conn.end();
    console.log(' - Port forwarding stopped');
  };
}

// 6) Integration with A2A agents (illustrative)
// This demonstrates how an agent could use the above helpers to perform tasks remotely.
export async function exampleA2AIntegration(): Promise<void> {
  console.log('[6] A2A agent integration start');
  // Hypothetical agent task flow:
  //  - Ensure connectivity
  //  - Run a diagnostic command
  //  - Upload an artifact
  //  - Optionally open a tunnel for a health check

  await exampleBasicConnection();
  const { code, stdout, stderr } = await exampleRemoteCommand();
  if (code !== 0) {
    throw new Error(`Remote diagnostic failed (${code}). Stderr: ${stderr}`);
  }
  console.log(' - Diagnostic output:', stdout.trim());

  await exampleFileTransfer();

  const stop = await examplePortForwarding();
  // Simulate using the tunnel (e.g., HTTP GET to localhost:fwdLocalPort)
  await delay(1000);
  await stop();

  console.log('[6] A2A agent integration complete');
}

// Example CLI runner
async function main() {
  const which = process.argv[2] || 'all';
  try {
    switch (which) {
      case 'basic':
        await exampleBasicConnection();
        break;
      case 'key':
        await exampleKeyAuth();
        break;
      case 'exec':
        console.log(await exampleRemoteCommand());
        break;
      case 'transfer':
        await exampleFileTransfer();
        break;
      case 'forward':
        {
          const stop = await examplePortForwarding();
          console.log('Forwarding active for 10s...');
          await delay(10_000);
          await stop();
        }
        break;
      case 'a2a':
        await exampleA2AIntegration();
        break;
      case 'all':
      default:
        await exampleBasicConnection();
        await exampleKeyAuth().catch((e) => console.warn('Key auth skipped/error:', e.message));
        console.log(await exampleRemoteCommand());
        await exampleFileTransfer();
        {
          const stop = await examplePortForwarding();
          console.log('Forwarding active for 5s...');
          await delay(5_000);
          await stop();
        }
        await exampleA2AIntegration();
        break;
    }
  } catch (err: any) {
    console.error('FATAL:', err?.stack || err?.message || err);
    process.exitCode = 1;
  }
}

// Run when executed directly
if (require.main === module) {
  main();
}
