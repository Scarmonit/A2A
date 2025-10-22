import { toolRegistry } from './tools.js';
export class AgentExecutor {
    async executeAgent(agentId, capability, input, context) {
        const startTime = Date.now();
        const toolsUsed = [];
        const changes = {
            filesCreated: [],
            filesModified: [],
            commandsExecuted: []
        };
        try {
            // Route to appropriate agent execution based on agent type
            const agent = getAgentByType(agentId);
            if (!agent) {
                throw new Error(`Unknown agent type: ${agentId}`);
            }
            const result = await agent.execute(input, context, {
                useTool: async (toolName, params) => {
                    toolsUsed.push(toolName);
                    const toolResult = await toolRegistry.execute(toolName, params, context);
                    // Track changes
                    if (toolResult.success && toolResult.result) {
                        if (toolName === 'create_file' && toolResult.result.path) {
                            changes.filesCreated?.push(toolResult.result.path);
                        }
                        if (toolName === 'execute_command' && toolResult.result.command) {
                            changes.commandsExecuted?.push(toolResult.result.command);
                        }
                    }
                    return toolResult;
                }
            });
            return {
                success: true,
                result,
                toolsUsed,
                executionTime: Date.now() - startTime,
                changes
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                toolsUsed,
                executionTime: Date.now() - startTime,
                changes
            };
        }
    }
}
// File Operations Agent
export class FileOperationsAgent {
    async execute(input, context, helpers) {
        const { operation, path, content, encoding = 'utf8' } = input;
        switch (operation) {
            case 'create':
                return await helpers.useTool('create_file', { path, content, encoding });
            case 'read':
                return await helpers.useTool('read_file', { path, encoding });
            case 'list':
                return await helpers.useTool('list_directory', { path, recursive: input.recursive });
            case 'analyze_structure':
                // Complex operation using multiple tools
                const listing = await helpers.useTool('list_directory', { path, recursive: true });
                if (!listing.success)
                    return listing;
                const analysis = {
                    totalFiles: listing.result.files?.length || 0,
                    fileTypes: {},
                    directories: listing.result.directories?.length || 0,
                    structure: listing.result
                };
                // Analyze file types
                if (listing.result.files) {
                    for (const file of listing.result.files) {
                        const ext = file.split('.').pop()?.toLowerCase() || 'no-extension';
                        analysis.fileTypes[ext] = (analysis.fileTypes[ext] || 0) + 1;
                    }
                }
                return { success: true, result: analysis };
            default:
                throw new Error(`Unknown file operation: ${operation}`);
        }
    }
}
// Code Generation Agent
export class CodeGeneratorAgent {
    async execute(input, context, helpers) {
        const { task, language, framework, save_to, test_cases } = input;
        // Generate main code
        const codeResult = await helpers.useTool('generate_code', {
            language,
            description: task,
            save_to
        });
        if (!codeResult.success)
            return codeResult;
        const results = { mainCode: codeResult };
        // Generate test cases if requested
        if (test_cases && language) {
            const testCode = await this.generateTestCode(task, language, framework, helpers);
            results.testCode = testCode;
            if (save_to && testCode.success) {
                const testPath = save_to.replace(/\.(\w+)$/, '.test.$1');
                await helpers.useTool('create_file', {
                    path: testPath,
                    content: testCode.result.code
                });
            }
        }
        // Create a README if it's a substantial project
        if (save_to) {
            const readme = await this.generateReadme(task, language, helpers);
            results.readme = readme;
        }
        return { success: true, result: results };
    }
    async generateTestCode(task, language, framework, helpers) {
        let testTemplate = '';
        switch (language.toLowerCase()) {
            case 'javascript':
            case 'js':
                testTemplate = framework === 'jest' ? this.getJestTemplate(task) : this.getNodeTestTemplate(task);
                break;
            case 'python':
                testTemplate = this.getPythonTestTemplate(task);
                break;
            case 'typescript':
                testTemplate = this.getTypeScriptTestTemplate(task);
                break;
        }
        return await helpers.useTool('generate_code', {
            language,
            description: `Test cases for: ${task}`,
            template: testTemplate
        });
    }
    async generateReadme(task, language, helpers) {
        const readmeContent = `# ${task}

## Description
${task}

## Language
${language}

## Usage
[Instructions for running the code]

## Testing
[Instructions for running tests]

## Generated by A2A Agent
This code was automatically generated by an A2A agent.
`;
        return await helpers.useTool('create_file', {
            path: 'README.md',
            content: readmeContent
        });
    }
    getJestTemplate(task) {
        return `// Test cases for: ${task}
const { main } = require('./main');

describe('${task}', () => {
  test('should execute successfully', () => {
    const result = main();
    expect(result.success).toBe(true);
  });
  
  test('should return expected message', () => {
    const result = main();
    expect(result.message).toContain('${task}');
  });
});
`;
    }
    getNodeTestTemplate(task) {
        return `// Test cases for: ${task}
const assert = require('assert');
const { main } = require('./main');

function testMain() {
  const result = main();
  assert(result.success === true, 'Should execute successfully');
  assert(result.message.includes('${task}'), 'Should contain task description');
  console.log('All tests passed!');
}

testMain();
`;
    }
    getPythonTestTemplate(task) {
        return `# Test cases for: ${task}
import unittest
from main import main

class Test${task.replace(/[^a-zA-Z0-9]/g, '')}(unittest.TestCase):
    def test_main_execution(self):
        result = main()
        self.assertTrue(result['success'])
        self.assertIn('${task}', result['message'])

if __name__ == '__main__':
    unittest.main()
`;
    }
    getTypeScriptTestTemplate(task) {
        return `// Test cases for: ${task}
import { main, Result } from './main';

describe('${task}', () => {
  test('should execute successfully', () => {
    const result: Result = main();
    expect(result.success).toBe(true);
  });
  
  test('should return expected message', () => {
    const result: Result = main();
    expect(result.message).toContain('${task}');
  });
});
`;
    }
}
// Data Processing Agent
export class DataProcessorAgent {
    async execute(input, context, helpers) {
        const { data_source, operations, output_format, save_to } = input;
        let currentData = input.data;
        // Load data from file if source provided
        if (data_source) {
            const fileResult = await helpers.useTool('read_file', { path: data_source });
            if (!fileResult.success)
                return fileResult;
            try {
                currentData = JSON.parse(fileResult.result.content);
            }
            catch (error) {
                return { success: false, error: 'Invalid JSON in data source' };
            }
        }
        if (!currentData) {
            return { success: false, error: 'No data provided' };
        }
        const results = [];
        // Execute operations sequentially
        for (const operation of operations || []) {
            const opResult = await helpers.useTool('process_json', {
                data: currentData,
                operation: operation.type,
                expression: operation.expression
            });
            if (!opResult.success)
                return opResult;
            currentData = opResult.result.result;
            results.push({
                operation: operation.type,
                expression: operation.expression,
                processed_items: opResult.result.processed_items
            });
        }
        // Format output
        let finalResult = currentData;
        if (output_format === 'csv' && Array.isArray(currentData)) {
            finalResult = this.convertToCSV(currentData);
        }
        else if (output_format === 'xml' && typeof currentData === 'object') {
            finalResult = this.convertToXML(currentData);
        }
        // Save result if requested
        if (save_to) {
            const content = typeof finalResult === 'string' ? finalResult : JSON.stringify(finalResult, null, 2);
            await helpers.useTool('create_file', { path: save_to, content });
        }
        return {
            success: true,
            result: {
                data: finalResult,
                operations_performed: results,
                total_items: Array.isArray(finalResult) ? finalResult.length : 1
            }
        };
    }
    convertToCSV(data) {
        if (data.length === 0)
            return '';
        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map(row => headers.map(header => JSON.stringify(row[header] || '')).join(','))
        ];
        return csvRows.join('\n');
    }
    convertToXML(data) {
        const toXML = (obj, rootName = 'root') => {
            if (typeof obj !== 'object')
                return `<${rootName}>${obj}</${rootName}>`;
            let xml = `<${rootName}>`;
            for (const [key, value] of Object.entries(obj)) {
                if (Array.isArray(value)) {
                    for (const item of value) {
                        xml += toXML(item, key.slice(0, -1)); // Remove 's' from plural
                    }
                }
                else {
                    xml += toXML(value, key);
                }
            }
            xml += `</${rootName}>`;
            return xml;
        };
        return toXML(data);
    }
}
// Web Scraper Agent
export class WebScraperAgent {
    async execute(input, context, helpers) {
        const { urls, selectors, output_file, format = 'json' } = input;
        const results = [];
        for (const url of urls || []) {
            try {
                const response = await helpers.useTool('http_request', {
                    url,
                    method: 'GET',
                    headers: { 'User-Agent': 'A2A-Agent-Scraper/1.0' }
                });
                if (!response.success) {
                    results.push({ url, error: response.error });
                    continue;
                }
                // Simple text extraction (in a real implementation, use a proper HTML parser)
                const content = response.result.data;
                const extracted = this.extractContent(content, selectors);
                results.push({
                    url,
                    status: response.result.status,
                    data: extracted
                });
            }
            catch (error) {
                results.push({
                    url,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        // Save results if requested
        if (output_file) {
            const content = format === 'csv'
                ? this.convertScrapedDataToCSV(results)
                : JSON.stringify(results, null, 2);
            await helpers.useTool('create_file', {
                path: output_file,
                content
            });
        }
        return { success: true, result: results };
    }
    extractContent(html, selectors) {
        // Simplified content extraction - in production, use cheerio or similar
        const extracted = {};
        if (selectors?.title) {
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            extracted.title = titleMatch ? titleMatch[1].trim() : null;
        }
        if (selectors?.text) {
            // Remove HTML tags and extract text
            const textContent = html.replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 1000); // Limit to first 1000 chars
            extracted.text = textContent;
        }
        return extracted;
    }
    convertScrapedDataToCSV(results) {
        const headers = ['url', 'status', 'title', 'text', 'error'];
        const csvRows = [
            headers.join(','),
            ...results.map(result => [
                result.url || '',
                result.status || '',
                result.data?.title || '',
                (result.data?.text || '').replace(/"/g, '""').slice(0, 100),
                result.error || ''
            ].map(field => `"${field}"`).join(','))
        ];
        return csvRows.join('\n');
    }
}
// System Monitor Agent
export class SystemMonitorAgent {
    async execute(input, context, helpers) {
        const { checks, output_file, alert_threshold } = input;
        const results = {
            timestamp: new Date().toISOString(),
            checks: {},
            alerts: []
        };
        // Disk usage check
        if (checks?.disk) {
            try {
                const diskResult = await helpers.useTool('execute_command', {
                    command: process.platform === 'win32' ? 'dir' : 'df',
                    args: process.platform === 'win32' ? [] : ['-h'],
                    timeout: 10
                });
                results.checks.disk = {
                    success: diskResult.success,
                    output: diskResult.result?.stdout || diskResult.error,
                    timestamp: Date.now()
                };
            }
            catch (error) {
                results.checks.disk = { error: String(error) };
            }
        }
        // Memory usage simulation (in real implementation, use actual system calls)
        if (checks?.memory) {
            const memUsage = process.memoryUsage();
            results.checks.memory = {
                rss: Math.round(memUsage.rss / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024),
                timestamp: Date.now()
            };
            // Check for alerts
            if (alert_threshold?.memory && memUsage.heapUsed > alert_threshold.memory * 1024 * 1024) {
                results.alerts.push({
                    type: 'memory',
                    message: `Memory usage (${results.checks.memory.heapUsed}MB) exceeds threshold (${alert_threshold.memory}MB)`,
                    severity: 'warning'
                });
            }
        }
        // Save monitoring report
        if (output_file) {
            await helpers.useTool('create_file', {
                path: output_file,
                content: JSON.stringify(results, null, 2)
            });
        }
        return { success: true, result: results };
    }
}
// Agent registry mapping
const agentTypes = new Map([
    ['file-ops', new FileOperationsAgent()],
    ['code-gen', new CodeGeneratorAgent()],
    ['data-processor', new DataProcessorAgent()],
    ['web-scraper', new WebScraperAgent()],
    ['system-monitor', new SystemMonitorAgent()]
]);
export function getAgentByType(agentId) {
    // Handle echo agent specifically
    if (agentId === 'echo') {
        // Return a simple echo implementation for backward compatibility
        return {
            async execute(input) {
                const messages = input?.messages ?? [];
                const last = messages[messages.length - 1]?.content ?? String(input);
                return { success: true, result: { echoed: last } };
            }
        };
    }
    // Extract agent type from ID (e.g., "file-ops-001" -> "file-ops")
    const type = agentId.split('-').slice(0, 2).join('-');
    return agentTypes.get(type);
}
export const agentExecutor = new AgentExecutor();
