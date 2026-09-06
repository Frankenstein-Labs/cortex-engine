import { InMemoryTaskGraph, createTask, TaskStatus } from '../src/index';

describe('InMemoryTaskGraph', () => {
  it('should add and retrieve tasks', () => {
    const graph = new InMemoryTaskGraph();
    const task = createTask({ name: 'Task 1' });
    graph.addTask(task);
    
    expect(graph.getTask(task.id)).toBe(task);
    expect(graph.getAllTasks()).toHaveLength(1);
  });

  it('should return ready tasks', () => {
    const graph = new InMemoryTaskGraph();
    const taskA = createTask({ name: 'Task A' });
    const taskB = createTask({ name: 'Task B', dependencies: [taskA.id] });
    
    graph.addTask(taskA);
    graph.addTask(taskB);
    
    const ready = graph.getReadyTasks();
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe(taskA.id);
  });

  it('should mark task status', () => {
    const graph = new InMemoryTaskGraph();
    const task = createTask({ name: 'Task 1' });
    graph.addTask(task);
    
    graph.markTaskStatus(task.id, 'completed', { done: true });
    
    const updated = graph.getTask(task.id)!;
    expect(updated.status).toBe('completed');
    expect(updated.result).toEqual({ done: true });
    expect(updated.completedAt).toBeDefined();
  });
});
