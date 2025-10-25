# Universal Input

A2A Universal Input provides a single, extensible entry-point for all user inputs across chat, command, and form-driven workflows. It unifies three input modes, contextual chips, and a developer toolbelt into a consistent surface that integrates seamlessly with existing A2A agents and actions.

---

## 1) Architecture and Design

- Core concepts
  - Input Surface: Primary UI component that captures user intent. Renders as chat composer by default, and can switch to Command or Form modes.
  - Input Modes: Chat, Command, and Form modes share a common context model and event bus.
  - Context Chips: Structured, typed tokens that encode ambient context (files, URLs, code selections, repo paths, environment, workspace vars, model hints).
  - Input Toolbelt: Extensible set of utilities surfaced adjacent to the composer (attachments, quick actions, templates, history, snippets, variables, API callers).
  - Event Bus: Pub/sub for InputRequested, ContextUpdated, ToolInvoked, SubmitRequested, Cancelled, ValidationError, and ModeChanged.
  - Resolver Pipeline: Normalizes raw input + context chips + toolbelt mutations into a canonical InputRequest the agent layer consumes.
  - Agent Integration: Agents subscribe to InputRequest events and reply with AgentTask plans or direct Actions.

- Data model
  - InputRequest
    - id: string
    - mode: "chat" | "command" | "form"
    - text: string
    - context: ContextChip[]
    - attachments: Attachment[]
    - metadata: Record<string, any>
    - flags: { streaming?: boolean; dryRun?: boolean; safeMode?: boolean }
  - ContextChip
    - type: string (e.g., "file", "url", "repo", "selection", "env", "var", "model")
    - label: string
    - value: any
    - scope: "ephemeral" | "session" | "global"
    - locked?: boolean
  - Attachment { name, kind: "file"|"image"|"audio"|"video"|"blob", url?: string, bytes?: Uint8Array, mime?: string }

- Flow
  1. User types or switches mode -> ModeChanged(mode)
  2. Adds context chips / toolbelt mutations -> ContextUpdated
  3. Submit -> Validate -> Resolve -> Emit InputRequest
  4. Agent receives request -> plans actions -> streams results
  5. Toolbelt can update context mid-run (interactive mode)

- Extensibility
  - ModeRegistry: register new modes with validators, serializers, UI renderers
  - ChipRegistry: define new chip types with schema and renderers
  - ToolbeltRegistry: pluggable tools with permissions and capability descriptors

---

## 2) Using the Three Input Modes

- Chat Mode
  - Purpose: Natural language conversation with agents, multi-turn context.
  - Usage: Type free-form text, add chips (files/URLs/selection), press Enter.
  - Behavior: Streams responses; supports slash-commands and inline variables like ${var}.

- Command Mode
  - Purpose: Deterministic, terse commands for precise agent tasks.
  - Syntax: /verb [target] --flag=value --flag2 value @chipRef
  - Autocomplete: verbs, flags, chip refs, repo paths.
  - Example: /test packages/web --watch --filter ui @selection

- Form Mode
  - Purpose: Structured submissions with validated fields.
  - Usage: Mode switches to a schema-driven form (Zod/JSON Schema).
  - Behavior: Client-side validation; submit yields normalized InputRequest with field map and provenance.

Mode switching shortcuts
- Ctrl/Cmd+1: Chat, Ctrl/Cmd+2: Command, Ctrl/Cmd+3: Form

---

## 3) Context Chips Configuration

- Built-in chips
  - file: { path, repoRef?, revision? }
  - url: { href }
  - selection: { file, range: { start, end }, textPreview }
  - repo: { root, branch, sparsePaths? }
  - env: { name, value }
  - var: { name, value, secret?: boolean }
  - model: { provider, name, temperature?, maxTokens? }

- Chip creation
  - Drag-and-drop a file, paste a URL, or use the + chip menu.
  - Programmatic: ChipRegistry.create(type, props)

- Chip scopes
  - ephemeral: applies once to the next submission
  - session: persists for the current chat/thread
  - global: persists across sessions

- Validation
  - Each chip type provides a validator; failing chips are highlighted with error messages.

- Serialization
  - Chips are included in InputRequest.context as a stable, typed payload.

---

## 4) Input Toolbelt Features

Common tools (toggleable via ToolbeltRegistry):
- Attachments: files, images, audio/video, blobs
- Quick Actions: one-click templates for frequent tasks (e.g., "Summarize diff", "Write test")
- Snippets: saved prompts/commands with variables
- Variables: define and insert ${vars}
- History: recall previous InputRequests and re-submit
- API Caller: compose REST/GraphQL request, store as chip
- Model Switcher: set model chip
- Safety: safe-mode toggle limiting write actions

Developer hooks
- beforeSubmit(request): mutate
- onResolve(resolved): observe
- onResult(stream): tap agent output
- permissions(request): assert tool preconditions

---

## 5) Integration with Existing A2A Agents

- Agent contract
  - Agents listen for InputRequest events with a declared capability set
  - Capability routing: Chat inputs -> ConversationalAgent; Command -> TaskAgent; Form -> WorkflowAgent

- Minimal integration example
```ts
import { inputBus } from "@a2a/universal-input";
import { MyAgent } from "@a2a/agents";

const agent = new MyAgent();
inputBus.on("InputRequest", async (req) => {
  if (!agent.supports(req.mode)) return;
  const plan = await agent.plan(req);
  for await (const chunk of agent.execute(plan)) {
    // stream to UI
  }
});
```

- Context translation
  - file/url/repo chips map to the AgentFS abstraction
  - selection chips provide code focus for analyzers
  - vars/env are exposed via agent.context.get(name)

- Error handling
  - Agents should return ValidationError with actionable hints; UI will surface inline

---

## 6) API Reference

Types
```ts
export type InputMode = "chat" | "command" | "form";
export interface InputRequest {
  id: string;
  mode: InputMode;
  text: string;
  context: ContextChip[];
  attachments: Attachment[];
  metadata?: Record<string, any>;
  flags?: { streaming?: boolean; dryRun?: boolean; safeMode?: boolean };
}
export interface ContextChip<T = any> {
  type: string;
  label: string;
  value: T;
  scope: "ephemeral" | "session" | "global";
  locked?: boolean;
}
export interface Attachment {
  name: string;
  kind: "file"|"image"|"audio"|"video"|"blob";
  url?: string;
  bytes?: Uint8Array;
  mime?: string;
}
```

Events
```ts
interface InputEvents {
  InputRequested: (draft: Partial<InputRequest>) => void;
  ModeChanged: (mode: InputMode) => void;
  ContextUpdated: (chips: ContextChip[]) => void;
  SubmitRequested: (req: InputRequest) => void;
  ToolInvoked: (toolId: string, data?: any) => void;
  ValidationError: (errors: Array<{ path: string; message: string }>) => void;
}
```

Registries
```ts
ModeRegistry.register({
  id: "command",
  title: "Command",
  validate: (req) => [],
  serialize: (uiState) => InputRequest,
  render: (props) => ReactNode,
});

ChipRegistry.register<{ href: string }>("url", {
  validator: (chip) => chip.value?.href ? [] : [{ path: "href", message: "Required" }],
  renderLabel: (chip) => chip.label ?? new URL(chip.value.href).hostname,
});

ToolbeltRegistry.register({
  id: "api-caller",
  title: "API Caller",
  permissions: () => ({ network: true }),
  invoke: async (ctx) => { /* open composer */ },
});
```

---

## 7) Examples and Use Cases

- Code review summarize
  - Mode: Chat
  - Chips: repo@branch, selection (diff)
  - Prompt: "Summarize the key risks and list refactor suggestions"

- Deterministic test runner
  - Mode: Command
  - Command: `/test packages/web --watch --filter ui`
  - Chips: env { NODE_ENV=tests }

- Release form
  - Mode: Form
  - Schema: version (semver), notes (markdown), impact (enum)
  - Output: InputRequest -> ReleaseAgent -> create GitHub release

- API exploration
  - Mode: Toolbelt API Caller -> stores as chip
  - Submit in Chat with context summarization of JSON payload

- Multi-file transform
  - Mode: Command
  - Chips: repo, file glob, model config
  - Command: `/codemod src/**/*.ts --rule react-18 --apply`

---

## Notes

- Universal Input is designed to be framework-agnostic; the examples use TypeScript types for clarity.
- Security: Toolbelt items run with least privilege and must declare permissions.
- Telemetry: Events can be observed for UX analytics with user consent.
