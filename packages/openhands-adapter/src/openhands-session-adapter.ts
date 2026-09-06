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
    return null;
  }

  static fromOpenHandsAction(action: unknown, agentId: EntityId): AgentAction | null {
    return null;
  }

  static fromOpenHandsObservation(observation: unknown, actionId: EntityId): AgentObservation | null {
    return null;
  }
}
