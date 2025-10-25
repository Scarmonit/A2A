/**
 * Universal Input - Main Module
 * Integrates Warp-inspired universal input with A2A's agent system
 */

import { InputMode, InputModeType } from './input-modes';
import { ContextChipManager } from './context-chips';
import { InputToolbelt } from './input-toolbelt';
import { NaturalLanguageDetector } from './natural-language-detector';
import { ModeSwitcher } from './mode-switcher';

export interface UniversalInputConfig {
  defaultMode?: InputModeType;
  enableAutoDetection?: boolean;
  enableVoiceInput?: boolean;
  enableContextChips?: boolean;
  agentEndpoint?: string;
  mcpServers?: string[];
}

export interface InputContext {
  mode: InputModeType;
  workingDirectory: string;
  gitBranch?: string;
  conversationHistory: Array<{ role: string; content: string }>;
  activeFiles: string[];
  selectedText?: string;
}

export class UniversalInput {
  private config: Required<UniversalInputConfig>;
  private modeSwitcher: ModeSwitcher;
  private contextChipManager: ContextChipManager;
  private toolbelt: InputToolbelt;
  private nlDetector: NaturalLanguageDetector;
  private context: InputContext;

  constructor(config: UniversalInputConfig = {}) {
    this.config = {
      defaultMode: config.defaultMode || 'auto',
      enableAutoDetection: config.enableAutoDetection ?? true,
      enableVoiceInput: config.enableVoiceInput ?? true,
      enableContextChips: config.enableContextChips ?? true,
      agentEndpoint: config.agentEndpoint || '/api/agent',
      mcpServers: config.mcpServers || [],
    };

    this.context = {
      mode: this.config.defaultMode,
      workingDirectory: process.cwd(),
      conversationHistory: [],
      activeFiles: [],
    };

    this.modeSwitcher = new ModeSwitcher(this.config.defaultMode);
    this.contextChipManager = new ContextChipManager();
    this.toolbelt = new InputToolbelt({
      enableVoice: this.config.enableVoiceInput,
      agentEndpoint: this.config.agentEndpoint,
      mcpServers: this.config.mcpServers,
    });
    this.nlDetector = new NaturalLanguageDetector();

    this.initializeEventListeners();
  }

  private initializeEventListeners(): void {
    this.modeSwitcher.on('modeChange', (mode: InputModeType) => {
      this.handleModeChange(mode);
    });

    this.contextChipManager.on('chipAdded', (chip) => {
      this.updateContext({ activeFiles: [...this.context.activeFiles, chip.path] });
    });

    this.toolbelt.on('command', async (command) => {
      await this.handleCommand(command);
    });
  }

  private handleModeChange(mode: InputModeType): void {
    this.context.mode = mode;
    this.emit('modeChanged', mode);
  }

  public async processInput(input: string): Promise<any> {
    try {
      // Auto-detect mode if enabled
      if (this.config.enableAutoDetection && this.context.mode === 'auto') {
        const detectedMode = await this.nlDetector.detectIntent(input);
        this.modeSwitcher.setMode(detectedMode);
      }

      // Process based on current mode
      const currentMode = this.context.mode;
      
      switch (currentMode) {
        case 'agent':
          return await this.processAgentInput(input);
        case 'terminal':
          return await this.processTerminalInput(input);
        case 'auto':
          return await this.processAutoInput(input);
        default:
          throw new Error(`Unknown mode: ${currentMode}`);
      }
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private async processAgentInput(input: string): Promise<any> {
    // Parse @-mentions and slash commands
    const parsedInput = this.toolbelt.parseInput(input);
    
    // Add to conversation history
    this.context.conversationHistory.push({
      role: 'user',
      content: input,
    });

    // Build context for agent
    const agentContext = {
      ...this.context,
      chips: this.contextChipManager.getActiveChips(),
      mentions: parsedInput.mentions,
      commands: parsedInput.commands,
    };

    // Send to A2A agent endpoint
    const response = await fetch(this.config.agentEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: parsedInput.text,
        context: agentContext,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent request failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    this.context.conversationHistory.push({
      role: 'assistant',
      content: result.content,
    });

    return result;
  }

  private async processTerminalInput(input: string): Promise<any> {
    // Execute terminal command with context
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(input, {
        cwd: this.context.workingDirectory,
      });

      return {
        stdout,
        stderr,
        success: true,
      };
    } catch (error: any) {
      return {
        stdout: error.stdout,
        stderr: error.stderr,
        success: false,
        error: error.message,
      };
    }
  }

  private async processAutoInput(input: string): Promise<any> {
    // Detect intent and route accordingly
    const intent = await this.nlDetector.detectIntent(input);
    
    if (intent === 'terminal') {
      return await this.processTerminalInput(input);
    } else {
      return await this.processAgentInput(input);
    }
  }

  public updateContext(updates: Partial<InputContext>): void {
    this.context = { ...this.context, ...updates };
    this.emit('contextUpdated', this.context);
  }

  public getContext(): InputContext {
    return { ...this.context };
  }

  public getCurrentMode(): InputModeType {
    return this.context.mode;
  }

  public setMode(mode: InputModeType): void {
    this.modeSwitcher.setMode(mode);
  }

  public addContextChip(type: string, data: any): void {
    this.contextChipManager.addChip(type, data);
  }

  public clearContext(): void {
    this.context.conversationHistory = [];
    this.context.activeFiles = [];
    this.contextChipManager.clearChips();
    this.emit('contextCleared');
  }

  private handleError(error: any): void {
    console.error('[UniversalInput] Error:', error);
    this.emit('error', error);
  }

  // Event emitter pattern
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

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

  public destroy(): void {
    this.listeners.clear();
    this.contextChipManager.clearChips();
  }
}

export default UniversalInput;
