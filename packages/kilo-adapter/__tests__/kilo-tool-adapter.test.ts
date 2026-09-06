import { KiloToolAdapter } from '../src/kilo-tool-adapter';

const context = {
  agentId: 'agent',
  sessionId: 'session',
  runtime: {},
  workspace: { id: 'workspace', rootPath: '/tmp' },
  permissions: {},
} as any;

describe('KiloToolAdapter', () => {
  it('executes a tool through the Kilo session command endpoint', async () => {
    const command = jest.fn().mockResolvedValue({ data: { output: 'ok' } });
    const adapter = new KiloToolAdapter({}, { session: { command } });

    await expect(adapter.execute({ value: 1 }, context)).resolves.toEqual({ success: true, data: { output: 'ok' } });
    expect(command).toHaveBeenCalledWith({
      path: { id: 'session' },
      body: { command: 'kilo.tool', arguments: '{"value":1}' },
    });
  });

  it('converts a Kilo input schema into Cortex parameters', () => {
    expect(KiloToolAdapter.fromKiloDefinition({
      inputSchema: {
        properties: { path: { type: 'string', description: 'file path' } },
        required: ['path'],
      },
    })).toEqual([{ name: 'path', type: 'string', description: 'file path', required: true, default: undefined }]);
  });
});
