import { Session, AgentMessage, AgentAction, AgentObservation, EntityId } from '@cortex/core';

/**
 * KiloSessionAdapter bridges Kilo's session model into Cortex's Session interface.
 *
 * Kilo sessions are:
 * - Event-sourced (durable events in SQLite)
 * - Identified by SessionSchema.ID
 * - Managed by SessionV2.Service
 * - Have messages, events, and execution state
 */
export class KiloSessionAdapter implements Session {
  id: EntityId;
  agentId: EntityId;
  messages: AgentMessage[];
  actions: AgentAction[];
  observations: AgentObservation[];
  createdAt: Date;
  updatedAt: Date;
  context?: Record<string, unknown>;

  private kiloSessionId?: string;
  private messageMap: Map<string, EntityId> = new Map();

  constructor(kiloSessionId: string, agentId: EntityId) {
    this.id = crypto.randomUUID();
    this.kiloSessionId = kiloSessionId;
    this.agentId = agentId;
    this.messages = [];
    this.actions = [];
    this.observations = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  getKiloSessionId(): string | undefined {
    return this.kiloSessionId;
  }

  /**
   * Convert a Kilo session event to a Cortex message
   */
  static fromKiloEvent(kiloEvent: unknown, agentId: EntityId): AgentMessage | null {
    // TODO: Map Kilo event types to Cortex messages
    // Kilo events include: Prompted, PromptAdmitted, Step.Started/Ended,
    // Text.Started/Delta/Ended, Tool.Called, Tool.Success, Tool.Failed, etc.
    return null;
  }

  /**
   * Convert a Kilo tool call to a Cortex action
   */
  static fromKiloToolCall(kiloToolCall: unknown, agentId: EntityId): AgentAction | null {
    // TODO: Map Kilo tool call to Cortex action
    return null;
  }

  /**
   * Convert a Kilo tool result to a Cortex observation
   */
  static fromKiloToolResult(kiloResult: unknown, actionId: EntityId): AgentObservation | null {
    // TODO: Map Kilo tool result to Cortex observation
    return null;
  }
}
