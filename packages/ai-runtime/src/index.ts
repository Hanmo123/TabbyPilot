import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { isStepCount, streamText, tool } from 'ai'
import { z } from 'zod'

type PilotProviderType = 'anthropic' | 'openai-responses' | 'openai-chat'

interface PilotProviderConfig {
  apiKey: string
  baseURL?: string
  model: string
}

interface PilotRuntimeChatOptions {
  provider: PilotProviderType
  providerConfig: PilotProviderConfig
  messages: any[]
  instructions?: string
  maxTokens: number
  promptCacheKey?: string
  executeTool: (request: {
    toolName: string
    toolCallId: string
    input: any
  }) => Promise<any>
}

interface PilotStreamChunk {
  type: 'text-delta' | 'tool-call' | 'tool-result' | 'error' | 'finish'
  textDelta?: string
  toolCallId?: string
  toolName?: string
  args?: any
  toolResult?: any
  error?: string
}

export async function* streamPilotChat(options: PilotRuntimeChatOptions): AsyncIterable<PilotStreamChunk> {
  const model = createModel(options.provider, options.providerConfig)
  const isOpenAIResponses = options.provider === 'openai-responses'
  const openAIProviderOptions = isOpenAIResponses
    ? {
        openai: {
          store: false,
          ...(options.promptCacheKey ? { promptCacheKey: options.promptCacheKey } : {}),
          ...(options.instructions ? { instructions: options.instructions } : {}),
        },
      }
    : undefined

  const result = streamText({
    model,
    ...(!isOpenAIResponses && options.instructions ? { instructions: options.instructions } : {}),
    messages: options.messages,
    maxOutputTokens: options.maxTokens,
    stopWhen: isStepCount(20),
    ...(openAIProviderOptions ? { providerOptions: openAIProviderOptions } : {}),
    tools: {
      executeShell: tool({
        description:
          'Execute a shell command in the terminal. The command will be sent to the left terminal pane if available. You can specify how long to wait for the command output. If the output is not ready within the timeout, you can use readTerminalOutput to read it later.',
        inputSchema: z.object({
          command: z.string().describe('The shell command to execute'),
          timeoutSeconds: z
            .number()
            .optional()
            .describe(
              'How many seconds to wait for command output (default: 1). Should be as short as possible for instant commands, and be longer for slow commands like large file operations or network requests.',
            ),
        }),
        execute: async (input, executionOptions) =>
          options.executeTool({
            toolName: 'executeShell',
            toolCallId: executionOptions.toolCallId,
            input,
          }),
      }),
      readTerminalOutput: tool({
        description:
          'Read additional output from the terminal. Use this after executeShell if the initial timeout was too short and you need to wait longer for the command to complete.',
        inputSchema: z.object({
          timeoutSeconds: z
            .number()
            .optional()
            .describe('How many seconds to wait for additional output (default: 5).'),
        }),
        execute: async (input, executionOptions) =>
          options.executeTool({
            toolName: 'readTerminalOutput',
            toolCallId: executionOptions.toolCallId,
            input,
          }),
      }),
    },
  })

  const stream = (result as any).fullStream || (result as any).stream
  for await (const part of stream) {
    const chunk = mapStreamPart(part)
    if (chunk) {
      yield chunk
    }
  }
}

function createModel(provider: PilotProviderType, providerConfig: PilotProviderConfig): any {
  if (provider === 'openai-responses') {
    const openai = createOpenAI({
      apiKey: providerConfig.apiKey,
      baseURL: normalizeOpenAIBaseURL(providerConfig.baseURL),
    })
    return openai.responses(providerConfig.model)
  }

  if (provider === 'openai-chat') {
    const openaiCompatible = createOpenAICompatible({
      name: 'openai-compatible',
      apiKey: providerConfig.apiKey,
      baseURL: normalizeOpenAIBaseURL(providerConfig.baseURL) || 'https://api.openai.com/v1',
      includeUsage: true,
    })
    return openaiCompatible.chatModel(providerConfig.model)
  }

  const anthropic = createAnthropic({
    apiKey: providerConfig.apiKey,
    baseURL: providerConfig.baseURL || undefined,
  })
  return anthropic(providerConfig.model)
}

function normalizeOpenAIBaseURL(baseURL?: string): string | undefined {
  if (!baseURL) {
    return undefined
  }

  const trimmed = baseURL.replace(/\/$/, '')
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`
}

function mapStreamPart(part: any): PilotStreamChunk | null {
  if (!part || typeof part.type !== 'string') {
    return null
  }

  if (part.type === 'text-delta') {
    return { type: 'text-delta', textDelta: part.textDelta ?? part.text ?? '' }
  }

  if (part.type === 'tool-call') {
    return {
      type: 'tool-call',
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      args: part.args ?? part.input ?? {},
    }
  }

  if (part.type === 'tool-result') {
    return {
      type: 'tool-result',
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      args: part.args ?? part.input ?? {},
      toolResult: part.result ?? part.output,
    }
  }

  if (part.type === 'error') {
    return { type: 'error', error: normalizeErrorMessage(part.error) }
  }

  if (part.type === 'finish') {
    return { type: 'finish' }
  }

  return null
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'AI stream error'
}
