export type PilotProviderType = 'anthropic' | 'openai-responses' | 'openai-chat';

export interface PilotProviderConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
}

export interface PilotToolRequest {
  toolName: string;
  toolCallId: string;
  input: any;
}

export interface PilotRuntimeChatOptions {
  provider: PilotProviderType;
  providerConfig: PilotProviderConfig;
  messages: any[];
  maxTokens: number;
  promptCacheKey?: string;
  executeTool: (request: PilotToolRequest) => Promise<any>;
}

export interface PilotStreamChunk {
  type: 'text-delta' | 'tool-call' | 'tool-result' | 'error' | 'finish';
  textDelta?: string;
  toolCallId?: string;
  toolName?: string;
  args?: any;
  toolResult?: any;
  error?: string;
}

export declare function streamPilotChat(options: PilotRuntimeChatOptions): AsyncIterable<PilotStreamChunk>;
