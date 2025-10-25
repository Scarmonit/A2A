import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { VoyageAIEmbeddings } from '@langchain/voyageai';
import { LanceDB } from '@langchain/community/vectorstores/lancedb';
import * as lancedb from 'lancedb';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

// Initialize embeddings and vector store
const embeddings = new VoyageAIEmbeddings({
  apiKey: process.env.VOYAGE_API_KEY,
  modelName: 'voyage-code-2',
});

let vectorStore: LanceDB;
const codebaseIndexPath = process.env.CODEBASE_INDEX_PATH || './codebase_index';

// Initialize vector store
async function initializeVectorStore(): Promise<void> {
  try {
    const db = await lancedb.connect(codebaseIndexPath);
    vectorStore = new LanceDB(embeddings, { table: db });
  } catch (error) {
    console.error('Failed to initialize vector store:', error);
    throw new McpError(ErrorCode.InternalError, 'Failed to initialize vector store');
  }
}

// Search codebase tool schema
const SearchCodebaseSchema = z.object({
  query: z.string().describe('Search query for codebase'),
  limit: z.number().optional().default(10).describe('Number of results to return'),
  threshold: z.number().optional().default(0.7).describe('Similarity threshold'),
});

// Get file context tool schema
const GetFileContextSchema = z.object({
  filePath: z.string().describe('Path to the file'),
  lineStart: z.number().optional().describe('Starting line number'),
  lineEnd: z.number().optional().describe('Ending line number'),
});

// Search by language tool schema
const SearchByLanguageSchema = z.object({
  language: z.string().describe('Programming language filter'),
  query: z.string().describe('Search query within language files'),
  limit: z.number().optional().default(10).describe('Number of results to return'),
});

// File extensions by language
const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  typescript: ['.ts', '.tsx'],
  javascript: ['.js', '.jsx'],
  python: ['.py'],
  java: ['.java'],
  cpp: ['.cpp', '.cc', '.cxx'],
  c: ['.c'],
  csharp: ['.cs'],
  go: ['.go'],
  rust: ['.rs'],
  php: ['.php'],
  ruby: ['.rb'],
  swift: ['.swift'],
  kotlin: ['.kt'],
  scala: ['.scala'],
  clojure: ['.clj'],
  haskell: ['.hs'],
  erlang: ['.erl'],
  elixir: ['.ex'],
  dart: ['.dart'],
  lua: ['.lua'],
  perl: ['.pl'],
  r: ['.r'],
  julia: ['.jl'],
  matlab: ['.m'],
  shell: ['.sh', '.bash'],
  powershell: ['.ps1'],
  html: ['.html', '.htm'],
  css: ['.css'],
  scss: ['.scss'],
  sass: ['.sass'],
  less: ['.less'],
  xml: ['.xml'],
  json: ['.json'],
  yaml: ['.yaml', '.yml'],
  toml: ['.toml'],
  ini: ['.ini'],
  sql: ['.sql'],
  dockerfile: ['Dockerfile'],
  makefile: ['Makefile'],
};

// Initialize MCP server
const server = new Server(
  {
    name: 'continue-integration-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_codebase',
        description: 'Search codebase using semantic similarity with RAG',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for codebase',
            },
            limit: {
              type: 'number',
              description: 'Number of results to return',
              default: 10,
            },
            threshold: {
              type: 'number',
              description: 'Similarity threshold',
              default: 0.7,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_file_context',
        description: 'Get file content with optional line range',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the file',
            },
            lineStart: {
              type: 'number',
              description: 'Starting line number',
            },
            lineEnd: {
              type: 'number',
              description: 'Ending line number',
            },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'search_by_language',
        description: 'Search codebase filtered by programming language',
        inputSchema: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              description: 'Programming language filter',
            },
            query: {
              type: 'string',
              description: 'Search query within language files',
            },
            limit: {
              type: 'number',
              description: 'Number of results to return',
              default: 10,
            },
          },
          required: ['language', 'query'],
        },
      },
    ],
  };
});

// Request handlers with semantic search logic
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_codebase': {
        const { query, limit, threshold } = SearchCodebaseSchema.parse(args);
        
        if (!vectorStore) {
          await initializeVectorStore();
        }

        const results = await vectorStore.similaritySearchWithScore(query, limit);
        const filteredResults = results.filter(([, score]) => score >= threshold);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                query,
                results: filteredResults.map(([doc, score]) => ({
                  content: doc.pageContent,
                  metadata: doc.metadata,
                  similarity: score,
                })),
                total: filteredResults.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_file_context': {
        const { filePath, lineStart, lineEnd } = GetFileContextSchema.parse(args);
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');
          
          let selectedContent = content;
          if (lineStart !== undefined || lineEnd !== undefined) {
            const start = Math.max(0, (lineStart || 1) - 1);
            const end = Math.min(lines.length, lineEnd || lines.length);
            selectedContent = lines.slice(start, end).join('\n');
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  filePath,
                  content: selectedContent,
                  totalLines: lines.length,
                  selectedLines: lineStart && lineEnd ? `${lineStart}-${lineEnd}` : 'all',
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Failed to read file: ${filePath}. Error: ${error}`
          );
        }
      }

      case 'search_by_language': {
        const { language, query, limit } = SearchByLanguageSchema.parse(args);
        
        const extensions = LANGUAGE_EXTENSIONS[language.toLowerCase()];
        if (!extensions) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Unsupported language: ${language}`
          );
        }

        // Find files with matching extensions
        const patterns = extensions.map(ext => `**/*${ext}`);
        const files = await glob(patterns, { ignore: ['node_modules/**', '.git/**'] });
        
        // Search within language-specific files
        const results = [];
        for (const file of files.slice(0, limit)) {
          try {
            const content = await fs.readFile(file, 'utf-8');
            if (content.toLowerCase().includes(query.toLowerCase())) {
              results.push({
                filePath: file,
                language,
                preview: content.substring(0, 500),
              });
            }
          } catch (error) {
            console.warn(`Failed to read file ${file}:`, error);
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                language,
                query,
                results,
                total: results.length,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error}`
    );
  }
});

// Main execution function
async function main(): Promise<void> {
  try {
    // Initialize vector store on startup
    await initializeVectorStore();
    console.log('Continue.dev MCP Server initialized successfully');
    
    // Create transport and run server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log('Continue.dev MCP Server running...');
  } catch (error) {
    console.error('Failed to start Continue.dev MCP Server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down Continue.dev MCP Server...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down Continue.dev MCP Server...');
  await server.close();
  process.exit(0);
});

// Start the server
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { server, initializeVectorStore, main };
export default main;
