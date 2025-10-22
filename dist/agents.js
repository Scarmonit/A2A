import { v4 as uuidv4 } from 'uuid';
export const agents = {};
function makeEchoAgent() {
    return {
        id: 'echo',
        name: 'Echo Agent',
        version: '1.0.0',
        capabilities: [
            {
                name: 'chat',
                description: 'Echoes your input back, token-streamed.',
                inputSchema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        messages: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['role', 'content'],
                                additionalProperties: false,
                                properties: {
                                    role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                                    content: { type: 'string' },
                                },
                            },
                        },
                    },
                    required: ['messages'],
                },
                outputSchema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        requestId: { type: 'string' },
                        streamUrl: { type: 'string' },
                    },
                    required: ['requestId', 'streamUrl'],
                },
            },
        ],
    };
}
// Initialize default agents
(function init() {
    const echo = makeEchoAgent();
    agents[echo.id] = echo;
})();
export function ensureRequestId(seed) {
    return seed ?? uuidv4();
}
