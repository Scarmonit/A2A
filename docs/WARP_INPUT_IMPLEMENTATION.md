# Warp Input System Implementation

## Challenge overview
- Goal: Implement a robust, low-latency terminal input layer compatible with Warp-style UX (modal editing, prompt-aware input, rich keybindings, IME, and multi-platform support) across TUI backends.
- Scope: Wire terminal event sources to an input state machine, normalize keys across OS/terminals, integrate with rendering loop, and expose a composable API for commands, bindings, and plugins.

## Step-by-step implementation

### 1) Locate relevant code
- Search repo for terminal, input, key, crossterm, ratatui, xterm, event, and TUI modules.
- Identify:
  - Event source adapters (crossterm/rustix/termios/node-pty/xterm.js).
  - Input processor/state machine (key maps, modes, command palette, prompt integration).
  - Renderer loop and frame scheduler (Ratatui or similar) where input is polled/awaited.
  - Feature flags for platform/TTY detection.

### 2) Modify components
- Introduce an InputCore abstraction with traits/interfaces:
  - EventSource: produces normalized InputEvent (Key, Paste, Mouse, Resize, IME, Focus, Clipboard).
  - Mapper: maps raw events -> CanonicalKey (with modifiers, repeat, semantic meaning, and textual payload).
  - State: editor-like modes (Insert, Normal, Visual, Prompt, Command, Search), cursor and selection model.
  - Dispatcher: routes mapped events through bindings in priority order (modal > component > global).
  - Actions: high-level intents (MoveCursor, DeleteWord, AcceptLine, Execute, TogglePanel, etc.).
- Add composition points:
  - Component-local handlers can intercept before bubble to app-level.
  - Context object carries app state and capability flags (supports_mouse, supports_bracketed_paste, supports_kitty_keyboard).

### 3) Build and test
- Unit tests: mapping tables, modality transitions, repeat counts, dead keys/IME composition, bracketed paste handling.
- Integration tests (headless): snapshot of input -> state diff; golden tests for prompts and keybindings.
- Manual tests:
  - Windows: PowerShell/ConHost + Windows Terminal with crossterm.
  - macOS/Linux: iTerm2, Kitty, Alacritty; test kitty keyboard protocol if enabled.
  - Browser: xterm.js with node-pty backend.
- Performance: measure end-to-end latency from keydown to render commit; target < 16ms typical, < 8ms for burst typing.

## Architecture details
- Event flow:
  - Backend (crossterm/xterm) -> EventSource -> Mapper -> Dispatcher -> Action -> State update -> Render.
- Normalization strategies:
  - Resolve platform-specific differences (e.g., Alt as Meta/Esc prefix, Ctrl+Space/NUL, Ctrl+[ vs Esc).
  - Distinguish printable text vs control keys; carry UTF-8 text separately from key code.
  - Reify key repeats with repeat count; coalesce rapid repeats for performance.
- Modes and prompts:
  - Prompt-aware input routes Enter to AcceptLine when prompt active, otherwise Insert newline.
  - Command mode parses :commands with history; Search mode uses incremental filtering with shared keymaps.
- Bracketed paste and safety:
  - Enable bracketed paste when supported; treat paste as a single transaction with optional sanitizer and confirmation for multi-line or suspicious content.
- IME and dead keys:
  - Maintain a composition buffer; only commit composed text on CompositionEnd; render preedit underlines when supported.
- Mouse and selection:
  - Support cell-precise selection, word/line selection with double/triple click; shift-extend selection.

## Terminal input handling patterns (Ratatui/Crossterm)
- Enable raw mode and alternate screen; enable mouse capture and bracketed paste as feature flags.
- Non-blocking event loop with polling timeout tied to frame budget (e.g., 8-12ms):
  - Drain events per tick; batch redraws; debounce resize.
- Key event mapping examples:
  - Map crossterm::event::KeyEvent { code: Char('h'), modifiers: CONTROL } -> Action::MoveLeftWord when in Normal.
  - Map KeyCode::Enter with no modifiers -> Action::AcceptLine in Prompt; otherwise insert '\n'.
  - Map KeyCode::Tab/BackTab -> cycle focus or complete.
- Bracketed paste: treat Event::Paste(String) distinctly; skip per-char processing.
- Kitty keyboard protocol (if enabled): provides unambiguous modifier and key identity; gracefully fall back to standard sequences when unavailable.

## TypeScript integration patterns (xterm.js)
- Use xterm.js for rendering with addons: fit, webLinks, search, unicode11, ligatures as needed.
- Event wiring:
  - term.onKey(e => mapper.fromDomKey(e.domEvent, e.key));
  - term.onData(s => source.onText(s)) for printable text when necessary.
  - term.onPaste(text => source.onPaste(text));
  - term.onSelectionChange to synchronize selection model.
  - Handle IME with onCompositionStart/Update/End via the textarea; show preedit decorations.
- Backend with node-pty:
  - Spawn shell; forward input produced by dispatcher to pty.write().
  - For prompt-aware features, intercept before forwarding and echo locally when appropriate.
- Clipboard and permissions: use navigator.clipboard where available, fallback shortcuts otherwise.

## Optimization strategies
- Minimize allocations in hot path: reuse event objects, smallvec for modifier stacks, ring buffer for history.
- Batch renders: commit at most one frame per raf/tick; coalesce multiple state updates.
- Fast-path printable text: bypass dispatcher when in Insert and no interceptors.
- Keymap lookup via perfect-hash or trie; avoid string-based maps.
- Feature detection at startup; avoid runtime branching in hot path.
- Telemetry hooks for latency and error rates; expose debug overlay to visualize event pipeline.
- Guardrails: rate-limit paste rendering; cap history; protect against runaway key repeat.

## Appendix: Testing checklist
- Keys: arrows, home/end, page up/down, function keys, alt/meta combos, Ctrl+Space, Ctrl+[.
- Pasting: small/large, multi-line, bracketed, with ANSI escapes.
- IME: composition for CJK, dead keys for accents.
- Mouse: selection, wheel scroll, shift-extend, double/triple clicks.
- Resize: debounce; maintain cursor and selection invariants.
- Cross-platform: Linux/macOS/Windows terminals; browser with xterm.js.
