// terminal-input-handler.ts
// Modern terminal input handling with async processing and WebSocket integration
// Inspired by Crossterm event streams and Ratatui async input patterns

export type KeyEvent = {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
};

export type TerminalEvent =
  | { type: 'key'; event: KeyEvent }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'tick' };

export type Cursor = { x: number; y: number };

export class LineBuffer {
  private chars: string[] = [];
  private cursor: number = 0; // column within line

  constructor(initial: string = '') {
    this.chars = Array.from(initial);
    this.cursor = this.chars.length;
  }

  get text(): string {
    return this.chars.join('');
  }

  getCursor(): number {
    return this.cursor;
  }

  setCursor(pos: number) {
    this.cursor = Math.max(0, Math.min(pos, this.chars.length));
  }

  insert(ch: string) {
    if (!ch) return;
    this.chars.splice(this.cursor, 0, ch);
    this.cursor += ch.length;
  }

  backspace() {
    if (this.cursor > 0) {
      this.chars.splice(this.cursor - 1, 1);
      this.cursor -= 1;
    }
  }

  delete() {
    if (this.cursor < this.chars.length) {
      this.chars.splice(this.cursor, 1);
    }
  }

  moveLeft() {
    this.setCursor(this.cursor - 1);
  }
  moveRight() {
    this.setCursor(this.cursor + 1);
  }
  moveHome() {
    this.setCursor(0);
  }
  moveEnd() {
    this.setCursor(this.chars.length);
  }

  clear() {
    this.chars = [];
    this.cursor = 0;
  }
}

export interface WebSocketLike {
  readyState: number;
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
  addEventListener(type: string, listener: any): void;
  removeEventListener(type: string, listener: any): void;
  close(code?: number, reason?: string): void;
}

export class TerminalInputHandler {
  private ws?: WebSocketLike;
  private running = false;
  private line = new LineBuffer();
  private onSubmit?: (line: string) => void;
  private onUpdate?: (state: { line: string; cursor: number }) => void;
  private tickInterval?: number;

  constructor(opts: {
    ws?: WebSocketLike;
    onSubmit?: (line: string) => void;
    onUpdate?: (state: { line: string; cursor: number }) => void;
    tickMs?: number; // emulate Crossterm event + tick stream
  } = {}) {
    this.ws = opts.ws;
    this.onSubmit = opts.onSubmit;
    this.onUpdate = opts.onUpdate;
    const tickMs = opts.tickMs ?? 250;
    if (typeof window !== 'undefined') {
      this.tickInterval = window.setInterval(() => {
        if (this.running) this.enqueue({ type: 'tick' });
      }, tickMs);
    }
  }

  // Async event queue similar to Crossterm event stream + Ratatui tokio channels
  private queue: TerminalEvent[] = [];
  private resolvers: Array<(ev: IteratorResult<TerminalEvent>) => void> = [];

  private enqueue(ev: TerminalEvent) {
    if (this.resolvers.length) {
      const resolve = this.resolvers.shift()!;
      resolve({ value: ev, done: false });
    } else {
      this.queue.push(ev);
    }
  }

  async *events(): AsyncGenerator<TerminalEvent, void> {
    this.running = true;
    try {
      while (this.running) {
        const next = await new Promise<IteratorResult<TerminalEvent>>((resolve) => {
          if (this.queue.length) {
            resolve({ value: this.queue.shift()!, done: false });
          } else {
            this.resolvers.push(resolve);
          }
        });
        if (next.done) break;
        yield next.value;
      }
    } finally {
      this.running = false;
    }
  }

  attachDOM(el?: HTMLElement | Document) {
    const target = el ?? document;
    const keyHandler = (e: KeyboardEvent) => {
      const kev: KeyEvent = {
        key: e.key,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
      };
      this.enqueue({ type: 'key', event: kev });
      // prevent browser navigation for terminal-like UX
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
    };
    const resizeHandler = () => {
      this.enqueue({ type: 'resize', cols: window.innerWidth, rows: window.innerHeight });
    };
    target.addEventListener('keydown', keyHandler as any);
    window.addEventListener('resize', resizeHandler);
    return () => {
      target.removeEventListener('keydown', keyHandler as any);
      window.removeEventListener('resize', resizeHandler);
    };
  }

  connectWebSocket(ws: WebSocketLike) {
    this.ws = ws;
    ws.addEventListener('open', () => {
      // identify client capability
      try { ws.send(JSON.stringify({ type: 'hello', kind: 'terminal-client' })); } catch {}
    });
    ws.addEventListener('message', (evt: MessageEvent) => {
      // downstream events from server, e.g., remote echo, prompts
      try {
        const data = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;
        if (data?.type === 'insert' && typeof data.text === 'string') {
          for (const ch of Array.from(data.text)) this.line.insert(ch);
          this.emitUpdate();
        }
      } catch {
        // ignore non-JSON
      }
    });
  }

  private emitUpdate() {
    this.onUpdate?.({ line: this.line.text, cursor: this.line.getCursor() });
  }

  private submitLine() {
    const value = this.line.text;
    this.onSubmit?.(value);
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.send(JSON.stringify({ type: 'input', line: value })); } catch {}
    }
    this.line.clear();
    this.emitUpdate();
  }

  // Process a single key event
  handleKey(ev: KeyEvent) {
    const { key, ctrl } = ev;
    if (ctrl && key.toLowerCase() === 'c') {
      // send interrupt
      if (this.ws && this.ws.readyState === 1) {
        try { this.ws.send(JSON.stringify({ type: 'signal', sig: 'INT' })); } catch {}
      }
      return;
    }

    switch (key) {
      case 'Enter':
        this.submitLine();
        return;
      case 'Backspace':
        this.line.backspace();
        this.emitUpdate();
        return;
      case 'Delete':
        this.line.delete();
        this.emitUpdate();
        return;
      case 'ArrowLeft':
        this.line.moveLeft();
        this.emitUpdate();
        return;
      case 'ArrowRight':
        this.line.moveRight();
        this.emitUpdate();
        return;
      case 'Home':
        this.line.moveHome();
        this.emitUpdate();
        return;
      case 'End':
        this.line.moveEnd();
        this.emitUpdate();
        return;
      default:
        // printable characters
        if (key.length === 1) {
          this.line.insert(key);
          this.emitUpdate();
        }
        return;
    }
  }

  // Main async processing loop (akin to tokio::select over event and tick streams)
  async run(signal?: AbortSignal) {
    this.running = true;
    const abortPromise = new Promise<never>((_, reject) => {
      if (signal) {
        if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }
    });

    try {
      for await (const ev of this.events()) {
        // emulate select with race between abort and event processing
        await Promise.race([
          (async () => {
            switch (ev.type) {
              case 'key':
                this.handleKey(ev.event);
                break;
              case 'resize':
                // could inform server of terminal size
                if (this.ws && this.ws.readyState === 1) {
                  try { this.ws.send(JSON.stringify({ type: 'resize', cols: ev.cols, rows: ev.rows })); } catch {}
                }
                break;
              case 'tick':
                // periodic heartbeat
                if (this.ws && this.ws.readyState === 1) {
                  try { this.ws.send(JSON.stringify({ type: 'tick' })); } catch {}
                }
                break;
            }
          })(),
          abortPromise,
        ]);
      }
    } finally {
      this.running = false;
    }
  }
}

// Helper to wire a DOM element as a simple terminal input
export function attachTerminalInput(el: HTMLElement, opts: {
  ws?: WebSocketLike;
  onSubmit?: (line: string) => void;
  onUpdate?: (s: { line: string; cursor: number }) => void;
  tickMs?: number;
} = {}) {
  const handler = new TerminalInputHandler(opts);
  const detach = handler.attachDOM(el);
  handler.run().catch(() => {});
  return { handler, detach };
}
