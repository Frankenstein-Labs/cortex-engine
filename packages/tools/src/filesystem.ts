import { Tool, ToolContext, ToolResult, ToolParameter, PermissionAction, RuntimeCapability } from '@cortex/core';
import { z } from 'zod';

const ReadFileSchema = z.object({
  path: z.string().min(1),
});

const WriteFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

const ListFilesSchema = z.object({
  path: z.string().optional(),
});

const DeleteFileSchema = z.object({
  path: z.string().min(1),
});

export class ReadFileTool implements Tool {
  name = 'filesystem.read';
  description = 'Read the contents of a file';
  version = '1.0.0';
  parameters: ToolParameter[] = [
    { name: 'path', type: 'string', description: 'Absolute or relative file path', required: true, schema: ReadFileSchema.shape.path },
  ];
  requiredPermissions: PermissionAction[] = ['filesystem.read'];
  runtimeRequirements: RuntimeCapability[] = ['filesystem'];

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const parsed = ReadFileSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    try {
      const content = await context.runtime.readFile(parsed.data.path);
      return { success: true, data: { content, path: parsed.data.path } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export class WriteFileTool implements Tool {
  name = 'filesystem.write';
  description = 'Write content to a file';
  version = '1.0.0';
  parameters: ToolParameter[] = [
    { name: 'path', type: 'string', description: 'Absolute or relative file path', required: true },
    { name: 'content', type: 'string', description: 'File content', required: true },
  ];
  requiredPermissions: PermissionAction[] = ['filesystem.write'];
  runtimeRequirements: RuntimeCapability[] = ['filesystem'];

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const parsed = WriteFileSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    try {
      await context.runtime.writeFile(parsed.data.path, parsed.data.content);
      return { success: true, data: { path: parsed.data.path } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export class ListFilesTool implements Tool {
  name = 'filesystem.list';
  description = 'List files in a directory';
  version = '1.0.0';
  parameters: ToolParameter[] = [
    { name: 'path', type: 'string', description: 'Directory path', required: false },
  ];
  requiredPermissions: PermissionAction[] = ['filesystem.read'];
  runtimeRequirements: RuntimeCapability[] = ['filesystem'];

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const parsed = ListFilesSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    try {
      const files = await context.runtime.listFiles(parsed.data.path || '.');
      return { success: true, data: { files, path: parsed.data.path || '.' } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export class DeleteFileTool implements Tool {
  name = 'filesystem.delete';
  description = 'Delete a file';
  version = '1.0.0';
  parameters: ToolParameter[] = [
    { name: 'path', type: 'string', description: 'File path to delete', required: true },
  ];
  requiredPermissions: PermissionAction[] = ['filesystem.delete'];
  runtimeRequirements: RuntimeCapability[] = ['filesystem'];

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const parsed = DeleteFileSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    try {
      await context.runtime.deleteFile(parsed.data.path);
      return { success: true, data: { path: parsed.data.path } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
