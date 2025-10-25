import { chromium, firefox, webkit, Browser, Page, BrowserContext } from 'playwright';
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';

export interface BrowserTask {
  id: string;
  url: string;
  actions: BrowserAction[];
  context?: Record<string, any>;
  priority?: number;
}

export interface BrowserAction {
  type: 'navigate' | 'click' | 'fill' | 'select' | 'screenshot' | 'evaluate' | 'wait' | 'scroll';
  selector?: string;
  value?: string;
  options?: Record<string, any>;
}

export interface ExecutionResult {
  taskId: string;
  success: boolean;
  data?: any;
  error?: string;
  screenshot?: string;
  duration: number;
}

export class BrowserAutomationEngine extends EventEmitter {
  private browsers: Map<string, Browser> = new Map();
  private contexts: Map<string, BrowserContext> = new Map();
  private activeTasks: Map<string, Promise<ExecutionResult>> = new Map();
  private wsConnections: Set<WebSocket> = new Set();
  private readonly maxConcurrency: number;
  private readonly browserTypes = { chromium, firefox, webkit };

  constructor(maxConcurrency: number = 5) {
    super();
    this.maxConcurrency = maxConcurrency;
  }

  async initialize(browserType: 'chromium' | 'firefox' | 'webkit' = 'chromium'): Promise<void> {
    try {
      const browser = await this.browserTypes[browserType].launch({
        headless: process.env.HEADLESS !== 'false',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      this.browsers.set(browserType, browser);
      this.emit('browser:initialized', { browserType });
    } catch (error) {
      this.emit('browser:error', { browserType, error });
      throw error;
    }
  }

  async createContext(browserType: string = 'chromium', options?: any): Promise<string> {
    const browser = this.browsers.get(browserType);
    if (!browser) {
      throw new Error(`Browser ${browserType} not initialized`);
    }

    const context = await browser.newContext(options);
    const contextId = `${browserType}-${Date.now()}-${Math.random().toString(36)}`;
    this.contexts.set(contextId, context);
    
    this.emit('context:created', { contextId, browserType });
    return contextId;
  }

  async executeTask(task: BrowserTask): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Check concurrency limit
      while (this.activeTasks.size >= this.maxConcurrency) {
        await this.waitForTaskSlot();
      }

      const execution = this.performTask(task);
      this.activeTasks.set(task.id, execution);
      
      const result = await execution;
      this.activeTasks.delete(task.id);
      
      return result;
    } catch (error: any) {
      this.activeTasks.delete(task.id);
      return {
        taskId: task.id,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  private async performTask(task: BrowserTask): Promise<ExecutionResult> {
    const startTime = Date.now();
    let page: Page | null = null;
    let screenshot: string | undefined;

    try {
      // Get or create context
      const contextId = await this.getOrCreateContext('chromium');
      const context = this.contexts.get(contextId);
      if (!context) throw new Error('Failed to get context');

      page = await context.newPage();
      
      // Navigate to URL
      await page.goto(task.url, { waitUntil: 'networkidle' });
      this.emit('task:navigated', { taskId: task.id, url: task.url });

      // Execute actions sequentially
      for (const action of task.actions) {
        await this.executeAction(page, action);
        this.emit('task:action', { taskId: task.id, action: action.type });
      }

      // Capture screenshot
      screenshot = await page.screenshot({ encoding: 'base64' });

      // Extract data if evaluation action present
      const evaluateAction = task.actions.find(a => a.type === 'evaluate');
      let data;
      if (evaluateAction?.value) {
        data = await page.evaluate(evaluateAction.value);
      }

      await page.close();

      return {
        taskId: task.id,
        success: true,
        data,
        screenshot,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      if (page) await page.close().catch(() => {});
      
      return {
        taskId: task.id,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  private async executeAction(page: Page, action: BrowserAction): Promise<void> {
    switch (action.type) {
      case 'navigate':
        if (action.value) await page.goto(action.value);
        break;
      
      case 'click':
        if (action.selector) await page.click(action.selector, action.options);
        break;
      
      case 'fill':
        if (action.selector && action.value) {
          await page.fill(action.selector, action.value, action.options);
        }
        break;
      
      case 'select':
        if (action.selector && action.value) {
          await page.selectOption(action.selector, action.value, action.options);
        }
        break;
      
      case 'screenshot':
        await page.screenshot({ path: action.value, ...action.options });
        break;
      
      case 'evaluate':
        if (action.value) await page.evaluate(action.value);
        break;
      
      case 'wait':
        if (action.selector) {
          await page.waitForSelector(action.selector, action.options);
        } else if (action.value) {
          await page.waitForTimeout(parseInt(action.value));
        }
        break;
      
      case 'scroll':
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        break;
    }
  }

  private async getOrCreateContext(browserType: string): Promise<string> {
    const existing = Array.from(this.contexts.entries())
      .find(([id]) => id.startsWith(browserType));
    
    if (existing) return existing[0];
    return await this.createContext(browserType);
  }

  private async waitForTaskSlot(): Promise<void> {
    return new Promise(resolve => {
      const check = () => {
        if (this.activeTasks.size < this.maxConcurrency) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  async executeBatch(tasks: BrowserTask[]): Promise<ExecutionResult[]> {
    this.emit('batch:started', { count: tasks.length });
    
    const results = await Promise.all(
      tasks.map(task => this.executeTask(task))
    );
    
    this.emit('batch:completed', { count: results.length, success: results.filter(r => r.success).length });
    return results;
  }

  connectWebSocket(ws: WebSocket): void {
    this.wsConnections.add(ws);
    
    ws.on('message', async (message: string) => {
      try {
        const task: BrowserTask = JSON.parse(message);
        const result = await this.executeTask(task);
        ws.send(JSON.stringify(result));
      } catch (error: any) {
        ws.send(JSON.stringify({ error: error.message }));
      }
    });

    ws.on('close', () => {
      this.wsConnections.delete(ws);
    });

    // Stream events to WebSocket
    const eventHandler = (event: string, data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event, data }));
      }
    };

    this.on('task:navigated', (data) => eventHandler('task:navigated', data));
    this.on('task:action', (data) => eventHandler('task:action', data));
    this.on('task:completed', (data) => eventHandler('task:completed', data));
  }

  async gatherContextFromScreen(url: string): Promise<Record<string, any>> {
    const context = await this.createContext('chromium');
    const browserContext = this.contexts.get(context);
    if (!browserContext) throw new Error('Context not found');

    const page = await browserContext.newPage();
    await page.goto(url);

    const contextData = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        selectedText: window.getSelection()?.toString(),
        metaTags: Array.from(document.querySelectorAll('meta')).map(m => ({
          name: m.getAttribute('name'),
          content: m.getAttribute('content')
        })),
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent),
        forms: Array.from(document.querySelectorAll('form')).length,
        links: Array.from(document.querySelectorAll('a')).length
      };
    });

    await page.close();
    return contextData;
  }

  async cleanup(): Promise<void> {
    // Close all WebSocket connections
    this.wsConnections.forEach(ws => ws.close());
    this.wsConnections.clear();

    // Close all contexts
    await Promise.all(
      Array.from(this.contexts.values()).map(ctx => ctx.close().catch(() => {}))
    );
    this.contexts.clear();

    // Close all browsers
    await Promise.all(
      Array.from(this.browsers.values()).map(browser => browser.close().catch(() => {}))
    );
    this.browsers.clear();

    this.emit('cleanup:completed');
  }
}

// CLI execution
if (require.main === module) {
  const engine = new BrowserAutomationEngine();
  
  engine.on('browser:initialized', (data) => console.log('Browser initialized:', data));
  engine.on('task:navigated', (data) => console.log('Task navigated:', data));
  engine.on('batch:completed', (data) => console.log('Batch completed:', data));

  const task = process.env.TASK_INPUT;
  const parallel = process.env.PARALLEL_ENABLED === 'true';

  (async () => {
    try {
      await engine.initialize(process.env.BROWSER_TYPE as any || 'chromium');
      
      // Example task execution
      const result = await engine.executeTask({
        id: 'cli-task-1',
        url: 'https://github.com',
        actions: [
          { type: 'wait', value: '2000' },
          { type: 'screenshot', value: 'screenshots/github.png' }
        ]
      });

      console.log('Task result:', result);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    } finally {
      await engine.cleanup();
    }
  })();
}
