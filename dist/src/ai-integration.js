import pino from 'pino';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
export class AIIntegration {
    providers = new Map();
    async generateResponse(capability, input, context) {
        const { provider, model, maxTokens = 4000, temperature = 0.7 } = capability.config;
        // Build conversation context
        const messages = this.buildMessages(capability, input, context?.sessionHistory);
        logger.info({
            agentId: context?.agentId,
            requestId: context?.requestId,
            provider,
            model
        }, 'Generating AI response');
        const toolsUsed = [];
        let response = '';
        let tokens = { input: 0, output: 0 };
        try {
            switch (provider) {
                case 'openai':
                    const openaiResult = await this.callOpenAI({
                        model,
                        messages,
                        maxTokens,
                        temperature,
                        tools: capability.tools
                    });
                    response = openaiResult.response;
                    tokens = openaiResult.tokens;
                    toolsUsed.push(...openaiResult.toolsUsed);
                    break;
                case 'anthropic':
                    const anthropicResult = await this.callAnthropic({
                        model,
                        messages,
                        maxTokens,
                        temperature
                    });
                    response = anthropicResult.response;
                    tokens = anthropicResult.tokens;
                    break;
                case 'local':
                    response = await this.callLocalLLM({
                        model,
                        messages,
                        maxTokens,
                        temperature
                    });
                    break;
                default:
                    throw new Error(`Unsupported LLM provider: ${provider}`);
            }
            logger.info({
                agentId: context?.agentId,
                requestId: context?.requestId,
                tokensUsed: tokens.input + tokens.output,
                toolsUsed: toolsUsed.length
            }, 'AI response generated successfully');
            return { response, toolsUsed, tokens };
        }
        catch (error) {
            logger.error({
                error: error instanceof Error ? error.message : error,
                provider,
                model
            }, 'AI response generation failed');
            throw error;
        }
    }
    buildMessages(capability, input, sessionHistory) {
        const messages = [];
        // System prompt
        if (capability.systemPrompt) {
            messages.push({
                role: 'system',
                content: capability.systemPrompt
            });
        }
        // Session history for context
        if (sessionHistory && sessionHistory.length > 0) {
            messages.push(...sessionHistory.slice(-10)); // Last 10 messages for context
        }
        // Current input with capability prompt
        messages.push({
            role: 'user',
            content: this.formatPrompt(capability.prompt, input)
        });
        return messages;
    }
    formatPrompt(template, input) {
        // Simple template replacement - could be enhanced with a proper template engine
        let formatted = template;
        if (typeof input === 'object') {
            for (const [key, value] of Object.entries(input)) {
                formatted = formatted.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
            }
        }
        else {
            formatted = formatted.replace(/{{input}}/g, String(input));
        }
        return formatted;
    }
    async callOpenAI(params) {
        const apiKey = params.apiKey || process.env.OPENAI_API_KEY;
        if (!apiKey)
            throw new Error('OpenAI API key not configured');
        const payload = {
            model: params.model,
            messages: params.messages,
            max_tokens: params.maxTokens,
            temperature: params.temperature,
            stream: false
        };
        // Add function calling if tools are specified
        if (params.tools && params.tools.length > 0) {
            payload.functions = this.buildOpenAIFunctions(params.tools);
            payload.function_call = 'auto';
        }
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const choice = data.choices[0];
        const tokens = {
            input: data.usage.prompt_tokens,
            output: data.usage.completion_tokens
        };
        let toolsUsed = [];
        let responseText = choice.message.content || '';
        // Handle function calls
        if (choice.message.function_call) {
            const functionName = choice.message.function_call.name;
            toolsUsed.push(functionName);
            responseText += `\n[Used tool: ${functionName}]`;
        }
        return {
            response: responseText,
            tokens,
            toolsUsed
        };
    }
    async callAnthropic(params) {
        const apiKey = params.apiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey)
            throw new Error('Anthropic API key not configured');
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: params.model,
                max_tokens: params.maxTokens,
                messages: params.messages.filter((m) => m.role !== 'system'),
                system: params.messages.find((m) => m.role === 'system')?.content,
                temperature: params.temperature
            })
        });
        if (!response.ok) {
            throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
            response: data.content[0].text,
            tokens: {
                input: data.usage.input_tokens,
                output: data.usage.output_tokens
            }
        };
    }
    async callLocalLLM(params) {
        // Placeholder for local LLM integration (Ollama, etc.)
        const baseUrl = process.env.LOCAL_LLM_URL || 'http://localhost:11434';
        try {
            const response = await fetch(`${baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: params.model,
                    prompt: params.messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
                    options: {
                        temperature: params.temperature,
                        num_predict: params.maxTokens
                    }
                })
            });
            if (!response.ok) {
                throw new Error(`Local LLM error: ${response.status}`);
            }
            const data = await response.json();
            return data.response || 'No response from local LLM';
        }
        catch (error) {
            logger.warn({ error: error.message }, 'Local LLM unavailable, using fallback');
            return `I apologize, but I'm unable to process your request at the moment. The AI service is temporarily unavailable.`;
        }
    }
    buildOpenAIFunctions(toolNames) {
        // This would integrate with your tool registry to build function definitions
        // For now, return empty array - would need integration with ToolRegistry
        return [];
    }
}
// Pre-configured AI capabilities for common agent types (Ollama/Local models)
export const AI_CAPABILITIES = {
    'code-assistant': {
        name: 'code_assistance',
        description: 'AI-powered code generation and assistance',
        systemPrompt: 'You are an expert software engineer. Generate clean, well-documented code with best practices. Be concise and practical.',
        prompt: 'Generate {{language}} code for: {{description}}\n\nRequirements:\n{{requirements}}\n\nProvide working code with comments.',
        config: {
            provider: 'local',
            model: 'codellama:13b-code', // or 'codellama:7b-code' for faster responses
            maxTokens: 2000,
            temperature: 0.1 // Low temperature for code generation
        },
        tools: ['create_file', 'read_file', 'generate_code']
    },
    'data-analyst': {
        name: 'data_analysis',
        description: 'AI-powered data analysis and insights',
        systemPrompt: 'You are a data scientist. Analyze data and provide actionable insights with clear explanations. Focus on practical recommendations.',
        prompt: 'Analyze this data: {{data}}\n\nFocus on: {{analysis_type}}\n\nProvide insights and recommendations with specific numbers.',
        config: {
            provider: 'local',
            model: 'llama2:13b-chat', // Good for analytical thinking
            maxTokens: 1500,
            temperature: 0.2
        },
        tools: ['process_json', 'create_file']
    },
    'research-assistant': {
        name: 'research_assistance',
        description: 'AI-powered research and information gathering',
        systemPrompt: 'You are a research assistant. Provide comprehensive, accurate information. Structure your responses clearly with bullet points and summaries.',
        prompt: 'Research topic: {{topic}}\n\nSpecific questions: {{questions}}\n\nProvide detailed findings with sources when possible.',
        config: {
            provider: 'local',
            model: 'llama2:13b-chat',
            maxTokens: 3000,
            temperature: 0.4
        },
        tools: ['http_request', 'create_file']
    },
    'general-assistant': {
        name: 'general_assistance',
        description: 'General purpose AI assistant for various tasks',
        systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and practical responses. Be concise but thorough.',
        prompt: '{{input}}\n\nPlease provide a helpful response.',
        config: {
            provider: 'local',
            model: 'llama2:7b-chat', // Fast and efficient for general tasks
            maxTokens: 1000,
            temperature: 0.7
        },
        tools: ['create_file', 'read_file', 'http_request']
    },
    'creative-writer': {
        name: 'creative_writing',
        description: 'AI assistant for creative writing and content generation',
        systemPrompt: 'You are a creative writer. Generate engaging, original content with good structure and flow.',
        prompt: 'Write about: {{topic}}\n\nStyle: {{style}}\n\nLength: {{length}}\n\nCreate engaging content.',
        config: {
            provider: 'local',
            model: 'llama2:13b-chat',
            maxTokens: 2500,
            temperature: 0.8 // Higher temperature for creativity
        },
        tools: ['create_file']
    }
};
export const aiIntegration = new AIIntegration();
