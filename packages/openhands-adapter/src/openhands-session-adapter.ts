import { Session, AgentMessage, AgentAction, AgentObservation, EntityId } from '@cortex/core';

/**
 * OpenHandsSessionAdapter bridges OpenHands conversations into Cortex's Session interface.
 *
 * OpenHands conversations are:
 * - Identified by conversation_id
 * - Have events streamed via WebSocket
 * - Include messages, actions, observations
 * - Managed via REST API
 */
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

  /**
   * Convert OpenHands event to Cortex message
   */
  static fromOpenHandsEvent(event: unknown, agentId: EntityId): AgentMessage | null {
    // TODO: Map OpenHands event types
    // OpenHands events include: ohai, agent_event, error, memory, etc.
    return null;
  }

  /**
   * Convert OpenHands action to Cortex action
   */
  static fromOpenHandsAction(action: unknown, agentId: EntityId): AgentAction | null {
    // TODO: Map OpenHands Action objects
    return null;
  }

  /**
   * Convert OpenHands observation to Cortex observation
   */
  static fromOpenHandsObservation(observation: unknown, actionId: EntityId): AgentObservation | null {
    // TODO: Map OpenHands Observation objects
    return null;
  }
}
