import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import express from 'express';
import type { Request, Response } from 'express';

export class SSEServerTransport {
  private app: express.Application;
  private server?: any;
  
  constructor(private mcpServer: Server, private port: number = 8788) {
    this.app = express();
    this.setupRoutes();
  }
  
  private setupRoutes() {
    // SSE endpoint for MCP
    this.app.get('/sse', async (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Send initial connection event
      res.write('event: connected\n');
      res.write('data: {"status":"connected"}\n\n');
      
      // Handle incoming messages from client
      req.on('close', () => {
        console.log('Client disconnected');
      });
    });
    
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', transport: 'sse' });
    });
  }
  
  start() {
    this.server = this.app.listen(this.port, () => {
      console.log(`SSE transport listening on port ${this.port}`);
    });
  }
  
  close() {
    this.server?.close();
  }
}
