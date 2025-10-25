/**
 * Input Toolbelt - @-context, slash commands, voice, images
 * Provides advanced input features for the Universal Input system
 */

export interface ToolbeltConfig {
  enableVoice?: boolean;
  enableImages?: boolean;
  enableCommands?: boolean;
  enableContextMentions?: boolean;
  agentEndpoint?: string;
  mcpServers?: string[];
}

export interface ParsedInput {
  text: string;
  mentions: ContextMention[];
  commands: SlashCommand[];
  attachments: Attachment[];
}

export interface ContextMention {
  type: 'file' | 'directory' | 'symbol' | 'conversation' | 'mcp' | 'custom';
  value: string;
  range: [number, number];
  metadata?: any;
}

export interface SlashCommand {
  command: string;
  args: string[];
  range: [number, number];
}

export interface Attachment {
  type: 'image' | 'audio' | 'file';
  name: string;
  url?: string;
  data?: ArrayBuffer;
  mimeType: string;
}

export class InputToolbelt {
  private config: Required<ToolbeltConfig>;
  private listeners: Map<string, Array<(...args: any[]) => void>>;
  private commands: Map<string, CommandHandler>;

  constructor(config: ToolbeltConfig = {}) {
    this.config = {
      enableVoice: config.enableVoice ?? true,
      enableImages: config.enableImages ?? true,
      enableCommands: config.enableCommands ?? true,
      enableContextMentions: config.enableContextMentions ?? true,
      agentEndpoint: config.agentEndpoint || '/api/agent',
      mcpServers: config.mcpServers || [],
    };

    this.listeners = new Map();
    this.commands = new Map();

    this.registerDefaultCommands();
  }

  /**
   * Parse input for mentions, commands, and attachments
   */
  public parseInput(input: string): ParsedInput {
    const mentions = this.config.enableContextMentions ? this.extractMentions(input) : [];
    const commands = this.config.enableCommands ? this.extractCommands(input) : [];
    
    // Remove commands from text for processing
    let text = input;
    commands.forEach(cmd => {
      const [start, end] = cmd.range;
      text = text.substring(0, start) + text.substring(end);
    });

    return {
      text: text.trim(),
      mentions,
      commands,
      attachments: [],
    };
  }

  /**
   * Extract @-mentions from input
   */
  private extractMentions(input: string): ContextMention[] {
    const mentions: ContextMention[] = [];
    
    // Match @file:/path/to/file, @dir:/path/to/dir, @mcp:server-name, etc.
    const mentionPattern = /@(\w+):([^\s]+)|@([\w\./-]+)/g;
    let match;

    while ((match = mentionPattern.exec(input)) !== null) {
      const [fullMatch, type, value, simpleValue] = match;
      const start = match.index;
      const end = start + fullMatch.length;

      if (type && value) {
        mentions.push({
          type: this.normalizeMentionType(type),
          value,
          range: [start, end],
        });
      } else if (simpleValue) {
        // Auto-detect type from value
        mentions.push({
          type: this.detectMentionType(simpleValue),
          value: simpleValue,
          range: [start, end],
        });
      }
    }

    return mentions;
  }

  private normalizeMentionType(type: string): ContextMention['type'] {
    const normalized = type.toLowerCase();
    switch (normalized) {
      case 'file':
      case 'f':
        return 'file';
      case 'dir':
      case 'directory':
      case 'd':
        return 'directory';
      case 'symbol':
      case 'sym':
      case 's':
        return 'symbol';
      case 'conversation':
      case 'conv':
      case 'c':
        return 'conversation';
      case 'mcp':
      case 'm':
        return 'mcp';
      default:
        return 'custom';
    }
  }

  private detectMentionType(value: string): ContextMention['type'] {
    // Detect based on value patterns
    if (value.includes('/') || value.includes('.')) {
      if (value.endsWith('/') || !value.includes('.')) {
        return 'directory';
      }
      return 'file';
    }
    
    if (value.includes('::') || value.match(/^[A-Z][a-zA-Z0-9_]*$/)) {
      return 'symbol';
    }

    return 'custom';
  }

  /**
   * Extract slash commands from input
   */
  private extractCommands(input: string): SlashCommand[] {
    const commands: SlashCommand[] = [];
    
    // Match /command arg1 arg2 ...
    const commandPattern = /\/([\w-]+)(?:\s+([^\n]*))?/g;
    let match;

    while ((match = commandPattern.exec(input)) !== null) {
      const [fullMatch, command, argsString] = match;
      const start = match.index;
      const end = start + fullMatch.length;

      const args = argsString ? argsString.trim().split(/\s+/) : [];

      commands.push({
        command: command.toLowerCase(),
        args,
        range: [start, end],
      });
    }

    return commands;
  }

  /**
   * Register default slash commands
   */
  private registerDefaultCommands(): void {
    this.registerCommand('help', async () => {
      return {
        type: 'help',
        message: 'Available commands: /help, /clear, /mode, /context, /mcp',
      };
    });

    this.registerCommand('clear', async () => {
      this.emit('clear');
      return { type: 'clear', message: 'Context cleared' };
    });

    this.registerCommand('mode', async (args: string[]) => {
      const mode = args[0];
      if (mode) {
        this.emit('setMode', mode);
        return { type: 'mode', message: `Mode set to ${mode}` };
      }
      return { type: 'mode', message: 'Usage: /mode [agent|terminal|auto]' };
    });

    this.registerCommand('context', async () => {
      this.emit('showContext');
      return { type: 'context', message: 'Showing context' };
    });

    this.registerCommand('mcp', async (args: string[]) => {
      const action = args[0];
      if (action === 'list') {
        this.emit('listMCP');
        return { type: 'mcp', servers: this.config.mcpServers };
      }
      return { type: 'mcp', message: 'Usage: /mcp list' };
    });
  }

  /**
   * Register a custom slash command
   */
  public registerCommand(name: string, handler: CommandHandler): void {
    this.commands.set(name.toLowerCase(), handler);
  }

  /**
   * Execute a command
   */
  public async executeCommand(command: string, args: string[] = []): Promise<any> {
    const handler = this.commands.get(command.toLowerCase());
    if (!handler) {
      throw new Error(`Unknown command: ${command}`);
    }

    try {
      return await handler(args);
    } catch (error) {
      console.error(`[Toolbelt] Command error: ${command}`, error);
      throw error;
    }
  }

  /**
   * Voice input support
   */
  public async startVoiceInput(): Promise<string> {
    if (!this.config.enableVoice) {
      throw new Error('Voice input is disabled');
    }

    // This would integrate with Web Speech API or similar
    throw new Error('Voice input not yet implemented');
  }

  /**
   * Image attachment support
   */
  public async attachImage(file: File): Promise<Attachment> {
    if (!this.config.enableImages) {
      throw new Error('Image attachments are disabled');
    }

    const data = await file.arrayBuffer();
    
    return {
      type: 'image',
      name: file.name,
      data,
      mimeType: file.type,
    };
  }

  /**
   * File attachment support
   */
  public async attachFile(file: File): Promise<Attachment> {
    const data = await file.arrayBuffer();
    
    const type = this.determineAttachmentType(file.type);
    
    return {
      type,
      name: file.name,
      data,
      mimeType: file.type,
    };
  }

  private determineAttachmentType(mimeType: string): Attachment['type'] {
    if (mimeType.startsWith('image/')) {
      return 'image';
    }
    if (mimeType.startsWith('audio/')) {
      return 'audio';
    }
    return 'file';
  }

  /**
   * Get available context sources for @-mentions
   */
  public getContextSources(): Array<{ type: string; label: string; icon?: string }> {
    return [
      { type: 'file', label: 'Files', icon: '📄' },
      { type: 'directory', label: 'Directories', icon: '📁' },
      { type: 'symbol', label: 'Symbols', icon: '🔣' },
      { type: 'conversation', label: 'Conversations', icon: '💬' },
      { type: 'mcp', label: 'MCP Servers', icon: '🔌' },
    ];
  }

  /**
   * Get available slash commands
   */
  public getAvailableCommands(): Array<{ command: string; description: string }> {
    return [
      { command: 'help', description: 'Show available commands' },
      { command: 'clear', description: 'Clear conversation context' },
      { command: 'mode', description: 'Switch input mode' },
      { command: 'context', description: 'Show current context' },
      { command: 'mcp', description: 'Manage MCP servers' },
    ];
  }

  // Event emitter
  public on(event: string, handler: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  public off(event: string, handler: (...args: any[]) => void): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }
}

type CommandHandler = (args: string[]) => Promise<any>;

export default InputToolbelt;
