import { Task, TaskGraph, TaskStatus, TaskBudget } from './types';

export class InMemoryTaskGraph implements TaskGraph {
  tasks: Map<string, Task> = new Map();
  edges: Array<{ from: string; to: string }> = [];

  addTask(task: Task): void {
    this.tasks.set(task.id, task);
  }

  addDependency(from: string, to: string): void {
    const fromTask = this.tasks.get(from);
    const toTask = this.tasks.get(to);
    if (!fromTask || !toTask) {
      throw new Error(`Task not found: ${from} or ${to}`);
    }
    if (!toTask.dependencies.includes(from)) {
      toTask.dependencies.push(from);
    }
    this.edges.push({ from, to });
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getReadyTasks(): Task[] {
    const ready: Task[] = [];
    for (const task of this.tasks.values()) {
      if (task.status === 'pending' || task.status === 'waiting') {
        const allDepsCompleted = task.dependencies.every(
          (depId) => {
            const dep = this.tasks.get(depId);
            return dep && dep.status === 'completed';
          }
        );
        if (allDepsCompleted) {
          ready.push(task);
        }
      }
    }
    return ready;
  }

  getNextTask(taskId: string): Task | null {
    const outgoingEdges = this.edges.filter((e) => e.from === taskId);
    if (outgoingEdges.length === 0) return null;
    const nextId = outgoingEdges[0].to;
    return this.tasks.get(nextId) || null;
  }

  markTaskStatus(id: string, status: TaskStatus, result?: unknown, error?: string): void {
    const task = this.tasks.get(id);
    if (!task) return;
    task.status = status;
    task.updatedAt = new Date();
    if (result) task.result = result;
    if (error) task.error = error;
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      task.completedAt = new Date();
    }
    if (status === 'running' && !task.startedAt) {
      task.startedAt = new Date();
    }
  }
}

export function createTask(overrides: Partial<Task> = {}): Task {
  const now = new Date();
  const budget: TaskBudget = {
    maxTokens: 10000,
    maxToolCalls: 50,
    maxDurationMs: 300000,
    ...(overrides.budget || {}),
  };
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    status: 'pending',
    priority: 'medium',
    dependencies: [],
    budget,
    timeoutMs: 300000,
    retryCount: 0,
    maxRetries: 2,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
