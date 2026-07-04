import { Component, Input, HostBinding, OnInit, OnDestroy, Injector, ViewChild, ElementRef } from '@angular/core'
import { BaseTabComponent, SplitTabComponent, RecoveryToken } from 'tabby-core'
import { BaseTerminalTabComponent } from 'tabby-terminal'
import { PilotAIService } from '../services/ai.service'
import { SessionService } from '../services/session.service'
import { ChatMessage, ToolExecution, ToolCall, MessagePart, PilotProviderType } from '../api/interfaces'
import { Subject } from 'rxjs'

@Component({
    selector: 'pilot-tab',
    template: require('./pilotTab.component.pug'),
    styles: [require('./pilotTab.component.scss')],
})
export class PilotTabComponent extends BaseTabComponent implements OnInit, OnDestroy {
    @Input() sessionId?: string
    @ViewChild('inputTextarea') inputTextarea?: ElementRef<HTMLTextAreaElement>
    @ViewChild('messageForm') messageForm?: ElementRef<HTMLFormElement>

    @HostBinding('class.pilot-tab') true

    messages: ChatMessage[] = []
    currentSessionId: string = ''
    inputText: string = ''
    isLoading: boolean = false
    isComposing: boolean = false
    currentMessageParts: MessagePart[] = [] // 当前正在构建的消息片段
    pendingToolExecutions: ToolExecution[] = []
    error: string | null = null
    currentProvider: PilotProviderType = 'anthropic'

    private destroy$ = new Subject<void>()
    private currentMessageId: string = ''
    private currentAssistantMessage: ChatMessage | null = null
    private abortController: AbortController | null = null

    constructor(
        injector: Injector,
        private ai: PilotAIService,
        private session: SessionService,
    ) {
        super(injector)
    }

    ngOnInit(): void {
        // 优先使用传入的 sessionId
        if (this.sessionId) {
            const session = this.session.getSession(this.sessionId)
            if (session) {
                this.currentSessionId = this.sessionId
                this.currentProvider = session.provider || 'anthropic'
                // 深拷贝消息数组，并去重（基于消息 id）
                const messageMap = new Map<string, ChatMessage>()
                session.messages.forEach(msg => {
                    if (!messageMap.has(msg.id)) {
                        messageMap.set(msg.id, { 
                            ...msg,
                            parts: msg.parts ? [...msg.parts] : undefined 
                        })
                    }
                })
                this.messages = Array.from(messageMap.values())
            } else {
                // Session 不存在，创建新的
                const newSession = this.session.createSession()
                this.currentSessionId = newSession.id
                this.sessionId = newSession.id
                this.currentProvider = newSession.provider || 'anthropic'
            }
        }

        // 如果还没有 session，创建新的
        if (!this.currentSessionId) {
            const newSession = this.session.createSession()
            this.currentSessionId = newSession.id
            this.sessionId = newSession.id
            this.currentProvider = newSession.provider || 'anthropic'
        }

        this.setTitle('Pilot Chat')
    }

    ngOnDestroy(): void {
        this.destroy$.next()
        this.destroy$.complete()
    }

    focusInput(): void {
        setTimeout(() => {
            this.inputTextarea?.nativeElement.focus()
        }, 100)
    }

    /**
     * 获取分屏中的终端窗格
     */
    private getTerminalTab(): BaseTerminalTabComponent<any> | null {
        // 如果当前 tab 在 SplitTab 中
        if (this.parent instanceof SplitTabComponent) {
            const allTabs = this.parent.getAllTabs()
            // 查找第一个终端 tab（通常是左侧的）
            const terminalTab = allTabs.find(tab => 
                tab instanceof BaseTerminalTabComponent
            ) as BaseTerminalTabComponent<any> | undefined
            
            return terminalTab || null
        }
        return null
    }

    handleInputKeydown(event: KeyboardEvent): void {
        if (event.key !== 'Enter' || event.shiftKey) {
            return
        }

        // 中文输入法选词时，Enter 应该交给 IME，而不是触发发送
        if (event.isComposing || this.isComposing || event.keyCode === 229) {
            return
        }

        event.preventDefault()
        this.submitMessageForm()
    }

    handleCompositionStart(): void {
        this.isComposing = true
    }

    handleCompositionEnd(): void {
        this.isComposing = false
    }

    private submitMessageForm(): void {
        const form = this.messageForm?.nativeElement
        if (form?.requestSubmit) {
            form.requestSubmit()
            return
        }

        this.sendMessage()
    }

    async sendMessage(): Promise<void> {
        if (!this.inputText.trim() || this.isLoading) {
            return
        }

        this.error = null
        const userMessage: ChatMessage = {
            id: this.generateId(),
            role: 'user',
            content: this.inputText.trim(),
            timestamp: Date.now(),
        }

        this.messages.push(userMessage)
        this.session.addMessage(this.currentSessionId, userMessage)
        
        this.inputText = ''
        this.isLoading = true
        this.abortController = new AbortController()

        const aiMessages = this.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        }))

        this.currentMessageId = this.generateId()
        this.currentMessageParts = []
        this.currentAssistantMessage = {
            id: this.currentMessageId,
            role: 'assistant',
            content: '',
            parts: this.currentMessageParts,
            timestamp: Date.now(),
        }
        this.messages.push(this.currentAssistantMessage)
        this.session.addMessage(this.currentSessionId, this.currentAssistantMessage)

        try {
            // 获取终端引用
            const terminalTab = this.getTerminalTab()

            const stream = this.ai.chat(aiMessages, async (toolCall) => {
                return await this.handleToolCall(toolCall)
            }, terminalTab, this.currentProvider, this.currentSessionId)

            for await (const chunk of stream) {
                // 检查是否被中断
                if (this.abortController?.signal.aborted) {
                    break
                }
                
                if (chunk.type === 'text-delta') {
                    this.appendAssistantText(chunk.textDelta || '')
                } else if (chunk.type === 'tool-call') {
                    console.log('Tool call:', chunk)

                    const toolCall: ToolCall = {
                        id: chunk.toolCallId || this.generateId(),
                        type: 'tool-call',
                        toolName: chunk.toolName || '',
                        args: chunk.args || {},
                        status: 'pending',
                    }
                    this.appendAssistantToolCall(toolCall)
                } else if (chunk.type === 'tool-result') {
                    console.log('Tool result:', chunk)
                } else if (chunk.type === 'finish') {
                    break
                }
            }

        } catch (error: any) {
            console.error('Error in chat:', error)
            if (error.name !== 'AbortError') {
                this.error = error.message || 'An error occurred'
            }
        } finally {
            if (this.currentAssistantMessage) {
                if (this.hasAssistantOutput()) {
                    this.syncCurrentAssistantMessage(true)
                } else {
                    this.removeMessage(this.currentAssistantMessage.id)
                }
            }

            this.isLoading = false
            this.abortController = null
            this.currentMessageParts = []
            this.currentMessageId = ''
            this.currentAssistantMessage = null
        }
    }

    async handleToolCall(toolCall: any): Promise<boolean> {
        return new Promise((resolve) => {
            // 使用 AI SDK 提供的 toolCallId 作为唯一标识
            const execution: ToolExecution = {
                id: toolCall.toolCallId,
                toolName: toolCall.toolName,
                parameters: toolCall.args,
                status: 'pending',
                resolveCallback: resolve,
            }

            this.pendingToolExecutions.push(execution)
        })
    }

    approveToolCall(toolCall: ToolCall): void {
        toolCall.status = 'approved'
        
        // 查找对应的 execution 并调用回调
        const execution = this.pendingToolExecutions.find(e => e.id === toolCall.id)
        if (execution && execution.resolveCallback) {
            execution.resolveCallback(true)
            this.pendingToolExecutions = this.pendingToolExecutions.filter(e => e.id !== execution.id)
        }
        
        // 更新会话存储
        this.updateToolCallInParts(toolCall)
    }

    rejectToolCall(toolCall: ToolCall): void {
        toolCall.status = 'rejected'
        
        // 查找对应的 execution 并调用回调
        const execution = this.pendingToolExecutions.find(e => e.id === toolCall.id)
        if (execution && execution.resolveCallback) {
            execution.resolveCallback(false)
            this.pendingToolExecutions = this.pendingToolExecutions.filter(e => e.id !== execution.id)
        }
        
        // 更新会话存储
        this.updateToolCallInParts(toolCall)
    }

    private updateToolCallInParts(toolCall: ToolCall): void {
        // 更新当前正在构建的消息片段
        for (const part of this.currentMessageParts) {
            if (part.type === 'tool-call' && part.toolCall?.id === toolCall.id) {
                part.toolCall = toolCall
                this.syncCurrentAssistantMessage(true)
                return
            }
        }
        
        // 更新已保存消息中的 toolCall
        for (const message of this.messages) {
            if (message.parts) {
                for (const part of message.parts) {
                    if (part.type === 'tool-call' && part.toolCall?.id === toolCall.id) {
                        part.toolCall = toolCall
                        this.session.updateMessage(this.currentSessionId, message)
                        return
                    }
                }
            }
        }
    }

    newChat(): void {
        const newSession = this.session.createSession()
        this.currentSessionId = newSession.id
        this.sessionId = newSession.id
        this.currentProvider = newSession.provider || 'anthropic'
        this.messages = []
        this.error = null
        this.recoveryStateChangedHint.next()
    }

    clearChat(): void {
        this.session.clearSession(this.currentSessionId)
        this.messages = []
        this.error = null
    }

    closeSidebar(): void {
        // 在关闭前，将 sessionId 保存到 parent SplitTab 上，以便下次打开时恢复
        if (this.parent && this.currentSessionId) {
            (this.parent as any).__pilotSessionId = this.currentSessionId;
        }
        this.destroy()
    }

    stopResponse(): void {
        if (this.abortController) {
            this.abortController.abort()
        }
    }

    isStreamingMessage(message: ChatMessage): boolean {
        return this.isLoading && message.id === this.currentMessageId
    }

    private appendAssistantText(textDelta: string): void {
        if (!textDelta || !this.currentAssistantMessage) {
            return
        }

        const lastPart = this.currentMessageParts[this.currentMessageParts.length - 1]
        if (lastPart?.type === 'text') {
            lastPart.text = (lastPart.text || '') + textDelta
        } else {
            this.currentMessageParts.push({
                type: 'text',
                text: textDelta,
            })
        }

        this.syncCurrentAssistantMessage()
    }

    private appendAssistantToolCall(toolCall: ToolCall): void {
        if (!this.currentAssistantMessage) {
            return
        }

        this.currentMessageParts.push({
            type: 'tool-call',
            toolCall,
        })
        this.syncCurrentAssistantMessage()
    }

    private hasAssistantOutput(): boolean {
        return this.currentMessageParts.length > 0 || !!this.currentAssistantMessage?.content
    }

    private syncCurrentAssistantMessage(persist: boolean = false): void {
        if (!this.currentAssistantMessage) {
            return
        }

        this.currentAssistantMessage.parts = this.currentMessageParts
        this.currentAssistantMessage.content = this.currentMessageParts
            .filter(part => part.type === 'text')
            .map(part => part.text || '')
            .join('')

        if (persist) {
            this.session.updateMessage(this.currentSessionId, this.currentAssistantMessage)
        }
    }

    private removeMessage(messageId: string): void {
        this.messages = this.messages.filter(message => message.id !== messageId)
        this.session.removeMessage(this.currentSessionId, messageId)
    }

    private generateId(): string {
        return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    get providerLabel(): string {
        if (this.currentProvider === 'openai-responses') {
            return 'OpenAI Responses'
        }
        if (this.currentProvider === 'openai-chat') {
            return 'OpenAI Chat'
        }
        return 'Anthropic'
    }

    /**
     * 实现 Tab Recovery: 序列化标签状态以便 Tabby 重启后恢复
     */
    async getRecoveryToken(): Promise<RecoveryToken> {
        return {
            type: 'app:pilot-chat',
            sessionId: this.currentSessionId || this.sessionId,
        }
    }
}
