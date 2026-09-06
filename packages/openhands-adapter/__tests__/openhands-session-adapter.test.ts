import { OpenHandsSessionAdapter } from '../src/openhands-session-adapter';

describe('OpenHandsSessionAdapter mappings', () => {
  it('maps assistant events to Cortex messages', () => {
    expect(OpenHandsSessionAdapter.fromOpenHandsEvent({ id: 'm1', type: 'message', content: 'done' }, 'agent')).toMatchObject({
      id: 'm1', role: 'assistant', content: 'done', metadata: { type: 'message', agentId: 'agent' },
    });
  });

  it('maps actions and observations', () => {
    const action = OpenHandsSessionAdapter.fromOpenHandsAction({ id: 'a1', action: 'run', args: { command: 'ls' } }, 'agent');
    expect(action).toMatchObject({ id: 'a1', type: 'run', parameters: { command: 'ls' } });
    expect(OpenHandsSessionAdapter.fromOpenHandsObservation({ id: 'o1', type: 'result', result: 'ok' }, 'a1')).toMatchObject({
      id: 'o1', actionId: 'a1', type: 'result', data: 'ok', success: true,
    });
  });
});
