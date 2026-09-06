import { Session, AgentMessage, AgentAction, AgentObservation, EntityId } from '@cortex/core';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();

  create(agentId: string): Session {
    const session: Session = {
      id: crypto.randomUUID(),
      agentId,
      messages: [],
      actions: [],
      observations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  list(agentId?: string): Session[] {
    const all = Array.from(this.sessions.values());
    if (agentId) {
      return all.filter((s) => s.agentId === agentId);
    }
    return all;
  }

  appendMessage(sessionId: string, message: AgentMessage): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push(message);
      session.updatedAt = new Date();
    }
  }

  appendAction(sessionId: string, action: AgentAction): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.actions.push(action);
      session.updatedAt = new Date();
    }
  }

  appendObservation(sessionId: string, observation: AgentObservation): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.observations.push(observation);
      session.updatedAt = new Date();
    }
  }

  close(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.updatedAt = new Date();
    }
  }
}
