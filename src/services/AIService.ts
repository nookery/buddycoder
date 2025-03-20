import * as vscode from 'vscode';

export interface AIService {
    sendMessage(message: string, onPartialResponse: (partial: string) => void): Promise<void>;
}

interface OpenAIStreamResponse {
    choices: Array<{
        delta: {
            content?: string;
        };
    }>;
}

interface AnthropicStreamResponse {
    type: string;
    delta?: {
        text: string;
    };
}

interface DeepseekStreamResponse {
    choices: Array<{
        delta: {
            content?: string;
        };
    }>;
}

export class OpenAIService implements AIService {
    private apiKey: string;

    constructor() {
        this.apiKey = vscode.workspace.getConfiguration('buddycoder').get('openai.apiKey') || '';
    }

    async sendMessage(message: string, onPartialResponse: (partial: string) => void): Promise<void> {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not configured. Please set it in settings.');
        }

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: message }],
                    temperature: 0.7,
                    stream: true
                })
            });

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('Failed to get response stream');
            }

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        const data = JSON.parse(line.slice(6)) as OpenAIStreamResponse;
                        const content = data.choices[0].delta.content;
                        if (content) {
                            onPartialResponse(content);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error calling OpenAI:', error);
            throw new Error('Failed to get response from OpenAI');
        }
    }
}

export class AnthropicService implements AIService {
    private apiKey: string;

    constructor() {
        this.apiKey = vscode.workspace.getConfiguration('buddycoder').get('anthropic.apiKey') || '';
    }

    async sendMessage(message: string, onPartialResponse: (partial: string) => void): Promise<void> {
        if (!this.apiKey) {
            throw new Error('Anthropic API key not configured. Please set it in settings.');
        }

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-2',
                    messages: [{ role: 'user', content: message }],
                    max_tokens: 1000,
                    stream: true
                })
            });

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('Failed to get response stream');
            }

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6)) as AnthropicStreamResponse;
                        if (data.type === 'content_block_delta' && data.delta?.text) {
                            onPartialResponse(data.delta.text);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error calling Anthropic:', error);
            throw new Error('Failed to get response from Anthropic');
        }
    }
}

export class DeepseekService implements AIService {
    private apiKey: string;

    constructor() {
        this.apiKey = vscode.workspace.getConfiguration('buddycoder').get('deepseek.apiKey') || '';
    }

    async sendMessage(message: string, onPartialResponse: (partial: string) => void): Promise<void> {
        if (!this.apiKey) {
            throw new Error('Deepseek API key not configured. Please set it in settings.');
        }

        try {
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [{ role: 'user', content: message }],
                    temperature: 0.7,
                    stream: true
                })
            });

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('Failed to get response stream');
            }

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        const data = JSON.parse(line.slice(6)) as DeepseekStreamResponse;
                        const content = data.choices[0].delta.content;
                        if (content) {
                            onPartialResponse(content);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error calling Deepseek:', error);
            throw new Error('Failed to get response from Deepseek');
        }
    }
}

export function createAIService(): AIService {
    const config = vscode.workspace.getConfiguration('buddycoder');
    const provider = config.get('aiProvider');

    switch (provider) {
        case 'openai':
            return new OpenAIService();
        case 'anthropic':
            return new AnthropicService();
        case 'deepseek':
            return new DeepseekService();
        default:
            return new OpenAIService(); // 默认使用 OpenAI
    }
} 