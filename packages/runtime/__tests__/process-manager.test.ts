import { ProcessManager, ManagedProcess } from '../src/process-manager';

describe('ProcessManager', () => {
  let manager: ProcessManager;

  beforeEach(() => {
    manager = new ProcessManager();
  });

  afterEach(() => {
    manager.killAll();
  });

  it('should spawn and track a process', async () => {
    const process = manager.spawn('test-echo', 'node', ['-e', 'console.log("hello");']);
    expect(process.command).toBe('node');
    expect(process.args).toEqual(['-e', 'console.log("hello");']);
    expect(manager.get('test-echo')).toBe(process);
  });

  it('should throw when spawning duplicate id', async () => {
    manager.spawn('dup', 'node', ['-e', '1']);
    expect(() => manager.spawn('dup', 'node', ['-e', '2'])).toThrow();
  });

  it('should report isRunning', async () => {
    const process = manager.spawn('long-run', 'node', ['-e', 'setTimeout(() => process.exit(0), 5000)']);
    await process.start();
    expect(process.isRunning()).toBe(true);
    manager.kill('long-run');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(process.isRunning()).toBe(false);
  });

  it('should kill all processes', async () => {
    manager.spawn('p1', 'node', ['-e', 'setTimeout(() => process.exit(0), 5000)']);
    manager.spawn('p2', 'node', ['-e', 'setTimeout(() => process.exit(0), 5000)']);
    manager.killAll();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(manager.get('p1')).toBeUndefined();
    expect(manager.get('p2')).toBeUndefined();
  });
});
