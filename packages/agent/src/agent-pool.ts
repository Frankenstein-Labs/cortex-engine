import { Agent, AgentConfig, Task, TaskResult } from '@cortex/core';

export class AgentPool {
  private agents: Map<string, Agent> = new Map();

  async createAgent(config: AgentConfig): Promise<Agent> {
    throw new Error('createAgent must be implemented by subclass');
  }

  registerAgent(agent: Agent): void {
    this.agents.set(agent.config.id, agent);
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  async removeAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (agent) {
      await agent.stop();
      this.agents.delete(id);
    }
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAvailableAgents(role?: string): Agent[] {
    return Array.from(this.agents.values()).filter((agent) => {
      if (role && agent.config.role !== role && agent.config.role !== 'custom') {
        return false;
      }
      return agent.state.status === 'idle';
    });
  }

  async assignTask(task: Task, agentId: string): Promise<TaskResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    return agent.execute(task);
  }
}
