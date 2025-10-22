import { spawn } from 'child_process';
import { WebSocket } from 'ws';

async function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const STREAM_PORT = process.env.STREAM_PORT || '8787';
  const METRICS_PORT = process.env.METRICS_PORT || '9100';
  const STREAM_TOKEN = process.env.STREAM_TOKEN || Math.random().toString(36).slice(2);

  const child = spawn(process.execPath, ['dist/index.js'], {
    env: {
      ...process.env,
      STREAM_PORT,
      STREAM_HOST: '127.0.0.1',
      METRICS_PORT,
      STREAM_TOKEN,
      LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (d) => process.stdout.write(`[srv] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[srv] ${d}`));

  // wait for healthz
  const base = `http://127.0.0.1:${METRICS_PORT}`;
  let healthy = false;
  for (let i = 0; i < 20; i++) {
    try {
      const hr = await fetch(`${base}/healthz`);
      if (hr.ok) { healthy = true; break; }
    } catch {}
    await wait(250);
  }
  if (!healthy) throw new Error('Server did not become healthy');

  const demoUrl = `${base}/demo?msg=${encodeURIComponent('Testing a2a stream demo')}`;
  const res = await fetch(demoUrl);
  if (!res.ok) { const t = await res.text(); throw new Error(`Demo invoke failed: ${res.status} ${t}`); }
  const body: any = await res.json();
  if (!body.ok) throw new Error(`Invoke error: ${body.error?.message || 'unknown'}`);
  const data = body.data as { requestId: string; status: string; streamUrl: string };
  const streamUrl: string = data.streamUrl;
  console.log('[try] streamUrl =', streamUrl);

  // Attach token if not already present
  const url = new URL(streamUrl);
  if (!url.searchParams.get('token') && STREAM_TOKEN) url.searchParams.set('token', STREAM_TOKEN);

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(url.toString());
    ws.on('open', () => console.log('[try] ws open'));
    ws.on('message', (buf) => {
      const ev = JSON.parse(buf.toString());
      if (ev.type === 'chunk') process.stdout.write(ev.content);
      if (ev.type === 'final') { console.log('\n[try] final:', JSON.stringify(ev.result)); resolve(); ws.close(); }
      if (ev.type === 'error') { console.error('\n[try] error:', ev.message); reject(new Error(ev.message)); ws.close(); }
    });
    ws.on('error', (e) => reject(e));
  });

  child.kill('SIGTERM');
}

main().catch((e) => { console.error('[try] failed:', e); process.exit(1); });
