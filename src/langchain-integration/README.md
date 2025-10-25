# LangChain Integration: Autonomous Agent Deployment

This module implements **TRUE autonomous agent deployment** for the A2A MCP Server. It analyzes natural language tasks, selects appropriate agents based on their capabilities, and deploys them automatically without manual intervention.

## What This Solves

### The Problem

The original A2A repository claimed to "autonomously deploy agents" but actually only provided:
- ✅ Autonomous **tool** execution (pattern detection → auto-execute actions)
- ✅ Autonomous **workflow** orchestration
- ❌ **NO** autonomous agent deployment (agents must be manually deployed via `agentRegistry.deploy()`)

### The Solution

This module adds the missing piece:
- ✅ **Autonomous agent selection** based on task analysis
- ✅ **Intelligent capability matching** using LangChain + LLM
- ✅ **Automatic agent deployment** without manual intervention
- ✅ **Execution plan generation** with confidence scoring
- ✅ **End-to-end task orchestration** from description to results

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Natural Language Task                     │
│          "Scrape news from example.com and analyze"         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Task Understanding Service                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Analyze task with LangChain + Ollama             │  │
│  │ 2. Extract: domain, actions, capabilities           │  │
│  │ 3. Determine complexity and dependencies             │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Agent Selection Logic                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Query agent registry for available agents        │  │
│  │ 2. Score agents based on capability match           │  │
│  │ 3. Rank by suitability (primary/secondary/optional) │  │
│  │ 4. Generate recommendations with reasoning           │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           Autonomous Deployment Orchestrator                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Deploy recommended agents to registry            │  │
│  │ 2. Generate execution steps with dependencies        │  │
│  │ 3. Execute plan step-by-step                         │  │
│  │ 4. Track progress and handle errors                  │  │
│  │ 5. Return results                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Execution Results                         │
│    Status, deployed agents, step results, timing            │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Task Understanding Service (`task-understanding.ts`)

Analyzes natural language tasks using LangChain and Ollama.

**Features:**
- Natural language parsing with LLM
- Domain classification (web_automation, data_processing, etc.)
- Action extraction (scrape, analyze, deploy, etc.)
- Capability matching
- Complexity assessment
- Fallback rule-based analysis (when LLM unavailable)

**Example:**
```typescript
import { taskUnderstandingService } from './task-understanding.js';

const requirements = await taskUnderstandingService.analyzeTask(
  "Scrape product prices from Amazon and analyze trends"
);

console.log(requirements);
// {
//   description: "Scrape product prices...",
//   domain: "web_automation",
//   actions: ["scrape", "analyze"],
//   requiredCapabilities: ["http_request", "data_transform"],
//   complexity: "moderate",
//   estimatedSteps: 3
// }
```

### 2. Agent Selection Logic (`task-understanding.ts`)

Intelligently selects agents based on task requirements.

**Scoring Algorithm:**
- Category match: +0.5 score
- Capability match: +0.3 per capability
- Tag match: +0.1 per tag
- Normalized to 0-1 range
- Minimum score: 0.3 (filtered out below this)

**Roles:**
- **Primary** (score ≥ 0.7): Essential for task completion
- **Secondary** (0.5 ≤ score < 0.7): Helpful but not essential
- **Optional** (0.3 ≤ score < 0.5): Nice to have

**Example:**
```typescript
const recommendations = await taskUnderstandingService.selectAgents(
  requirements,
  agentRegistry.list({ enabled: true })
);

console.log(recommendations);
// [
//   {
//     agentId: "web-scraper-1",
//     agentName: "Web Scraper",
//     score: 0.85,
//     reasoning: "Category: web_automation, Matching capabilities: http_request",
//     capabilities: ["http_request", "html_parse"],
//     role: "primary"
//   },
//   ...
// ]
```

### 3. Autonomous Orchestrator (`autonomous-orchestrator.ts`)

Coordinates end-to-end autonomous execution.

**Features:**
- Automatic agent deployment
- Step-by-step execution with dependencies
- Progress tracking
- Timeout handling
- Error recovery
- Execution history
- Statistics and monitoring

**Example:**
```typescript
import { createAutonomousOrchestrator } from './autonomous-orchestrator.js';
import { agentRegistry } from '../agents.js';

const orchestrator = createAutonomousOrchestrator(agentRegistry);

const execution = await orchestrator.executeTask(
  "Test the API at https://api.example.com/health and report status",
  {
    autoDeploy: true,
    minConfidence: 0.6,
    maxAgents: 3,
    timeout: 30000,
    onProgress: (exec) => {
      console.log(`Status: ${exec.status}`);
    }
  }
);

console.log(execution);
// {
//   taskId: "auto-task-1234...",
//   status: "completed",
//   deployedAgents: ["api-tester-1"],
//   executionResults: [
//     { step: 1, agentId: "api-tester-1", success: true, result: {...} }
//   ],
//   startTime: 1634567890000,
//   endTime: 1634567895000
// }
```

## Setup

### Prerequisites

1. **Ollama** must be running locally:
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Download a model
ollama pull llama2:7b-chat

# Verify it's running
curl http://localhost:11434/api/version
```

2. **Environment variables** in `.env`:
```env
LOCAL_LLM_URL=http://localhost:11434
DEFAULT_CHAT_MODEL=llama2:7b-chat
LOG_LEVEL=info
```

3. **Install dependencies** (already done if you ran `npm install`):
```bash
npm install langchain zod
```

### Enable in Your Code

Uncomment the imports in `src/index.ts`:

```typescript
// Uncomment these lines:
import { createAutonomousOrchestrator } from './langchain-integration/autonomous-orchestrator.js';
import { taskUnderstandingService } from './langchain-integration/task-understanding.js';

// Then use:
const orchestrator = createAutonomousOrchestrator(agentRegistry);
```

## Usage Examples

### Example 1: Simple Web Scraping Task

```typescript
const execution = await orchestrator.executeTask(
  "Scrape the latest headlines from news.ycombinator.com"
);

if (execution.status === 'completed') {
  console.log('Success! Deployed agents:', execution.deployedAgents);
  console.log('Results:', execution.executionResults);
}
```

### Example 2: Complex Multi-Step Task

```typescript
const execution = await orchestrator.executeTask(
  "Deploy the application to production, run health checks, and send a Slack notification",
  {
    requireApproval: true,
    onApprovalRequest: async (plan) => {
      console.log('Plan:', plan);
      console.log('Recommended agents:', plan.recommendedAgents.length);
      console.log('Estimated duration:', plan.estimatedDuration, 'ms');
      console.log('Confidence:', plan.confidence);

      // Require user confirmation for deployments
      return confirm('Approve this plan?');
    }
  }
);
```

### Example 3: Progress Monitoring

```typescript
const execution = await orchestrator.executeTask(
  "Analyze the security vulnerabilities in the codebase",
  {
    onProgress: (exec) => {
      console.log(`[${exec.taskId}] Status: ${exec.status}`);

      if (exec.status === 'planning' && exec.plan) {
        console.log(`Confidence: ${exec.plan.confidence}`);
        console.log(`Agents: ${exec.plan.recommendedAgents.length}`);
      }

      if (exec.status === 'executing') {
        const completed = exec.executionResults.filter(r => r.success).length;
        const total = exec.plan?.executionSteps.length || 0;
        console.log(`Progress: ${completed}/${total} steps completed`);
      }
    }
  }
);
```

### Example 4: Error Handling

```typescript
try {
  const execution = await orchestrator.executeTask(
    "Perform an impossible task that no agent can handle",
    {
      minConfidence: 0.8  // High confidence requirement
    }
  );
} catch (error) {
  console.error('Task failed:', error.message);
  // "Plan confidence 0.3 is below minimum 0.8. Task may be too ambiguous..."
}
```

### Example 5: Monitoring and Statistics

```typescript
// Get active executions
const active = orchestrator.getActiveExecutions();
console.log(`${active.length} tasks currently running`);

// Get execution history
const history = orchestrator.getExecutionHistory(10);
console.log('Last 10 executions:', history);

// Get statistics
const stats = orchestrator.getStats();
console.log('Statistics:', stats);
// {
//   total: 42,
//   active: 2,
//   completed: 35,
//   failed: 3,
//   cancelled: 2,
//   successRate: 0.833,
//   avgDuration: 8543
// }
```

## API Reference

### TaskUnderstandingService

#### `analyzeTask(taskDescription: string): Promise<TaskRequirements>`

Analyzes a natural language task and extracts structured requirements.

**Returns:**
```typescript
{
  description: string;
  domain: 'web_automation' | 'data_processing' | ...;
  actions: string[];
  requiredCapabilities: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedSteps: number;
}
```

#### `selectAgents(requirements: TaskRequirements, availableAgents: AgentDescriptor[]): Promise<AgentRecommendation[]>`

Selects and ranks agents based on task requirements.

**Returns:**
```typescript
[
  {
    agentId: string;
    agentName: string;
    score: number; // 0-1
    reasoning: string;
    capabilities: string[];
    role: 'primary' | 'secondary' | 'optional';
  },
  ...
]
```

#### `createExecutionPlan(taskDescription: string, availableAgents: AgentDescriptor[]): Promise<ExecutionPlan>`

Creates a complete execution plan for a task.

**Returns:**
```typescript
{
  taskId: string;
  requirements: TaskRequirements;
  recommendedAgents: AgentRecommendation[];
  executionSteps: Array<{
    step: number;
    description: string;
    agentId?: string;
    capability?: string;
    dependsOn?: number[];
  }>;
  estimatedDuration: number;
  confidence: number; // 0-1
}
```

### AutonomousOrchestrator

#### `executeTask(taskDescription: string, options?: AutoDeployOptions): Promise<AutonomousTaskExecution>`

Autonomously executes a task from start to finish.

**Options:**
```typescript
{
  autoDeploy?: boolean; // default: true
  minConfidence?: number; // default: 0.5
  maxAgents?: number; // default: 5
  timeout?: number; // default: 60000ms
  requireApproval?: boolean; // default: false
  onApprovalRequest?: (plan: ExecutionPlan) => Promise<boolean>;
  onProgress?: (execution: AutonomousTaskExecution) => void;
}
```

**Returns:**
```typescript
{
  taskId: string;
  description: string;
  status: 'pending' | 'analyzing' | 'planning' | 'deploying_agents' |
          'executing' | 'completed' | 'failed' | 'cancelled';
  plan?: ExecutionPlan;
  deployedAgents: string[];
  executionResults: Array<{
    step: number;
    agentId?: string;
    success: boolean;
    result?: any;
    error?: string;
    timestamp: number;
  }>;
  startTime: number;
  endTime?: number;
  error?: string;
}
```

#### `getActiveExecutions(): AutonomousTaskExecution[]`

Returns all currently running executions.

#### `getExecutionHistory(limit?: number): AutonomousTaskExecution[]`

Returns execution history (default: last 10).

#### `getExecution(taskId: string): AutonomousTaskExecution | undefined`

Gets a specific execution by ID.

#### `cancelExecution(taskId: string): boolean`

Cancels an active execution.

#### `getStats(): object`

Returns execution statistics.

## Configuration

### Environment Variables

```env
# LLM Configuration
LOCAL_LLM_URL=http://localhost:11434
DEFAULT_CHAT_MODEL=llama2:7b-chat
DEFAULT_FAST_MODEL=phi3:mini

# Logging
LOG_LEVEL=info  # debug | info | warn | error
```

### Customizing Prompts

You can customize the prompts in `task-understanding.ts`:

```typescript
const TASK_ANALYSIS_PROMPT = PromptTemplate.fromTemplate(`
Your custom task analysis prompt here...
`);
```

### Custom Agent Scoring

Override the scoring logic in `fallbackAgentSelection()`:

```typescript
// Custom scoring weights
const categoryWeight = 0.6;
const capabilityWeight = 0.3;
const tagWeight = 0.1;
```

## Performance

### Benchmarks

| Operation | Duration |
|-----------|----------|
| Task analysis | 1-3s (depends on LLM) |
| Agent selection | 1-2s (depends on agent count) |
| Execution plan creation | 2-5s |
| Agent deployment | <100ms per agent |
| Full task execution | 5-60s (depends on complexity) |

### Optimization Tips

1. **Use faster models** for simple tasks:
```env
DEFAULT_CHAT_MODEL=phi3:mini  # Faster but less capable
```

2. **Limit agent count**:
```typescript
orchestrator.executeTask(task, { maxAgents: 3 })
```

3. **Cache agent lists**:
```typescript
const availableAgents = agentRegistry.list({ enabled: true });
// Reuse this list for multiple tasks
```

4. **Adjust confidence threshold**:
```typescript
// Lower threshold = faster but potentially less accurate
orchestrator.executeTask(task, { minConfidence: 0.4 })
```

## Troubleshooting

### Ollama Connection Issues

```
Error: Ollama API error: ECONNREFUSED
```

**Solution:**
- Verify Ollama is running: `curl http://localhost:11434/api/version`
- Check `LOCAL_LLM_URL` in `.env`
- Try restarting Ollama: `ollama serve`

### Low Confidence Scores

```
Error: Plan confidence 0.3 is below minimum 0.5
```

**Solution:**
- Task may be too ambiguous - rephrase with more specifics
- Lower confidence threshold: `minConfidence: 0.3`
- Add more agents to registry that match the task
- Check if LLM is responding correctly (logs at `LOG_LEVEL=debug`)

### No Agents Selected

```
Plan has 0 recommended agents
```

**Solution:**
- Verify agents are enabled: `agentRegistry.list({ enabled: true })`
- Check if agent capabilities match task requirements
- Add more diverse agent types to registry
- Review agent categories and tags

### Execution Timeout

```
Error: Task execution timeout after 60000ms
```

**Solution:**
- Increase timeout: `timeout: 120000`
- Break down complex tasks into simpler subtasks
- Check if agents are hanging (review agent logs)

## Comparison: Before vs After

### Before (Without Phase 2)

```typescript
// Manual agent deployment
import { agentRegistry } from './agents.js';
import { agentExecutor } from './agent-executor.js';

// Step 1: User must know which agent to use
const agent = agentRegistry.get('web-scraper-1');

// Step 2: User must know which capability to invoke
const result = await agentExecutor.execute(
  'web-scraper-1',
  'http_request',
  { url: 'https://example.com' }
);

// NO autonomous deployment - everything is manual
```

### After (With Phase 2)

```typescript
// Autonomous agent deployment
import { createAutonomousOrchestrator } from './langchain-integration/index.js';

const orchestrator = createAutonomousOrchestrator(agentRegistry);

// Just describe what you want - the system handles everything
const execution = await orchestrator.executeTask(
  "Scrape data from https://example.com and analyze it"
);

// System automatically:
// 1. Analyzed the task
// 2. Selected appropriate agents (web scraper + data analyzer)
// 3. Deployed them
// 4. Executed in the right order
// 5. Returned results
```

## Next Steps

- **Phase 3**: Fix security vulnerability in workflow-orchestrator.ts
- **Phase 4**: Add Qdrant for vector-based memory search (enhances agent selection)
- **Phase 5**: Add OpenTelemetry for distributed tracing
- **Phase 6**: Add Redis for caching LLM responses and agent states

## Contributing

When adding new features:

1. Update prompts in `task-understanding.ts` for better analysis
2. Add new agent categories/domains as needed
3. Improve scoring algorithm in `fallbackAgentSelection()`
4. Add more sophisticated execution planning
5. Implement retry logic and error recovery strategies

## License

Same as parent A2A project.
