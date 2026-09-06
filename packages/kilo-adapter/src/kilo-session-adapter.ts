import { Session, AgentMessage, AgentAction, AgentObservation, EntityId } from '@cortex/core';

export interface KiloSessionData {
  id: string;
  title?: string;
  agent?: string;
  model?: string;
  createdAt?: string;
  updatedAt?: string;
}

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
  private kiloSessionData?: KiloSessionData;

  constructor(kiloSessionId: string, agentId: EntityId, kiloSessionData?: KiloSessionData) {
    this.id = crypto.randomUUID();
    this.kiloSessionId = kiloSessionId;
    this.agentId = agentId;
    this.kiloSessionData = kiloSessionData;
    this.messages = [];
    this.actions = [];
    this.observations = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  getKiloSessionId(): string | undefined {
    return this.kiloSessionId;
  }

  updateFromKilo(data: KiloSessionData): void {
    this.kiloSessionData = data;
    this.updatedAt = new Date();
  }

  static fromKiloResponse(data: KiloSessionData, agentId: EntityId): KiloSessionAdapter {
    const adapter = new KiloSessionAdapter(data.id, agentId, data);
    adapter.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    adapter.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    return adapter;
  }
}
