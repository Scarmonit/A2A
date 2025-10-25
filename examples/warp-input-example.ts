// warp-input-example.ts
// Demonstrates: terminal input initialization, event handling, Git Diff chip rendering,
// font size adjustments, semantic code search, and build system integration.
// This file is self-contained and uses TypeScript types and robust error handling.

/*
  Assumptions:
  - A2A exposes typed helper APIs for Warp integration, semantic search, and build tools.
  - This example uses hypothetical but strongly-typed facades that mirror patterns used in
    other examples in this repo (e.g., greenlet integration, copilot integration, etc.).
  - Replace adapters with your project’s actual modules if names differ.
*/

//#region Types

type Disposable = { dispose(): void };

interface Terminal {
  readonly id: string;
  element: HTMLElement;
  fontSize: number;
  write(text: string): void;
  onData(cb: (data: string) => void): Disposable;
  onKey(cb: (ev: { key: string; domEvent: KeyboardEvent }) => void): Disposable;
  onResize(cb: (cols: number, rows: number) => void): Disposable;
}

interface GitDiffHunk {
  filePath: string;
  added: number;
  removed: number;
  summary: string; // e.g., "+12 -3 in src/foo.ts"
}

interface SemanticSearchResult {
  filePath: string;
  line: number;
  score: number; // higher is better
  snippet: string;
}

interface BuildResult {
  success: boolean;
  durationMs: number;
  logs: string;
  errors?: Array<{ file: string; message: string; line?: number; col?: number }>;
}

//#endregion

//#region Safe helpers

function safeQuery<T extends Element>(selector: string, parent: ParentNode = document): T {
  const el = parent.querySelector(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el as T;
}

function tryOrThrow<T>(label: string, fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${label} failed: ${message}`);
  }
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms = 200): T {
  let t: number | undefined;
  return ((...args: any[]) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  }) as T;
}

//#endregion

//#region Mock/adapter facades

// In a real project, import concrete implementations instead of these placeholders.
const Warp = {
  initTerminal: (opts: { container: HTMLElement; fontSize?: number }): Terminal => {
    // Minimal mock using a pre-styled div as the terminal surface
    const termEl = document.createElement('div');
    termEl.setAttribute('data-terminal', 'warp');
    termEl.style.cssText = `
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      background: #0b0f16; color: #e6edf3; padding: 12px; border-radius: 8px; min-height: 200px; white-space: pre-wrap;
    `;
    opts.container.appendChild(termEl);

    let fontSize = opts.fontSize ?? 13;
    termEl.style.fontSize = `${fontSize}px`;

    const listeners = {
      data: new Set<(d: string) => void>(),
      key: new Set<(ev: { key: string; domEvent: KeyboardEvent }) => void>(),
      resize: new Set<(c: number, r: number) => void>(),
    };

    // Simulate input capture via a hidden textarea
    const input = document.createElement('textarea');
    input.style.cssText = 'position:absolute;left:-9999px;opacity:0;';
    document.body.appendChild(input);

    const write = (text: string) => {
      termEl.textContent += text;
    };

    const onData = (cb: (data: string) => void): Disposable => {
      listeners.data.add(cb);
      return { dispose: () => listeners.data.delete(cb) };
    };
    const onKey = (cb: (ev: { key: string; domEvent: KeyboardEvent }) => void): Disposable => {
      listeners.key.add(cb);
      return { dispose: () => listeners.key.delete(cb) };
    };
    const onResize = (cb: (c: number, r: number) => void): Disposable => {
      listeners.resize.add(cb);
      return { dispose: () => listeners.resize.delete(cb) };
    };

    const id = `warp-term-${Math.random().toString(36).slice(2, 8)}`;

    const term: Terminal = {
      id,
      element: termEl,
      get fontSize() { return fontSize },
      set fontSize(v: number) { fontSize = v; termEl.style.fontSize = `${v}px`; },
      write,
      onData,
      onKey,
      onResize,
    };

    // Focus handler to capture keystrokes
    termEl.tabIndex = 0;
    termEl.addEventListener('focus', () => input.focus());
    termEl.addEventListener('click', () => input.focus());

    input.addEventListener('input', () => {
      const value = input.value;
      input.value = '';
      listeners.data.forEach(cb => cb(value));
    });

    window.addEventListener('keydown', (ev) => {
      listeners.key.forEach(cb => cb({ key: ev.key, domEvent: ev }));
    });

    const onWindowResize = debounce(() => {
      // naive cols/rows calc based on container width/height and font metrics
      const cols = Math.max(20, Math.floor(termEl.clientWidth / (fontSize * 0.6)));
      const rows = Math.max(5, Math.floor(termEl.clientHeight / (fontSize * 1.8)));
      listeners.resize.forEach(cb => cb(cols, rows));
    }, 100);
    window.addEventListener('resize', onWindowResize);

    // Initial render
    write(`Warp terminal ready (id=${id})\n`);

    return term;
  },
};

const Git = {
  getDiffSummary: async (): Promise<GitDiffHunk[]> => {
    // Placeholder data; in real usage, call your git layer or backend
    return [
      { filePath: 'src/app.ts', added: 12, removed: 3, summary: '+12 -3 in src/app.ts' },
      { filePath: 'src/utils/format.ts', added: 4, removed: 1, summary: '+4 -1 in src/utils/format.ts' },
    ];
  },
};

const Semantic = {
  search: async (query: string): Promise<SemanticSearchResult[]> => {
    // Placeholder results; replace with your vector/embedding-based search
    const corpus: SemanticSearchResult[] = [
      { filePath: 'src/app.ts', line: 42, score: 0.91, snippet: 'initializeTerminal(container)' },
      { filePath: 'src/terminal/input.ts', line: 12, score: 0.88, snippet: 'onData((s) => ... )' },
      { filePath: 'src/build/index.ts', line: 5, score: 0.81, snippet: 'runBuild({ mode: "watch" })' },
    ];
    // Simulate basic ranking by substring match
    return corpus
      .filter(x => x.snippet.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.score - a.score);
  },
};

const Build = {
  run: async (opts: { mode: 'once' | 'watch' }): Promise<BuildResult> => {
    const started = performance.now();
    // Simulate a build
    await new Promise(r => setTimeout(r, 250));
    return {
      success: true,
      durationMs: Math.round(performance.now() - started),
      logs: `[build] mode=${opts.mode} completed successfully`,
    };
  },
};

//#endregion

//#region UI helpers

function renderChip(text: string, color = '#1f6feb'): HTMLElement {
  const chip = document.createElement('span');
  chip.textContent = text;
  chip.style.cssText = `
    display:inline-block;padding:2px 8px;border-radius:9999px;background:${color};color:#fff;font-weight:600;margin-right:6px;margin-bottom:6px;
  `;
  return chip;
}

function renderGitDiffChips(container: HTMLElement, hunks: GitDiffHunk[]): void {
  container.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = 'Git Diff Summary';
  title.style.cssText = 'font-weight:700;margin:8px 0;';
  container.appendChild(title);
  for (const h of hunks) {
    const chip = renderChip(`${h.summary}`, h.added >= h.removed ? '#238636' : '#b62324');
    chip.title = h.filePath;
    container.appendChild(chip);
  }
}

//#endregion

//#region Example wiring

export async function setupWarpInputDemo(rootSelector = '#app'): Promise<void> {
  const root = tryOrThrow('root container', () => safeQuery<HTMLElement>(rootSelector));

  const shell = document.createElement('div');
  shell.style.cssText = 'display:grid;grid-template-columns:2fr 1fr;gap:16px;align-items:start;';

  const termContainer = document.createElement('div');
  const sidePanel = document.createElement('div');
  sidePanel.style.cssText = 'background:#0a0f15;border:1px solid #1f2630;border-radius:8px;padding:12px;color:#c9d1d9;';

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';

  const fontDown = document.createElement('button');
  fontDown.textContent = 'A-';
  const fontUp = document.createElement('button');
  fontUp.textContent = 'A+';

  const queryInput = document.createElement('input');
  queryInput.type = 'search';
  queryInput.placeholder = 'Semantic code search…';
  queryInput.style.cssText = 'width:100%;padding:6px;border-radius:6px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;';

  const results = document.createElement('div');
  const gitChips = document.createElement('div');

  controls.append(fontDown, fontUp);
  sidePanel.append(controls, queryInput, results, gitChips);
  shell.append(termContainer, sidePanel);
  root.appendChild(shell);

  // 1) Terminal input initialization
  const terminal = tryOrThrow('Warp.initTerminal', () => Warp.initTerminal({ container: termContainer, fontSize: 13 }));

  // 2) Event handling (data, key, resize)
  const disposables: Disposable[] = [];
  disposables.push(
    terminal.onData((data) => {
      try {
        terminal.write(`\n$ ${data}`);
      } catch (e) {
        console.error('onData handler error', e);
      }
    }),
    terminal.onKey((ev) => {
      try {
        if (ev.key === 'Enter') terminal.write('\n');
        if (ev.key === 'c' && ev.domEvent.ctrlKey) terminal.write('^C');
      } catch (e) {
        console.error('onKey handler error', e);
      }
    }),
    terminal.onResize((cols, rows) => {
      try {
        terminal.write(`\n[resize ${cols}x${rows}]`);
      } catch (e) {
        console.error('onResize handler error', e);
      }
    }),
  );

  // 3) Git Diff chip rendering
  try {
    const hunks = await Git.getDiffSummary();
    renderGitDiffChips(gitChips, hunks);
  } catch (e) {
    console.error('Failed to load git diff', e);
    gitChips.textContent = 'Failed to load git diff.';
  }

  // 4) Font size adjustments
  fontDown.addEventListener('click', () => {
    try { terminal.fontSize = Math.max(8, terminal.fontSize - 1); } catch (e) { console.error('font - error', e); }
  });
  fontUp.addEventListener('click', () => {
    try { terminal.fontSize = Math.min(24, terminal.fontSize + 1); } catch (e) { console.error('font + error', e); }
  });

  // 5) Semantic code search
  const runSearch = debounce(async () => {
    const q = queryInput.value.trim();
    results.innerHTML = '';
    if (!q) return;
    try {
      const list = await Semantic.search(q);
      if (list.length === 0) {
        results.textContent = 'No results.';
        return;
      }
      for (const r of list) {
        const row = document.createElement('div');
        row.style.cssText = 'padding:6px 0;border-bottom:1px solid #30363d;';
        row.innerHTML = `<strong>${r.filePath}:${r.line}</strong> · score ${r.score.toFixed(2)}<br><code>${r.snippet}</code>`;
        results.appendChild(row);
      }
    } catch (e) {
      console.error('semantic search error', e);
      results.textContent = 'Search failed.';
    }
  }, 250);
  queryInput.addEventListener('input', runSearch);

  // 6) Build system integration
  try {
    const build = await Build.run({ mode: 'once' });
    const status = document.createElement('div');
    status.style.cssText = 'margin-top:8px;color:' + (build.success ? '#3fb950' : '#f85149');
    status.textContent = build.success
      ? `Build succeeded in ${build.durationMs}ms`
      : `Build failed in ${build.durationMs}ms`;
    sidePanel.appendChild(status);
    if (!build.success && build.errors?.length) {
      const errBox = document.createElement('pre');
      errBox.style.cssText = 'white-space:pre-wrap;background:#161b22;padding:8px;border-radius:6px;overflow:auto;';
      errBox.textContent = build.errors.map(e => `${e.file}: ${e.message}${e.line ? ` (${e.line}:${e.col ?? 1})` : ''}`).join('\n');
      sidePanel.appendChild(errBox);
    }
  } catch (e) {
    console.error('build run error', e);
  }
}

// Auto-run if #app exists
if (typeof window !== 'undefined') {
  try {
    if (document.querySelector('#app')) {
      setupWarpInputDemo('#app').catch(err => console.error('setupWarpInputDemo error', err));
    }
  } catch (e) {
    console.error('autorun guard error', e);
  }
}
