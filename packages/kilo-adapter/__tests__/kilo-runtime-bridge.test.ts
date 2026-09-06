import { execSync } from 'child_process';
import { KiloRuntimeBridge } from '../src/kilo-runtime-bridge';

const isKiloAvailable = (): boolean => {
  try {
    execSync('which kilo', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

describe('KiloRuntimeBridge', () => {
  it('should instantiate', () => {
    const bridge = new KiloRuntimeBridge({ port: 4097 });
    expect(bridge.engine).toBe('kilo');
  });

  it('should report not started', async () => {
    const bridge = new KiloRuntimeBridge({ port: 4098 });
    expect(await bridge.healthCheck()).toBe(false);
  });

  it('should start and stop', async () => {
    const bridge = new KiloRuntimeBridge({ port: 4099 });
    if (!isKiloAvailable()) {
      await expect(bridge.start()).rejects.toThrow();
      return;
    }
    await bridge.start();
    expect(await bridge.healthCheck()).toBe(true);
    await bridge.stop();
    expect(await bridge.healthCheck()).toBe(false);
  }, 30000);

  it('should create a session', async () => {
    const bridge = new KiloRuntimeBridge({ port: 4100 });
    if (!isKiloAvailable()) {
      await expect(bridge.start()).rejects.toThrow();
      return;
    }
    await bridge.start();
    const sessionId = await bridge.createSession({ title: 'test-session', agent: 'build', model: 'default' });
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(0);
    await bridge.closeSession(sessionId);
    await bridge.stop();
  }, 30000);

  it('should send a prompt', async () => {
    const bridge = new KiloRuntimeBridge({ port: 4101 });
    if (!isKiloAvailable()) {
      await expect(bridge.start()).rejects.toThrow();
      return;
    }
    await bridge.start();
    const sessionId = await bridge.createSession({ title: 'prompt-test', agent: 'build', model: 'default' });
    const result = await bridge.sendPrompt(sessionId, 'Hello, Kilo!');
    expect(result).toBeDefined();
    await bridge.closeSession(sessionId);
    await bridge.stop();
  }, 60000);
});
