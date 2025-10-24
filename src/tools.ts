import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SafeValueEvaluator } from './infrastructure/safe-expression-evaluator.js';

const execAsync = promisify(exec);

export type ToolParameter = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: any[];
};

export type ToolDescriptor = {
  name: string;
  description: string;
  parameters: ToolParameter[];
  category: string;
  permissions: string[];
  handler: (params: Record<string, any>, context?: ToolExecutionContext) => Promise<any>;
};

export type ToolExecutionContext = {
  agentId: string;
  requestId: string;
  workingDirectory?: string;
  permissions: string[];
  limits: {
    maxFileSize?: number;
    maxExecutionTime?: number;
    allowedPaths?: string[];
  };
};

export type ToolResult = {
  success: boolean;
  result?: any;
  error?: string;
  filesCreated?: string[];
  filesModified?: string[];
  executionTime?: number;
};

export class ToolRegistry {
  private tools = new Map<string, ToolDescriptor>();
  
  constructor() {
    this.registerDefaultTools();
  }
  
  register(tool: ToolDescriptor): void {
    this.tools.set(tool.name, tool);
  }
  
  get(name: string): ToolDescriptor | undefined {
    return this.tools.get(name);
  }
  
  list(category?: string): ToolDescriptor[] {
    const tools = Array.from(this.tools.values());
    return category ? tools.filter(t => t.category === category) : tools;
  }
  
  getCategories(): string[] {
    const categories = new Set(Array.from(this.tools.values()).map(t => t.category));
    return Array.from(categories);
  }
  
  async execute(toolName: string, params: Record<string, any>, context: ToolExecutionContext): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { success: false, error: `Tool '${toolName}' not found` };
    }
    
    // Check permissions
    const hasPermission = tool.permissions.every(perm => 
      context.permissions.includes(perm) || context.permissions.includes('*')
    );
    
    if (!hasPermission) {
      return { success: false, error: `Insufficient permissions for tool '${toolName}'` };
    }
    
    // Validate parameters
    const validation = this.validateParameters(tool.parameters, params);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    try {
      const startTime = Date.now();
      const result = await Promise.race([
        tool.handler(params, context),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tool execution timeout')), 
          context.limits.maxExecutionTime || 30000)
        )
      ]);
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        result,
        executionTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private validateParameters(toolParams: ToolParameter[], providedParams: Record<string, any>): { valid: boolean; error?: string } {
    // Check required parameters
    for (const param of toolParams) {
      if (param.required && !(param.name in providedParams)) {
        return { valid: false, error: `Missing required parameter: ${param.name}` };
      }
    }
    
    // Type validation (basic)
    for (const [name, value] of Object.entries(providedParams)) {
      const param = toolParams.find(p => p.name === name);
      if (param && value !== undefined) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== param.type && !(param.type === 'object' && actualType === 'object')) {
          return { valid: false, error: `Parameter '${name}' must be of type ${param.type}` };
        }
      }
    }
    
    return { valid: true };
  }
  
  private registerDefaultTools(): void {
    // File Operations
    this.register({
      name: 'create_file',
      description: 'Create a new file with content',
      category: 'file_operations',
      permissions: ['file:write'],
      parameters: [
        { name: 'path', type: 'string', description: 'File path', required: true },
        { name: 'content', type: 'string', description: 'File content', required: true },
        { name: 'encoding', type: 'string', description: 'File encoding (default: utf8)' }
      ],
      handler: async (params, context) => {
        const { path: filePath, content, encoding = 'utf8' } = params;
        const fullPath = this.resolvePath(filePath, context);
        await fs.writeFile(fullPath, content, encoding);
        return { path: fullPath, size: Buffer.byteLength(content, encoding as BufferEncoding) };
      }
    });
    
    this.register({
      name: 'read_file',
      description: 'Read content from a file',
      category: 'file_operations',
      permissions: ['file:read'],
      parameters: [
        { name: 'path', type: 'string', description: 'File path', required: true },
        { name: 'encoding', type: 'string', description: 'File encoding (default: utf8)' }
      ],
      handler: async (params, context) => {
        const { path: filePath, encoding = 'utf8' } = params;
        const fullPath = this.resolvePath(filePath, context);
        const content = await fs.readFile(fullPath, encoding as BufferEncoding);
        return { content, size: content.length };
      }
    });
    
    this.register({
      name: 'list_directory',
      description: 'List files and directories',
      category: 'file_operations',
      permissions: ['file:read'],
      parameters: [
        { name: 'path', type: 'string', description: 'Directory path', required: true },
        { name: 'recursive', type: 'boolean', description: 'Recursive listing' }
      ],
      handler: async (params, context) => {
        const { path: dirPath, recursive = false } = params;
        const fullPath = this.resolvePath(dirPath, context);
        
        if (recursive) {
          const files: string[] = [];
          const scan = async (dir: string) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullEntryPath = path.join(dir, entry.name);
              files.push(path.relative(fullPath, fullEntryPath));
              if (entry.isDirectory()) {
                await scan(fullEntryPath);
              }
            }
          };
          await scan(fullPath);
          return { files };
        } else {
          const entries = await fs.readdir(fullPath, { withFileTypes: true });
          return {
            files: entries.filter(e => e.isFile()).map(e => e.name),
            directories: entries.filter(e => e.isDirectory()).map(e => e.name)
          };
        }
      }
    });
    
    // Code Generation
    this.register({
      name: 'generate_code',
      description: 'Generate code in specified language',
      category: 'code_generation',
      permissions: ['code:generate'],
      parameters: [
        { name: 'language', type: 'string', description: 'Programming language', required: true },
        { name: 'description', type: 'string', description: 'Code description', required: true },
        { name: 'template', type: 'string', description: 'Code template' },
        { name: 'save_to', type: 'string', description: 'File path to save generated code' }
      ],
      handler: async (params, context) => {
        const { language, description, template, save_to } = params;
        
        // Simple code generation based on language
        let code = '';
        switch (language.toLowerCase()) {
          case 'javascript':
          case 'js':
            code = this.generateJavaScript(description, template);
            break;
          case 'python':
          case 'py':
            code = this.generatePython(description, template);
            break;
          case 'typescript':
          case 'ts':
            code = this.generateTypeScript(description, template);
            break;
          default:
            code = `// Generated ${language} code for: ${description}\n// TODO: Implement functionality\n`;
        }
        
        const result: any = { code, language, description };
        
        if (save_to && context?.permissions.includes('file:write')) {
          const fullPath = this.resolvePath(save_to, context);
          await fs.writeFile(fullPath, code, 'utf8');
          result.saved_to = fullPath;
        }
        
        return result;
      }
    });
    
    // Data Processing
    this.register({
      name: 'process_json',
      description: 'Process and transform JSON data',
      category: 'data_processing',
      permissions: ['data:process'],
      parameters: [
        { name: 'data', type: 'object', description: 'JSON data to process', required: true },
        { name: 'operation', type: 'string', description: 'Operation to perform', required: true, 
          enum: ['filter', 'map', 'reduce', 'sort', 'group'] },
        { name: 'expression', type: 'string', description: 'Processing expression' },
        { name: 'output_file', type: 'string', description: 'Save result to file' }
      ],
      handler: async (params, context) => {
        const { data, operation, expression, output_file } = params;
        
        let result: any;
        switch (operation) {
          case 'filter':
            result = Array.isArray(data) ? data.filter((item, index) => 
              this.evaluateExpression(expression, { item, index, data })) : data;
            break;
          case 'map':
            result = Array.isArray(data) ? data.map((item, index) => 
              this.evaluateExpression(expression, { item, index, data })) : data;
            break;
          case 'sort':
            result = Array.isArray(data) ? [...data].sort((a, b) => 
              this.evaluateExpression(expression, { a, b, data })) : data;
            break;
          default:
            result = data;
        }
        
        if (output_file && context?.permissions.includes('file:write')) {
          const fullPath = this.resolvePath(output_file, context);
          await fs.writeFile(fullPath, JSON.stringify(result, null, 2), 'utf8');
        }
        
        return { result, operation, processed_items: Array.isArray(result) ? result.length : 1 };
      }
    });
    
    // System Operations
    this.register({
      name: 'execute_command',
      description: 'Execute system command (restricted)',
      category: 'system',
      permissions: ['system:execute'],
      parameters: [
        { name: 'command', type: 'string', description: 'Command to execute', required: true },
        { name: 'args', type: 'array', description: 'Command arguments' },
        { name: 'timeout', type: 'number', description: 'Timeout in seconds' }
      ],
      handler: async (params, context) => {
        const { command, args = [], timeout = 30 } = params;
        
        // Whitelist of safe commands
        const safeCommands = ['ls', 'dir', 'echo', 'cat', 'head', 'tail', 'wc', 'grep', 'find'];
        if (!safeCommands.includes(command.split(' ')[0])) {
          throw new Error(`Command '${command}' not allowed`);
        }
        
        const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
        const { stdout, stderr } = await execAsync(fullCommand, { timeout: timeout * 1000 });
        
        return { stdout, stderr, command: fullCommand };
      }
    });
    
    // HTTP Requests
    this.register({
      name: 'http_request',
      description: 'Make HTTP request',
      category: 'network',
      permissions: ['network:http'],
      parameters: [
        { name: 'url', type: 'string', description: 'URL to request', required: true },
        { name: 'method', type: 'string', description: 'HTTP method', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
        { name: 'headers', type: 'object', description: 'Request headers' },
        { name: 'body', type: 'string', description: 'Request body' }
      ],
      handler: async (params) => {
        const { url, method = 'GET', headers = {}, body } = params;
        
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined
        });
        
        const data = await response.text();
        
        return {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data
        };
      }
    });
  }
  
  protected resolvePath(filePath: string, context?: ToolExecutionContext): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(context?.workingDirectory || process.cwd(), filePath);
  }
  
  private generateJavaScript(description: string, template?: string): string {
    if (template) return template;
    
    return `// ${description}
function main() {
  console.log('${description}');
  // TODO: Implement functionality
  return { success: true, message: '${description} completed' };
}

module.exports = { main };
`;
  }
  
  private generatePython(description: string, template?: string): string {
    if (template) return template;
    
    return `# ${description}
def main():
    """${description}"""
    print("${description}")
    # TODO: Implement functionality
    return {"success": True, "message": "${description} completed"}

if __name__ == "__main__":
    result = main()
    print(result)
`;
  }
  
  private generateTypeScript(description: string, template?: string): string {
    if (template) return template;
    
    return `// ${description}
interface Result {
  success: boolean;
  message: string;
}

function main(): Result {
  console.log('${description}');
  // TODO: Implement functionality
  return { success: true, message: '${description} completed' };
}

export { main, Result };
`;
  }
  
  private evaluateExpression(expression: string, context: any): any {
    // Use safe value evaluator to prevent arbitrary code execution
    // Only supports property access, no operations
    return SafeValueEvaluator.resolve(expression, context);
  }
}

export const toolRegistry = new ToolRegistry();