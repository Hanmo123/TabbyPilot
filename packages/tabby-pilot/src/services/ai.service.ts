import { Injectable } from "@angular/core";
import { ConfigService } from "tabby-core";
import { BaseTerminalTabComponent } from "tabby-terminal";
import { execSync } from "child_process";
import { streamPilotChat } from "@tabby-pilot/ai-runtime";
import { PilotProviderType } from "../api/interfaces";

const PILOT_INSTRUCTIONS = [
  "You are Pilot, an AI assistant embedded in the Tabby terminal.",
  "Help the user with terminal-centric tasks in a concise, practical way.",
  "Match the user's language.",
  "Use the available tools when you need information from the system instead of guessing.",
  "Before running a shell command, briefly state what you are going to inspect or do.",
  "When calling executeShell, always provide a 10-20 character summary in the user's language describing what the command does.",
  "Prefer minimal, read-only commands unless the user clearly asks for a change.",
  "When a tool returns output, base your answer on that output and say when something is uncertain.",
].join(" ");

@Injectable({ providedIn: "root" })
export class PilotAIService {
  constructor(private config: ConfigService) {}

  async *chat(
    messages: any[],
    onToolCall: (toolCall: any) => Promise<boolean>,
    terminalTab?: BaseTerminalTabComponent<any> | null,
    providerType?: PilotProviderType,
    sessionId?: string,
  ) {
    const pilotConfig = this.config.store.pilot;
    const selectedProvider = providerType || pilotConfig.provider || 'anthropic';
    const providerConfig = this.getProviderConfig(selectedProvider);

    if (!providerConfig.apiKey) {
      throw new Error(
        "API key not configured for the selected provider. Please configure it in Settings > Pilot",
      );
    }

    if (!providerConfig.model) {
      throw new Error(
        "Model not configured for the selected provider. Please configure it in Settings > Pilot",
      );
    }

    const result = streamPilotChat({
      provider: selectedProvider,
      providerConfig,
      messages,
      instructions: PILOT_INSTRUCTIONS,
      maxTokens: pilotConfig.maxTokens || 4096,
      promptCacheKey: this.buildPromptCacheKey(selectedProvider, providerConfig.model, sessionId),
      executeTool: async ({ toolName, toolCallId, input }) => {
        if (toolName === "executeShell") {
          return this.runExecuteShell(input, toolCallId, onToolCall, terminalTab);
        }

        if (toolName === "readTerminalOutput") {
          return this.runReadTerminalOutput(input, toolCallId, onToolCall, terminalTab);
        }

        return { success: false, error: `Unknown tool: ${toolName}` };
      },
    });

    for await (const chunk of result) {
      yield chunk;
    }
  }

  private async runExecuteShell(
    input: any,
    toolCallId: string,
    onToolCall: (toolCall: any) => Promise<boolean>,
    terminalTab?: BaseTerminalTabComponent<any> | null,
  ) {
    const command = input?.command || "";
    const summary = input?.summary || "";
    const timeoutSeconds = input?.timeoutSeconds;
    const approved = await onToolCall({
      type: "tool-call",
      toolName: "executeShell",
      toolCallId,
      args: { command, summary },
    });

    if (!approved) {
      return {
        success: false,
        error: "User rejected the command execution",
        cancelled: true,
      };
    }

    try {
      // 如果有终端，发送命令到终端并捕获输出
      if (terminalTab && terminalTab.session) {
        const timeoutMs = (timeoutSeconds || 5) * 1000;
        const output = await this.executeInTerminal(
          terminalTab,
          command,
          timeoutMs,
        );
        return {
          success: true,
          output: output || "Command executed in terminal.",
          sentToTerminal: true,
        };
      }

      // 回退方案：使用 execSync 在本地执行
      const timeoutMs = (timeoutSeconds || 30) * 1000;
      const output = execSync(command, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: timeoutMs,
      });
      return {
        success: true,
        output: output.toString(),
        sentToTerminal: false,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        stderr: error.stderr?.toString() || "",
        stdout: error.stdout?.toString() || "",
      };
    }
  }

  private async runReadTerminalOutput(
    input: any,
    toolCallId: string,
    onToolCall: (toolCall: any) => Promise<boolean>,
    terminalTab?: BaseTerminalTabComponent<any> | null,
  ) {
    const timeoutSeconds = input?.timeoutSeconds;
    const approved = await onToolCall({
      type: "tool-call",
      toolName: "readTerminalOutput",
      toolCallId,
      args: { timeoutSeconds },
    });

    if (!approved) {
      return {
        success: false,
        error: "User rejected reading terminal output",
        cancelled: true,
      };
    }

    try {
      if (terminalTab && terminalTab.session) {
        const timeoutMs = (timeoutSeconds || 5) * 1000;
        const output = await this.readTerminalOutput(terminalTab, timeoutMs);
        return {
          success: true,
          output: output || "No additional output captured within timeout.",
        };
      }

      return {
        success: false,
        error: "No terminal available to read output from.",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 在终端中执行命令并捕获输出
   */
  private async executeInTerminal(
    terminalTab: BaseTerminalTabComponent<any>,
    command: string,
    timeout: number = 5000,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const outputBuffer: string[] = [];
      let timeoutHandle: any;

      // 订阅终端输出
      const subscription = terminalTab.session?.output$.subscribe((data) => {
        outputBuffer.push(data);
      });

      // 设置超时
      timeoutHandle = setTimeout(() => {
        subscription?.unsubscribe();
        const output = outputBuffer.join("");
        resolve(
          output || "Command executed (no output captured within timeout)",
        );
      }, timeout);

      // 发送命令
      terminalTab.sendInput(command + "\n");
    });
  }

  /**
   * 读取终端的额外输出（不发送命令，只监听）
   */
  private async readTerminalOutput(
    terminalTab: BaseTerminalTabComponent<any>,
    timeout: number = 5000,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const outputBuffer: string[] = [];
      let timeoutHandle: any;

      // 订阅终端输出
      const subscription = terminalTab.session?.output$.subscribe((data) => {
        outputBuffer.push(data);
      });

      // 设置超时
      timeoutHandle = setTimeout(() => {
        subscription?.unsubscribe();
        const output = outputBuffer.join("");
        resolve(output);
      }, timeout);
    });
  }

  validateConfig(): { valid: boolean; error?: string } {
    const pilotConfig = this.config.store.pilot;
    const selectedProvider = pilotConfig.provider || 'anthropic';
    const providerConfig = this.getProviderConfig(selectedProvider);

    if (!providerConfig.apiKey) {
      return { valid: false, error: "API Key is required" };
    }

    if (!providerConfig.model) {
      return { valid: false, error: "Model selection is required" };
    }

    return { valid: true };
  }

  private buildPromptCacheKey(
    provider: PilotProviderType,
    model: string,
    sessionId?: string,
  ): string | undefined {
    if (provider !== 'openai-responses' || !sessionId || !model) {
      return undefined;
    }

    return `tabby-pilot:${model}:${sessionId}`;
  }

  private getProviderConfig(provider: PilotProviderType): any {
    const pilotConfig = this.config.store.pilot;
    const providers = pilotConfig.providers || {};

    if (provider === 'openai-responses') {
      return providers.openaiResponses || {};
    }
    if (provider === 'openai-chat') {
      return providers.openaiChat || {};
    }
    return providers.anthropic || {};
  }
}
