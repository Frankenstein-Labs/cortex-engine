import { Tool, ToolContext, ToolResult, ToolParameter, PermissionAction, PermissionPolicy, Permission, PermissionChecker, PermissionContext } from './types';
import { z } from 'zod';

export class DefaultPermissionChecker implements PermissionChecker {
  constructor(private policy: PermissionPolicy) {}

  check(action: PermissionAction, context: PermissionContext): boolean {
    const permission = this.policy.permissions.find(
      (p) => p.action === action
    );
    if (!permission) {
      return this.policy.defaultEffect === 'allow';
    }
    if (permission.resource && context.taskId && permission.resource !== '*') {
      if (!permission.resource.includes(context.taskId)) {
        return false;
      }
    }
    return permission.effect === 'allow';
  }

  async request(action: PermissionAction, context: PermissionContext, reason: string): Promise<boolean> {
    console.warn(`[PERMISSION] Request: ${action} for agent ${context.agentId} - ${reason}`);
    return this.check(action, context);
  }
}

export function createPermissionPolicy(name: string, defaultEffect: 'allow' | 'deny' = 'deny'): PermissionPolicy {
  return {
    id: crypto.randomUUID(),
    name,
    permissions: [],
    defaultEffect,
  };
}

export function allowPermission(policy: PermissionPolicy, action: PermissionAction, resource?: string): PermissionPolicy {
  return {
    ...policy,
    permissions: [
      ...policy.permissions,
      {
        id: crypto.randomUUID(),
        action,
        resource,
        effect: 'allow',
      },
    ],
  };
}

export function denyPermission(policy: PermissionPolicy, action: PermissionAction, resource?: string): PermissionPolicy {
  return {
    ...policy,
    permissions: [
      ...policy.permissions,
      {
        id: crypto.randomUUID(),
        action,
        resource,
        effect: 'deny',
      },
    ],
  };
}

export function validateToolParams(schema: z.ZodSchema, params: Record<string, unknown>): { success: true; data: Record<string, unknown> } | { success: false; error: string } {
  try {
    const data = schema.parse(params);
    return { success: true, data };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    return { success: false, error: String(err) };
  }
}
