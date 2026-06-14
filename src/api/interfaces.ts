export interface PilotConfig {
    apiKey: string
    baseURL?: string
    model: string
    maxTokens: number
    temperature: number
    sessions: ChatSession[]
}

export interface ChatSession {
    id: string
    title: string
    createdAt: number
    updatedAt: number
    messages: ChatMessage[]
    workingDirectory?: string
}

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    toolCalls?: ToolCall[]
    timestamp: number
}

export interface ToolCall {
    id: string
    type: 'tool-call'
    toolName: string
    args: any
    status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'error'
    result?: any
    error?: string
}

export interface ToolExecution {
    id: string
    toolName: string
    parameters: any
    status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'error'
    result?: any
    error?: string
    resolveCallback?: (approved: boolean) => void
}

export interface StreamChunk {
    type: 'text-delta' | 'tool-call' | 'tool-result' | 'error' | 'finish'
    textDelta?: string
    toolCall?: ToolCall
    toolResult?: any
    error?: string
}
