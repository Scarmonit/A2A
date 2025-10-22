# Greenlet A2A Integration Guide

## Overview

This guide covers the integration of Python's greenlet library with the A2A (Agent-to-Agent) TypeScript MCP server, enabling lightweight cooperative multitasking for AI agents.

## What is Greenlet?

Greenlet is a Python library that provides lightweight coroutines with cooperative multitasking:

- **Memory Efficient**: ~4KB stack per greenlet vs 1MB+ for threads
- **Deterministic**: Explicit context switching via `greenlet.switch()`
- **No GIL Issues**: Single-threaded cooperative scheduling
- **High Scalability**: Support for 1000+ concurrent agents in one process

## Architecture

```
A2A MCP Server (TypeScript - WebSocket streaming on port 8787)
    |
    ├── TypeScript Agents - Existing agents
    |
    └── Greenlet Bridge Adapter (TypeScript)
            |
            └── Process Pool (2-10 workers)
                    |
                    ├── Python Worker 1
                    |   ├── Greenlet Agent 1
                    |   ├── Greenlet Agent 2
                    |   └── Greenlet Agent N (up to 100)
                    |
                    └── Python Worker 2
                        └── [More greenlet agents]
```

## Installation

### Python Dependencies

```bash
pip install -r requirements-greenlet.txt
```

### Verify Installation

```bash
python3 -c "import greenlet; print(f'Greenlet version: {greenlet.__version__}')"
```

### Node.js Build

```bash
npm install
npm run build
```

## Quick Start

### 1. Start the Process Pool

```typescript
import { GreenletProcessPool } from './src/agents/greenlet-process-pool.js';

const pool = new GreenletProcessPool({
  minWorkers: 2,
  maxWorkers: 10,
  pythonPath: 'python3',
  scriptPath: 'src/agents/python/greenlet_a2a_agent.py'
});

await pool.start();
console.log('Process pool started:', pool.getStats());
```

### 2. Get a Worker and Send Messages

```typescript
const worker = await pool.getWorker();

worker.on('agent.pong', (data) => {
  console.log('Received pong:', data);
});

worker.sendMessage({ type: 'agent.ping' });

// Release worker back to pool when done
pool.releaseWorker(worker);
```

### 3. Using the CLI

```bash
# Build first
npm run build

# Start process pool with 4 workers
node dist/cli/a2a-cli.js start --workers 4 --max 10
```

## Creating Custom Greenlet Agents

### Python Side

```python
from greenlet_a2a_agent import GreenletA2AAgent

class CustomAgent(GreenletA2AAgent):
    def __init__(self, agent_id: str):
        super().__init__(agent_id, capabilities=["custom", "processing"])
        self.state = {}
        
    def handle_message(self, message: dict):
        """Handle custom messages"""
        super().handle_message(message)
        
        msg_type = message.get('type')
        
        if msg_type == 'custom.process':
            data = message.get('data', {})
            result = self._process_data(data)
            self._send_message({
                "type": "custom.result",
                "data": result
            })
            
    def _process_data(self, data):
        """Custom processing logic"""
        # Your processing here
        return {"processed": data}

if __name__ == "__main__":
    import sys
    import json
    
    agent = CustomAgent("custom-agent")
    agent.start()
    
    for line in sys.stdin:
        try:
            message = json.loads(line.strip())
            agent.receive_message(message)
        except json.JSONDecodeError:
            sys.stderr.write(f"Invalid JSON: {line}\n")
```

### TypeScript Side

```typescript
import { GreenletBridgeAdapter } from './src/agents/greenlet-bridge-adapter.js';

const adapter = new GreenletBridgeAdapter({
  pythonPath: 'python3',
  scriptPath: 'src/agents/python/custom-agent.py',
  agentId: 'custom-agent-1'
});

await adapter.connect();

adapter.on('custom.result', (data) => {
  console.log('Processing complete:', data);
});

adapter.sendMessage({
  type: 'custom.process',
  data: { input: 'test' }
});
```

## Configuration

### Process Pool Options

```typescript
const pool = new GreenletProcessPool({
  minWorkers: 2,              // Minimum workers (default: 2)
  maxWorkers: 10,             // Maximum workers (default: 10)
  pythonPath: 'python3',      // Python executable
  scriptPath: 'path/to/script.py',
  healthCheckInterval: 30000, // Health check interval in ms (default: 30s)
  restartOnFailure: true      // Auto-restart failed workers (default: true)
});
```

### Bridge Adapter Options

```typescript
const adapter = new GreenletBridgeAdapter({
  pythonPath: 'python3',      // Python executable
  scriptPath: 'script.py',    // Path to agent script
  agentId: 'agent-1',         // Unique agent ID
  capabilities: ['cap1'],     // Agent capabilities
  timeout: 30000              // Connection timeout in ms (default: 30s)
});
```

## Performance Characteristics

| Metric | Greenlet Agent | Thread-Based Agent |
|--------|----------------|-------------------|
| Memory per agent | ~4KB | ~1MB+ |
| Context switch time | ~0.1ms | ~1-10ms |
| Max concurrent agents | 1000+ | 100-200 |
| Scheduling | Cooperative | Preemptive |
| GIL impact | None (single-threaded) | High |

## Integration with A2A MCP Server

Greenlet agents integrate seamlessly with the existing A2A MCP server:

```typescript
import { GreenletProcessPool } from './src/agents/greenlet-process-pool.js';
import { StreamHub } from './src/streaming.js';

const pool = new GreenletProcessPool();
await pool.start();

const worker = await pool.getWorker();

// Forward messages between MCP server and greenlet agent
worker.on('message', (message) => {
  // Handle agent messages in your A2A system
  console.log('Agent message:', message);
});
```

## Testing

### Run Tests

```bash
# Build first
npm run build

# Node.js integration tests
node --test tests/greenlet-integration.test.ts

# Python unit tests
python3 -m pytest tests/python/test_greenlet_agent.py -v

# All tests
node --test tests/greenlet-integration.test.ts && python3 -m pytest tests/python/test_greenlet_agent.py -v
```

### CI/CD

GitHub Actions workflow tests across:
- Python: 3.9, 3.10, 3.11, 3.12
- Node.js: 18.x, 20.x, 22.x

## Troubleshooting

### Worker Connection Timeout

**Issue**: Worker fails to connect within timeout period

**Solution**:
- Verify Python is installed: `python3 --version`
- Check greenlet is installed: `pip show greenlet`
- Increase timeout in config

### High Memory Usage

**Issue**: Process pool consuming too much memory

**Solution**:
- Reduce `maxWorkers` in pool config
- Implement worker recycling (restart after N messages)
- Monitor with `pool.getStats()`

### Message Not Received

**Issue**: Messages sent but not received by agent

**Solution**:
- Check JSON format (must be valid JSON)
- Verify message type matches agent's `handle_message()`
- Enable debug logging: `LOG_LEVEL=debug`

## API Reference

### GreenletBridgeAdapter

#### Methods

- `connect()` - Connect to Python greenlet agent
- `disconnect()` - Gracefully disconnect
- `sendMessage(message)` - Send JSON message to agent
- `isConnected()` - Check connection status

#### Events

- `'message'` - Any message received from agent
- `'agent.register'` - Agent registration message
- `'error'` - Error occurred
- `'exit'` - Agent process exited

### GreenletProcessPool

#### Methods

- `start()` - Start the process pool
- `shutdown()` - Shutdown all workers
- `getWorker()` - Get available worker (throws if none available)
- `releaseWorker(adapter)` - Release worker back to pool
- `addWorker()` - Add new worker to pool
- `removeWorker(workerId)` - Remove specific worker
- `getStats()` - Get pool statistics

#### Statistics

```typescript
const stats = pool.getStats();
// {
//   total: 4,        // Total workers
//   available: 2,    // Available workers
//   busy: 2,         // Busy workers
//   healthy: 4       // Healthy workers
// }
```

## Best Practices

1. **Worker Pool Sizing**:
   - Start with `minWorkers = 2` for basic workloads
   - Set `maxWorkers` based on CPU cores (recommended: 2x cores)
   - Monitor `pool.getStats()` and adjust as needed

2. **Error Handling**:
   - Always wrap `getWorker()` in try-catch
   - Use `restartOnFailure: true` for production
   - Implement exponential backoff for retries

3. **Message Design**:
   - Keep messages small (<10KB)
   - Use structured JSON with `type` and `data` fields
   - Implement message versioning for compatibility

4. **Resource Cleanup**:
   - Always release workers with `releaseWorker()`
   - Call `pool.shutdown()` on process exit
   - Use process signals for graceful shutdown

## Migration from Other Agent Systems

Greenlet agents are **backward compatible** with existing A2A infrastructure:

1. Both types integrate with the same MCP server
2. Message format is identical (JSON with type/data)
3. No changes required to existing A2A code
4. Can run TypeScript and greenlet agents simultaneously

## Examples

See the `tests/` directory for complete working examples:
- `tests/greenlet-integration.test.ts` - TypeScript integration examples
- `tests/python/test_greenlet_agent.py` - Python unit test examples

---

**Last Updated**: 2025-10-22  
**Version**: 1.0.0
