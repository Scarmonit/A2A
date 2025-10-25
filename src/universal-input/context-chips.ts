/**
 * Context Chips - Contextual input chips for directory, git, conversation, etc.
 * Provides visual context tags for the Universal Input system
 */

export type ChipType = 
  | 'directory'
  | 'file'
  | 'git-branch'
  | 'git-status'
  | 'conversation'
  | 'selection'
  | 'clipboard'
  | 'environment'
  | 'mcp-server'
  | 'custom';

export interface ContextChip {
  id: string;
  type: ChipType;
  label: string;
  value: any;
  icon?: string;
  color?: string;
  removable?: boolean;
  metadata?: Record<string, any>;
}

export interface ChipOptions {
  maxChips?: number;
  autoDetect?: boolean;
  persistChips?: boolean;
}

export class ContextChipManager {
  private chips: Map<string, ContextChip>;
  private options: Required<ChipOptions>;
  private listeners: Map<string, Array<(...args: any[]) => void>>;
  private chipIdCounter: number;

  constructor(options: ChipOptions = {}) {
    this.chips = new Map();
    this.chipIdCounter = 0;
    this.options = {
      maxChips: options.maxChips ?? 20,
      autoDetect: options.autoDetect ?? true,
      persistChips: options.persistChips ?? true,
    };
    this.listeners = new Map();

    if (this.options.autoDetect) {
      this.initAutoDetection();
    }
  }

  private initAutoDetection(): void {
    // Auto-detect context and create chips
    this.detectDirectoryContext();
    this.detectGitContext();
    this.detectEnvironmentContext();
  }

  private async detectDirectoryContext(): Promise<void> {
    try {
      const cwd = process.cwd();
      this.addChip('directory', {
        path: cwd,
        name: cwd.split('/').pop() || 'root',
      });
    } catch (error) {
      console.warn('[ContextChips] Failed to detect directory context:', error);
    }
  }

  private async detectGitContext(): Promise<void> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Get current git branch
      const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD 2>/dev/null');
      if (branch.trim()) {
        this.addChip('git-branch', {
          branch: branch.trim(),
        });
      }

      // Get git status
      const { stdout: status } = await execAsync('git status --porcelain 2>/dev/null');
      if (status.trim()) {
        const changes = status.split('\n').filter(line => line.trim()).length;
        this.addChip('git-status', {
          changes,
          hasChanges: changes > 0,
        });
      }
    } catch (error) {
      // Not a git repository or git not available
    }
  }

  private detectEnvironmentContext(): void {
    const env = process.env.NODE_ENV;
    if (env) {
      this.addChip('environment', {
        environment: env,
      });
    }
  }

  public addChip(type: ChipType, data: any): ContextChip {
    const chip = this.createChip(type, data);
    
    // Check max chips limit
    if (this.chips.size >= this.options.maxChips) {
      // Remove oldest removable chip
      this.removeOldestRemovableChip();
    }

    this.chips.set(chip.id, chip);
    this.emit('chipAdded', chip);
    
    return chip;
  }

  private createChip(type: ChipType, data: any): ContextChip {
    const id = `chip-${this.chipIdCounter++}`;
    
    const chipConfig = this.getChipConfig(type, data);
    
    return {
      id,
      type,
      label: chipConfig.label,
      value: data,
      icon: chipConfig.icon,
      color: chipConfig.color,
      removable: chipConfig.removable ?? true,
      metadata: chipConfig.metadata,
    };
  }

  private getChipConfig(type: ChipType, data: any): Partial<ContextChip> {
    switch (type) {
      case 'directory':
        return {
          label: `📁 ${data.name || data.path}`,
          icon: '📁',
          color: '#4A90E2',
          removable: false,
          metadata: { path: data.path },
        };
      
      case 'file':
        return {
          label: `📄 ${data.name}`,
          icon: '📄',
          color: '#50C878',
          metadata: { path: data.path, size: data.size },
        };
      
      case 'git-branch':
        return {
          label: `🌿 ${data.branch}`,
          icon: '🌿',
          color: '#F05033',
          removable: false,
        };
      
      case 'git-status':
        return {
          label: `${data.changes} changes`,
          icon: data.hasChanges ? '⚠️' : '✅',
          color: data.hasChanges ? '#FFA500' : '#50C878',
        };
      
      case 'conversation':
        return {
          label: `💬 ${data.title || 'Conversation'}`,
          icon: '💬',
          color: '#9B59B6',
          metadata: { messages: data.messages },
        };
      
      case 'selection':
        return {
          label: `📋 ${data.length} chars selected`,
          icon: '📋',
          color: '#3498DB',
          metadata: { text: data.text },
        };
      
      case 'clipboard':
        return {
          label: '📎 Clipboard',
          icon: '📎',
          color: '#95A5A6',
        };
      
      case 'environment':
        return {
          label: `🌍 ${data.environment}`,
          icon: '🌍',
          color: '#E67E22',
        };
      
      case 'mcp-server':
        return {
          label: `🔌 ${data.name}`,
          icon: '🔌',
          color: '#1ABC9C',
          metadata: { endpoint: data.endpoint },
        };
      
      case 'custom':
        return {
          label: data.label || 'Custom',
          icon: data.icon || '🏷️',
          color: data.color || '#95A5A6',
        };
      
      default:
        return {
          label: String(data),
          color: '#95A5A6',
        };
    }
  }

  public removeChip(chipId: string): boolean {
    const chip = this.chips.get(chipId);
    if (!chip) {
      return false;
    }

    if (!chip.removable) {
      console.warn('[ContextChips] Cannot remove non-removable chip:', chipId);
      return false;
    }

    this.chips.delete(chipId);
    this.emit('chipRemoved', chip);
    return true;
  }

  private removeOldestRemovableChip(): void {
    for (const [id, chip] of this.chips.entries()) {
      if (chip.removable) {
        this.chips.delete(id);
        this.emit('chipRemoved', chip);
        break;
      }
    }
  }

  public clearChips(keepNonRemovable: boolean = true): void {
    if (keepNonRemovable) {
      const nonRemovableChips = Array.from(this.chips.entries())
        .filter(([_, chip]) => !chip.removable);
      
      this.chips.clear();
      nonRemovableChips.forEach(([id, chip]) => {
        this.chips.set(id, chip);
      });
    } else {
      this.chips.clear();
    }

    this.emit('chipsCleared');
  }

  public getChip(chipId: string): ContextChip | undefined {
    return this.chips.get(chipId);
  }

  public getActiveChips(): ContextChip[] {
    return Array.from(this.chips.values());
  }

  public getChipsByType(type: ChipType): ContextChip[] {
    return Array.from(this.chips.values()).filter(chip => chip.type === type);
  }

  public hasChip(chipId: string): boolean {
    return this.chips.has(chipId);
  }

  public getChipCount(): number {
    return this.chips.size;
  }

  public updateChip(chipId: string, updates: Partial<ContextChip>): boolean {
    const chip = this.chips.get(chipId);
    if (!chip) {
      return false;
    }

    const updatedChip = { ...chip, ...updates, id: chip.id };
    this.chips.set(chipId, updatedChip);
    this.emit('chipUpdated', updatedChip);
    return true;
  }

  public addFileChip(filePath: string, fileName?: string): ContextChip {
    return this.addChip('file', {
      path: filePath,
      name: fileName || filePath.split('/').pop(),
    });
  }

  public addSelectionChip(text: string): ContextChip {
    return this.addChip('selection', {
      text,
      length: text.length,
    });
  }

  public addMCPServerChip(name: string, endpoint: string): ContextChip {
    return this.addChip('mcp-server', {
      name,
      endpoint,
    });
  }

  public toJSON(): any {
    return {
      chips: Array.from(this.chips.values()),
      options: this.options,
    };
  }

  public fromJSON(data: any): void {
    if (data.chips && Array.isArray(data.chips)) {
      this.chips.clear();
      data.chips.forEach((chip: ContextChip) => {
        this.chips.set(chip.id, chip);
      });
    }
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

export default ContextChipManager;
