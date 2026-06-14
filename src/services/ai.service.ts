import { Injectable } from '@angular/core'
import { streamText, tool } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { ConfigService } from 'tabby-core'
import { execSync } from 'child_process'

@Injectable({ providedIn: 'root' })
export class PilotAIService {
    constructor(
        private config: ConfigService,
    ) {}

    async *chat(messages: any[], onToolCall: (toolCall: any) => Promise<boolean>) {
        const pilotConfig = this.config.store.pilot
        
        if (!pilotConfig.apiKey) {
            throw new Error('API Key not configured. Please configure it in Settings > Pilot')
        }

        if (!pilotConfig.model) {
            throw new Error('Model not configured. Please select a model in Settings > Pilot')
        }

        // Create anthropic provider with API key
        const anthropic = createAnthropic({
            apiKey: pilotConfig.apiKey,
            baseURL: pilotConfig.baseURL || undefined,
        })

        const model = anthropic(pilotConfig.model)

        const result = await streamText({
            model,
            messages,
            maxSteps: 20,
            temperature: pilotConfig.temperature || 0.7,
            maxTokens: pilotConfig.maxTokens || 4096,
            tools: {
                executeShell: tool({
                    description: 'Execute a shell command in the current working directory',
                    parameters: z.object({
                        command: z.string().describe('The shell command to execute'),
                    }),
                    execute: async ({ command }) => {
                        const approved = await onToolCall({
                            type: 'tool-call',
                            toolName: 'executeShell',
                            args: { command },
                        })

                        if (!approved) {
                            return {
                                success: false,
                                error: 'User rejected the command execution',
                                cancelled: true,
                            }
                        }

                        try {
                            const output = execSync(command, {
                                encoding: 'utf-8',
                                maxBuffer: 10 * 1024 * 1024,
                                timeout: 30000,
                            })
                            return {
                                success: true,
                                output: output.toString(),
                            }
                        } catch (error: any) {
                            return {
                                success: false,
                                error: error.message,
                                stderr: error.stderr?.toString() || '',
                                stdout: error.stdout?.toString() || '',
                            }
                        }
                    },
                }),
            },
        })

        for await (const chunk of result.fullStream) {
            yield chunk
        }
    }

    validateConfig(): { valid: boolean; error?: string } {
        const pilotConfig = this.config.store.pilot
        
        if (!pilotConfig.apiKey) {
            return { valid: false, error: 'API Key is required' }
        }

        if (!pilotConfig.model) {
            return { valid: false, error: 'Model selection is required' }
        }

        return { valid: true }
    }
}
