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
});
