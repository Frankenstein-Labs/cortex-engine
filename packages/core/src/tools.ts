import { z } from 'zod';
import { Tool, ToolContext, ToolResult, ToolParameter, ToolCall } from './types';
import { validateToolParams } from './permissions';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  async execute(toolName: string, params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { success: false, error: `Tool not found: ${toolName}` };
    }

    for (const perm of tool.requiredPermissions) {
      if (!context.permissions.check(perm, {
        agentId: context.agentId,
        sessionId: context.sessionId,
        taskId: context.taskId,
      })) {
        return { success: false, error: `Permission denied: ${perm}` };
      }
    }

    const validated = validateToolParams(z.object(tool.parameters.reduce((acc, p) => {
      if (p.schema) {
        acc[p.name] = p.schema;
      } else {
        acc[p.name] = p.required ? z.any().refine((v: unknown) => v !== undefined && v !== null && v !== '', `Required parameter ${p.name} missing`) : z.any().optional();
      }
      return acc;
    }, {} as Record<string, z.ZodTypeAny>)), params);

    if (!validated.success) {
      return { success: false, error: validated.error };
    }

    try {
      return await tool.execute(validated.data, context);
    } catch (err) {
      return { success: false, error: `Tool execution error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}
