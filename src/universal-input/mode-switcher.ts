/**
 * Mode Switcher - Mode switching logic
 * Handles switching between input modes with validation and state management
 */

import { InputModeType } from './input-modes';

export interface ModeSwitcherConfig {
  initialMode?: InputModeType;
  enableShortcuts?: boolean;
  enableAutoSwitch?: boolean;
  autoSwitchDelay?: number;
}

export interface ModeTransition {
  from: InputModeType;
  to: InputModeType;
  timestamp: number;
  reason?: string;
}

export class ModeSwitcher {
  private currentMode: InputModeType;
  private previousMode: InputModeType | null;
  private config: Required<ModeSwitcherConfig>;
  private listeners: Map<string, Array<(...args: any[]) => void>>;
  private history: ModeTransition[];
  private autoSwitchTimer: NodeJS.Timeout | null;

  constructor(config: ModeSwitcherConfig = {}) {
    this.config = {
      initialMode: config.initialMode || 'auto',
      enableShortcuts: config.enableShortcuts ?? true,
      enableAutoSwitch: config.enableAutoSwitch ?? false,
      autoSwitchDelay: config.autoSwitchDelay ?? 5000,
    };

    this.currentMode = this.config.initialMode;
    this.previousMode = null;
    this.listeners = new Map();
    this.history = [];
    this.autoSwitchTimer = null;

    if (this.config.enableShortcuts) {
      this.setupKeyboardShortcuts();
    }
  }

  /**
   * Get the current mode
   */
  public getCurrentMode(): InputModeType {
    return this.currentMode;
  }

  /**
   * Get the previous mode
   */
  public getPreviousMode(): InputModeType | null {
    return this.previousMode;
  }

  /**
   * Set the current mode
   */
  public setMode(mode: InputModeType, reason?: string): void {
    if (!this.isValidMode(mode)) {
      throw new Error(`Invalid mode: ${mode}`);
    }

    if (mode === this.currentMode) {
      return; // No change
    }

    const transition: ModeTransition = {
      from: this.currentMode,
      to: mode,
      timestamp: Date.now(),
      reason,
    };

    this.previousMode = this.currentMode;
    this.currentMode = mode;
    this.history.push(transition);

    // Emit mode change event
    this.emit('modeChange', mode, this.previousMode);
    this.emit('modeTransition', transition);

    // Cancel any pending auto-switch
    this.cancelAutoSwitch();
  }

  /**
   * Switch to the next mode in sequence
   */
  public nextMode(): InputModeType {
    const modes: InputModeType[] = ['auto', 'agent', 'terminal'];
    const currentIndex = modes.indexOf(this.currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    
    this.setMode(nextMode, 'Manual cycle to next mode');
    return nextMode;
  }

  /**
   * Switch to the previous mode in sequence
   */
  public previousMode_(): InputModeType {
    const modes: InputModeType[] = ['auto', 'agent', 'terminal'];
    const currentIndex = modes.indexOf(this.currentMode);
    const prevIndex = (currentIndex - 1 + modes.length) % modes.length;
    const prevMode = modes[prevIndex];
    
    this.setMode(prevMode, 'Manual cycle to previous mode');
    return prevMode;
  }

  /**
   * Toggle between the current and previous mode
   */
  public toggleMode(): InputModeType {
    if (this.previousMode) {
      this.setMode(this.previousMode, 'Toggle to previous mode');
    } else {
      this.nextMode();
    }
    return this.currentMode;
  }

  /**
   * Switch to agent mode
   */
  public toAgentMode(reason?: string): void {
    this.setMode('agent', reason || 'Switched to agent mode');
  }

  /**
   * Switch to terminal mode
   */
  public toTerminalMode(reason?: string): void {
    this.setMode('terminal', reason || 'Switched to terminal mode');
  }

  /**
   * Switch to auto mode
   */
  public toAutoMode(reason?: string): void {
    this.setMode('auto', reason || 'Switched to auto mode');
  }

  /**
   * Schedule an auto-switch to a different mode
   */
  public scheduleAutoSwitch(mode: InputModeType, delay?: number): void {
    if (!this.config.enableAutoSwitch) {
      return;
    }

    this.cancelAutoSwitch();

    const switchDelay = delay ?? this.config.autoSwitchDelay;
    
    this.autoSwitchTimer = setTimeout(() => {
      this.setMode(mode, `Auto-switched after ${switchDelay}ms`);
    }, switchDelay);
  }

  /**
   * Cancel any pending auto-switch
   */
  public cancelAutoSwitch(): void {
    if (this.autoSwitchTimer) {
      clearTimeout(this.autoSwitchTimer);
      this.autoSwitchTimer = null;
    }
  }

  /**
   * Get mode transition history
   */
  public getHistory(limit?: number): ModeTransition[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Clear mode transition history
   */
  public clearHistory(): void {
    this.history = [];
  }

  /**
   * Get the last transition
   */
  public getLastTransition(): ModeTransition | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  /**
   * Check if a mode is valid
   */
  private isValidMode(mode: string): mode is InputModeType {
    return mode === 'agent' || mode === 'terminal' || mode === 'auto';
  }

  /**
   * Setup keyboard shortcuts for mode switching
   */
  private setupKeyboardShortcuts(): void {
    if (typeof window === 'undefined') {
      return; // Server-side, no keyboard
    }

    // This would be integrated with the application's keyboard shortcut system
    // Example shortcuts:
    // Cmd/Ctrl + Shift + A: Agent mode
    // Cmd/Ctrl + Shift + T: Terminal mode
    // Cmd/Ctrl + Shift + O: Auto mode
    // Cmd/Ctrl + Shift + M: Toggle mode
  }

  /**
   * Get statistics about mode usage
   */
  public getStatistics(): {
    totalTransitions: number;
    agentModeCount: number;
    terminalModeCount: number;
    autoModeCount: number;
    averageTimeInMode: number;
  } {
    const stats = {
      totalTransitions: this.history.length,
      agentModeCount: 0,
      terminalModeCount: 0,
      autoModeCount: 0,
      averageTimeInMode: 0,
    };

    let totalTime = 0;
    let timeCount = 0;

    for (let i = 0; i < this.history.length; i++) {
      const transition = this.history[i];
      
      if (transition.to === 'agent') {
        stats.agentModeCount++;
      } else if (transition.to === 'terminal') {
        stats.terminalModeCount++;
      } else if (transition.to === 'auto') {
        stats.autoModeCount++;
      }

      // Calculate time in mode
      if (i < this.history.length - 1) {
        const nextTransition = this.history[i + 1];
        const timeInMode = nextTransition.timestamp - transition.timestamp;
        totalTime += timeInMode;
        timeCount++;
      }
    }

    if (timeCount > 0) {
      stats.averageTimeInMode = totalTime / timeCount;
    }

    return stats;
  }

  /**
   * Export mode history as JSON
   */
  public exportHistory(): string {
    return JSON.stringify({
      currentMode: this.currentMode,
      previousMode: this.previousMode,
      history: this.history,
    }, null, 2);
  }

  /**
   * Import mode history from JSON
   */
  public importHistory(json: string): void {
    try {
      const data = JSON.parse(json);
      
      if (data.currentMode && this.isValidMode(data.currentMode)) {
        this.currentMode = data.currentMode;
      }
      
      if (data.previousMode && this.isValidMode(data.previousMode)) {
        this.previousMode = data.previousMode;
      }
      
      if (Array.isArray(data.history)) {
        this.history = data.history;
      }
    } catch (error) {
      console.error('[ModeSwitcher] Failed to import history:', error);
      throw new Error('Invalid history format');
    }
  }

  // Event emitter methods
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

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.cancelAutoSwitch();
    this.listeners.clear();
    this.history = [];
  }
}

export default ModeSwitcher;
