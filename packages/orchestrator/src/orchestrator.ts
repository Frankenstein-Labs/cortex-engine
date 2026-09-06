import {
  AgentPool,
  AgentCommunication,
  Orchestrator,
  OrchestratorStatus,
  Mission,
  MissionResult,
  Task,
  EventBus,
  TaskGraph,
  SharedArtifact,
} from '@cortex/core';

export class DefaultAgentCommunication implements AgentCommunication {
  private artifacts: Map<string, SharedArtifact> = new Map();
  private messageQueue: Map<string, unknown[]> = new Map();

  async send(from: string, to: string, message: unknown): Promise<void> {
    const key = `${to}:inbox`;
    const queue = this.messageQueue.get(key) || [];
    queue.push({ from, message, timestamp: new Date() });
    this.messageQueue.set(key, queue);
  }

  async broadcast(from: string, message: unknown, recipients?: string[]): Promise<void> {
    if (!recipients) return;
    for (const to of recipients) {
      await this.send(from, to, message);
    }
  }

  async postToSharedArtifact(from: string, artifactId: string, data: unknown): Promise<void> {
    this.artifacts.set(artifactId, {
      id: artifactId,
      type: 'result',
      data,
      createdBy: from,
      createdAt: new Date(),
    });
  }

  async getSharedArtifact(artifactId: string): Promise<unknown> {
    const artifact = this.artifacts.get(artifactId);
    return artifact?.data;
  }

  getMessages(agentId: string): unknown[] {
    const key = `${agentId}:inbox`;
    return this.messageQueue.get(key) || [];
  }

  clearMessages(agentId: string): void {
    const key = `${agentId}:inbox`;
    this.messageQueue.set(key, []);
  }
}

export class DefaultOrchestrator implements Orchestrator {
  private status: OrchestratorStatus = {
    status: 'idle',
    activeAgents: 0,
    pendingTasks: 0,
    runningTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
  };
  private agentPool!: AgentPool;
  private taskGraph!: TaskGraph;
  private eventBus!: EventBus;
  private communication!: AgentCommunication;
  private running = false;

  constructor(
    agentPool: AgentPool,
    taskGraph: TaskGraph,
    eventBus: EventBus,
    communication: AgentCommunication
  ) {
    this.agentPool = agentPool;
    this.taskGraph = taskGraph;
    this.eventBus = eventBus;
    this.communication = communication;
  }

  async start(): Promise<void> {
    this.running = true;
    this.status.status = 'running';
  }

  async stop(): Promise<void> {
    this.running = false;
    this.status.status = 'idle';
  }

  async submitMission(mission: Mission): Promise<MissionResult> {
    if (!this.running) {
      throw new Error('Orchestrator is not running');
    }

    const startTime = Date.now();
    const completedTasks: Task[] = [];
    const failedTasks: Task[] = [];
    let totalTokens = 0;
    let totalCost = 0;

    for (const task of mission.tasks) {
      this.taskGraph.addTask(task);
    }

    let pendingCount = mission.tasks.length;
    while (pendingCount > 0 && this.running) {
      const readyTasks = this.taskGraph.getReadyTasks();
      if (readyTasks.length === 0) break;

      for (const task of readyTasks) {
        const agents = this.agentPool.getAvailableAgents(task.role);
        if (agents.length === 0) {
          this.status.pendingTasks += 1;
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }

        const agent = agents[0];
        this.status.runningTasks += 1;
        this.status.pendingTasks -= 1;

        try {
          const result = await this.agentPool.assignTask(task, agent.config.id);
          if (result.success) {
            this.taskGraph.markTaskStatus(task.id, 'completed', result.output);
            completedTasks.push(task);
            totalTokens += result.metrics.tokensUsed;
            totalCost += result.metrics.cost;
          } else {
            this.taskGraph.markTaskStatus(task.id, 'failed', undefined, result.error);
            failedTasks.push(task);
          }
        } catch (err) {
          this.taskGraph.markTaskStatus(task.id, 'failed', undefined, err instanceof Error ? err.message : String(err));
          failedTasks.push(task);
        } finally {
          this.status.runningTasks -= 1;
          this.status.completedTasks += 1;
          pendingCount -= 1;
        }
      }
    }

    return {
      success: failedTasks.length === 0,
      completedTasks,
      failedTasks,
      metrics: {
        totalDurationMs: Date.now() - startTime,
        totalTokens,
        totalCost,
        agentCount: this.agentPool.listAgents().length,
      },
    };
  }

  getStatus(): OrchestratorStatus {
    return { ...this.status };
  }
}
