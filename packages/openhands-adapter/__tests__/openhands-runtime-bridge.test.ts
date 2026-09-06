import { execSync } from 'child_process';
import { OpenHandsRuntimeBridge } from '../src/openhands-runtime-bridge';

const isOpenHandsAvailable = (): boolean => {
  try {
    execSync('which openhands-agent-server', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

describe('OpenHandsRuntimeBridge', () => {
  it('should instantiate', () => {
    const bridge = new OpenHandsRuntimeBridge({ serverUrl: 'http://127.0.0.1:3000' });
    expect(bridge.engine).toBe('openhands');
  });

  it('should report not started', async () => {
    const bridge = new OpenHandsRuntimeBridge({ serverUrl: 'http://127.0.0.1:3000' });
    expect(await bridge.healthCheck()).toBe(false);
  });

  it('should start without real server', async () => {
    const bridge = new OpenHandsRuntimeBridge({ serverUrl: 'http://127.0.0.1:3000' });
    await expect(bridge.start()).resolves.toBeUndefined();
    expect(bridge.engine).toBe('openhands');
    await bridge.stop();
  });

  it('should skip createSession when manager is unavailable', async () => {
    const bridge = new OpenHandsRuntimeBridge({ serverUrl: 'http://127.0.0.1:3000' });
    await expect(bridge.createSession({ title: 'test', agent: 'default', model: 'default' })).rejects.toThrow('OpenHands runtime not started');
  });

  it('should run real integration when server is available', async () => {
    if (!isOpenHandsAvailable()) {
      console.log('SKIP: openhands-agent-server not available');
      return;
    }
    const bridge = new OpenHandsRuntimeBridge({ serverUrl: 'http://127.0.0.1:3000' });
    await bridge.start();
    expect(await bridge.healthCheck()).toBe(true);
    const conversationId = await bridge.createSession({ title: 'integration-test', agent: 'default', model: 'default' });
    expect(typeof conversationId).toBe('string');
    expect(conversationId.length).toBeGreaterThan(0);
    await bridge.closeSession(conversationId);
    await bridge.stop();
  }, 60000);
});
