import { Tool, ToolContext, ToolResult, ToolParameter, PermissionAction, RuntimeCapability } from '@cortex/core';
import { z } from 'zod';

const ExecuteCommandSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});

export class TerminalTool implements Tool {
  name = 'terminal.execute';
  description = 'Execute a shell command in the runtime environment';
  version = '1.0.0';
  parameters: ToolParameter[] = [
    { name: 'command', type: 'string', description: 'Command to execute', required: true },
    { name: 'args', type: 'array', description: 'Command arguments', required: false },
    { name: 'env', type: 'object', description: 'Environment variables', required: false },
  ];
  requiredPermissions: PermissionAction[] = ['terminal.execute'];
  runtimeRequirements: RuntimeCapability[] = ['terminal'];

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const parsed = ExecuteCommandSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    try {
      const result = await context.runtime.executeCommand(
        parsed.data.command,
        parsed.data.args,
        parsed.data.env
      );
      return {
        success: result.exitCode === 0,
        data: {
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          durationMs: result.durationMs,
        },
        error: result.exitCode !== 0 ? `Command failed with exit code ${result.exitCode}` : undefined,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export class GitStatusTool implements Tool {
  name = 'git.status';
  description = 'Get the git status of the workspace';
  version = '1.0.0';
  parameters: ToolParameter[] = [];
  requiredPermissions: PermissionAction[] = [];
  runtimeRequirements: RuntimeCapability[] = ['terminal'];

  async execute(_params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await context.runtime.executeCommand('git', ['status', '--porcelain']);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || result.stdout };
      }
      const lines = result.stdout.split('\n').filter((l) => l.trim());
      return {
        success: true,
        data: {
          raw: result.stdout,
          files: lines.map((line) => {
            const status = line.substring(0, 2);
            const file = line.substring(3);
            return { status, file };
          }),
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export class GitDiffTool implements Tool {
  name = 'git.diff';
  description = 'Get the git diff of the workspace';
  version = '1.0.0';
  parameters: ToolParameter[] = [
    { name: 'path', type: 'string', description: 'Optional file path to diff', required: false },
  ];
  requiredPermissions: PermissionAction[] = [];
  runtimeRequirements: RuntimeCapability[] = ['terminal'];

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    try {
      const path = params.path as string | undefined;
      const args = path ? ['diff', path] : ['diff'];
      const result = await context.runtime.executeCommand('git', args);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || result.stdout };
      }
      return { success: true, data: { diff: result.stdout } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export class GitCommitTool implements Tool {
  name = 'git.commit';
  description = 'Commit changes in the workspace';
  version = '1.0.0';
  parameters: ToolParameter[] = [
    { name: 'message', type: 'string', description: 'Commit message', required: true },
    { name: 'addAll', type: 'boolean', description: 'Stage all changes', required: false },
  ];
  requiredPermissions: PermissionAction[] = [];
  runtimeRequirements: RuntimeCapability[] = ['terminal'];

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    try {
      const message = params.message as string;
      const addAll = params.addAll as boolean | undefined;
      if (addAll) {
        const addResult = await context.runtime.executeCommand('git', ['add', '.']);
        if (addResult.exitCode !== 0) {
          return { success: false, error: addResult.stderr || addResult.stdout };
        }
      }
      const result = await context.runtime.executeCommand('git', ['commit', '-m', message]);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || result.stdout };
      }
      return { success: true, data: { output: result.stdout } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
