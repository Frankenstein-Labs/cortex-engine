import { Tool, ToolContext, ToolResult, ToolParameter, PermissionAction, RuntimeCapability } from '@cortex/core';

export class KiloToolAdapter implements Tool {
  name: string;
  description: string;
  version: string;
  parameters: ToolParameter[];
  requiredPermissions: PermissionAction[];
  runtimeRequirements: RuntimeCapability[];

  private kiloTool: unknown;
  private kiloClient: unknown;

  constructor(kiloTool: unknown, kiloClient: unknown) {
    this.kiloTool = kiloTool;
    this.kiloClient = kiloClient;
    this.name = 'kilo.tool';
    this.description = 'Kilo tool';
    this.version = '1.0.0';
    this.parameters = [];
    this.requiredPermissions = [];
    this.runtimeRequirements = [];
  }

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const client = this.kiloClient as { session?: { command?: (options: unknown) => Promise<{ data?: unknown }> } };
    try {
      if (client?.session?.command) {
        const result = await client.session.command({ path: { id: context.sessionId }, body: { command: this.name, arguments: JSON.stringify(params) } });
        return { success: true, data: result.data };
      }
      const tool = this.kiloTool as { execute?: (params: Record<string, unknown>, context?: ToolContext) => Promise<unknown>; call?: (params: Record<string, unknown>) => Promise<unknown> };
      if (typeof tool?.execute === 'function') return { success: true, data: await tool.execute(params, context) };
      if (typeof tool?.call === 'function') return { success: true, data: await tool.call(params) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
    return { success: false, error: `Kilo tool is not executable: ${this.name}` };
  }

  static fromKiloDefinition(kiloTool: unknown): ToolParameter[] {
    const definition = kiloTool as { parameters?: { properties?: Record<string, { type?: string; description?: string; default?: unknown }>; required?: string[] }; inputSchema?: { properties?: Record<string, { type?: string; description?: string; default?: unknown }>; required?: string[] } };
    const schema = definition?.inputSchema ?? definition?.parameters;
    const properties = schema?.properties ?? {};
    const required = new Set(schema?.required ?? []);
    return Object.entries(properties).map(([name, value]) => ({ name, type: value.type ?? 'string', description: value.description ?? '', required: required.has(name), default: value.default }));
  }
}
