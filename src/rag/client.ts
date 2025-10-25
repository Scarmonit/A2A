import { spawn } from 'child_process';
import { EventEmitter } from 'events';

interface SearchResult {
  filename: string;
  text: string;
  language: string;
  chunk_index: number;
}

interface MCPResponse {
  type: 'text';
  text: string;
}

export class RAGClient extends EventEmitter {
  private serverProcess: any;
  private connected: boolean = false;

  constructor(private serverPath: string = './src/rag/mcp/rag_server.py') {
    super();
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    this.serverProcess = spawn('python', [this.serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    this.serverProcess.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this.connected = true;
    this.emit('connected');
  }

  async searchCodebase(
    query: string,
    limit: number = 10,
    repository: string = 'A2A'
  ): Promise<SearchResult[]> {
    if (!this.connected) {
      await this.connect();
    }

    const request = {
      tool: 'search_codebase',
      params: { query, limit, repository }
    };

    return this.sendRequest(request);
  }

  async getFileContext(
    filename: string,
    repository: string = 'A2A'
  ): Promise<string> {
    if (!this.connected) {
      await this.connect();
    }

    const request = {
      tool: 'get_file_context',
      params: { filename, repository }
    };

    const results = await this.sendRequest(request);
    return results[0]?.text || '';
  }

  async searchByLanguage(
    query: string,
    language: string,
    limit: number = 10,
    repository: string = 'A2A'
  ): Promise<SearchResult[]> {
    if (!this.connected) {
      await this.connect();
    }

    const request = {
      tool: 'search_by_language',
      params: { query, language, limit, repository }
    };

    return this.sendRequest(request);
  }

  private async sendRequest(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestStr = JSON.stringify(request) + '\n';
      this.serverProcess.stdin.write(requestStr);

      let response = '';
      const onData = (data: Buffer) => {
        response += data.toString();
        if (response.includes('\n')) {
          this.serverProcess.stdout.removeListener('data', onData);
          try {
            const parsed = JSON.parse(response.trim());
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        }
      };

      this.serverProcess.stdout.on('data', onData);

      setTimeout(() => {
        this.serverProcess.stdout.removeListener('data', onData);
        reject(new Error('Request timeout'));
      }, 30000);
    });
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;

    this.serverProcess.kill();
    this.connected = false;
    this.emit('disconnected');
  }
}

// Example usage
if (require.main === module) {
  (async () => {
    const client = new RAGClient();

    try {
      await client.connect();
      console.log('✅ Connected to RAG server');

      // Search for authentication code
      const results = await client.searchCodebase('authentication middleware');
      console.log('\n🔍 Search Results:');
      results.forEach((r: any) => {
        console.log(`\nFile: ${r.filename}`);
        console.log(`Language: ${r.language}`);
        console.log(`Preview: ${r.text.substring(0, 100)}...`);
      });

      // Get file context
      const fileContent = await client.getFileContext('src/db/index.ts');
      console.log('\n📄 File Context:');
      console.log(fileContent.substring(0, 200) + '...');

      await client.disconnect();
      console.log('\n✅ Disconnected');
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  })();
}
