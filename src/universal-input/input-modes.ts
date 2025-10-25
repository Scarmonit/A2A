/**
 * Input Modes - Agent, Terminal, and Auto-detection
 * Manages different input modes for the Universal Input system
 */

export type InputModeType = 'agent' | 'terminal' | 'auto';

export interface InputMode {
  type: InputModeType;
  name: string;
  description: string;
  icon?: string;
  enabled: boolean;
}

export interface ModeConfig {
  agent: InputMode;
  terminal: InputMode;
  auto: InputMode;
}

export class InputModeManager {
  private currentMode: InputModeType;
  private modes: ModeConfig;
  private listeners: Map<string, Array<(mode: InputModeType) => void>>;

  constructor(initialMode: InputModeType = 'auto') {
    this.currentMode = initialMode;
    this.listeners = new Map();
    
    this.modes = {
      agent: {
        type: 'agent',
        name: 'Agent Mode',
        description: 'Send input to AI agent with full context and MCP integration',
        icon: '🤖',
        enabled: true,
      },
      terminal: {
        type: 'terminal',
        name: 'Terminal Mode',
        description: 'Execute commands directly in the terminal',
        icon: '💻',
        enabled: true,
      },
      auto: {
        type: 'auto',
        name: 'Auto Mode',
        description: 'Automatically detect whether to use agent or terminal',
        icon: '✨',
        enabled: true,
      },
    };
  }

  public getCurrentMode(): InputModeType {
    return this.currentMode;
  }

  public setMode(mode: InputModeType): void {
    if (!this.isValidMode(mode)) {
      throw new Error(`Invalid mode: ${mode}`);
    }

    if (!this.modes[mode].enabled) {
      throw new Error(`Mode ${mode} is disabled`);
    }

    const previousMode = this.currentMode;
    this.currentMode = mode;
    
    this.emit('modeChange', mode, previousMode);
  }

  public getModeInfo(mode: InputModeType): InputMode {
    if (!this.isValidMode(mode)) {
      throw new Error(`Invalid mode: ${mode}`);
    }
    return { ...this.modes[mode] };
  }

  public getAllModes(): InputMode[] {
    return Object.values(this.modes).filter(mode => mode.enabled);
  }

  public isValidMode(mode: string): mode is InputModeType {
    return mode === 'agent' || mode === 'terminal' || mode === 'auto';
  }

  public toggleMode(mode: InputModeType, enabled: boolean): void {
    if (!this.isValidMode(mode)) {
      throw new Error(`Invalid mode: ${mode}`);
    }

    this.modes[mode].enabled = enabled;
    this.emit('modeToggled', mode, enabled);

    // If current mode is disabled, switch to another enabled mode
    if (mode === this.currentMode && !enabled) {
      const nextMode = this.getNextEnabledMode();
      if (nextMode) {
        this.setMode(nextMode);
      }
    }
  }

  private getNextEnabledMode(): InputModeType | null {
    const enabledModes = this.getAllModes();
    return enabledModes.length > 0 ? enabledModes[0].type : null;
  }

  public cycleMode(): InputModeType {
    const modes: InputModeType[] = ['auto', 'agent', 'terminal'];
    const currentIndex = modes.indexOf(this.currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    
    let nextMode = modes[nextIndex];
    
    // Find next enabled mode
    for (let i = 0; i < modes.length; i++) {
      if (this.modes[nextMode].enabled) {
        this.setMode(nextMode);
        return nextMode;
      }
      const idx = (nextIndex + i + 1) % modes.length;
      nextMode = modes[idx];
    }

    // If no enabled modes found, stay on current
    return this.currentMode;
  }

  public on(event: string, handler: (mode: InputModeType, ...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  public off(event: string, handler: (mode: InputModeType, ...args: any[]) => void): void {
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

/**
 * Mode Detection Strategies
 */
export class ModeDetector {
  /**
   * Detect if input looks like a terminal command
   */
  public static isTerminalCommand(input: string): boolean {
    const trimmed = input.trim();
    
    // Common shell commands and patterns
    const commandPatterns = [
      /^(ls|cd|pwd|mkdir|rm|cp|mv|cat|echo|grep|find|chmod|chown)\b/,
      /^(git|npm|yarn|pnpm|node|python|pip|cargo|rustc)\b/,
      /^(docker|kubectl|helm|terraform)\b/,
      /^(curl|wget|ssh|scp|rsync)\b/,
      /^[\.\~]?\//,  // Paths starting with ./ ~/ /
      /\|\|?|&&|;|>>?|<<|\$\(/,  // Shell operators
    ];

    return commandPatterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Detect if input is a natural language query for the agent
   */
  public static isAgentQuery(input: string): boolean {
    const trimmed = input.trim().toLowerCase();
    
    // Natural language patterns
    const nlPatterns = [
      /^(what|why|how|when|where|who|which|can you|could you|please|help)/,
      /^(explain|describe|tell me|show me|find|search|list)/,
      /^(create|generate|write|build|make|design)/,
      /^(analyze|review|check|verify|test|debug)/,
      /\?$/,  // Questions ending with ?
    ];

    // Check for @-mentions (context references)
    if (trimmed.includes('@')) {
      return true;
    }

    // Check for slash commands
    if (trimmed.startsWith('/')) {
      return true;
    }

    return nlPatterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Auto-detect the most appropriate mode for the input
   */
  public static detectMode(input: string): InputModeType {
    if (this.isTerminalCommand(input)) {
      return 'terminal';
    }
    
    if (this.isAgentQuery(input)) {
      return 'agent';
    }

    // Default to agent for ambiguous cases
    return 'agent';
  }
}

export default InputModeManager;
