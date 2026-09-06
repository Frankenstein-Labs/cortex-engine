import { Session, AgentMessage, AgentAction, AgentObservation, EntityId } from '@cortex/core';

export class OpenHandsSessionAdapter implements Session {
  id: EntityId;
  agentId: EntityId;
  messages: AgentMessage[];
  actions: AgentAction[];
  observations: AgentObservation[];
  createdAt: Date;
  updatedAt: Date;
  context?: Record<string, unknown>;

  private conversationId?: string;

  constructor(conversationId: string, agentId: EntityId) {
    this.id = crypto.randomUUID();
    this.conversationId = conversationId;
    this.agentId = agentId;
    this.messages = [];
    this.actions = [];
    this.observations = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  getConversationId(): string | undefined {
    return this.conversationId;
  }

  static fromOpenHandsEvent(event: unknown, agentId: EntityId): AgentMessage | null {
    const value = event as { id?: string; kind?: string; type?: string; message?: string; content?: string; timestamp?: string | number; data?: unknown };
    const content = value.message ?? value.content;
    if (typeof content !== 'string') return null;
    return { id: value.id ?? crypto.randomUUID(), role: 'assistant', content, timestamp: value.timestamp ? new Date(value.timestamp) : new Date(), metadata: { type: value.kind ?? value.type, agentId, data: value.data } };
  }

  static fromOpenHandsAction(action: unknown, agentId: EntityId): AgentAction | null {
    const value = action as { id?: string; action?: string; type?: string; args?: Record<string, unknown>; arguments?: Record<string, unknown>; timestamp?: string | number };
    const type = value.action ?? value.type;
    if (typeof type !== 'string') return null;
    return { id: value.id ?? crypto.randomUUID(), type, parameters: value.args ?? value.arguments ?? {}, timestamp: value.timestamp ? new Date(value.timestamp) : new Date() };
  }

  static fromOpenHandsObservation(observation: unknown, actionId: EntityId): AgentObservation | null {
    const value = observation as { id?: string; type?: string; content?: unknown; result?: unknown; success?: boolean; error?: string; timestamp?: string | number };
    if (!value.type && value.content === undefined && value.result === undefined) return null;
    return { id: value.id ?? crypto.randomUUID(), actionId, type: value.type ?? 'tool.result', data: value.content ?? value.result, timestamp: value.timestamp ? new Date(value.timestamp) : new Date(), success: value.success ?? !value.error, error: value.error };
  }
}
