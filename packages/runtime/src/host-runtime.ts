import { Runtime, RuntimeRef, CommandResult, ProcessHandle } from '@cortex/core';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, unlink, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { Buffer } from 'buffer';

const execAsync = promisify(exec);

export class HostRuntime implements Runtime {
  readonly ref: RuntimeRef;

  constructor(ref: RuntimeRef) {
    this.ref = ref;
  }

  async executeCommand(command: string, args: string[] = [], env: Record<string, string> = {}): Promise<CommandResult> {
    const start = Date.now();
    try {
      const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
      const { stdout, stderr } = await execAsync(fullCommand, {
        env: { ...process.env, ...env },
        maxBuffer: 10 * 1024 * 1024,
      });
      return {
        exitCode: 0,
        stdout: stdout || '',
        stderr: stderr || '',
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const error = err as { code?: number | null; stdout?: string; stderr?: string };
      return {
        exitCode: error.code ?? 1,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        durationMs: Date.now() - start,
      };
    }
  }

  async readFile(path: string): Promise<string> {
    return readFile(path, 'utf-8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    const dir = dirname(path);
    try {
      await this.executeCommand('mkdir', ['-p', dir]);
    } catch {
      // ignore mkdir errors
    }
    await writeFile(path, content, 'utf-8');
  }

  async deleteFile(path: string): Promise<void> {
    await unlink(path);
  }

  async listFiles(path: string = '.'): Promise<string[]> {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.map((e) => e.name);
  }

  async startProcess(command: string, args: string[] = []): Promise<ProcessHandle> {
    const { spawn } = await import('child_process');
    const child = spawn(command, args, { detached: false });
    
    return {
      pid: child.pid ?? 0,
      kill: async () => {
        if (child.pid) {
          process.kill(-child.pid);
        }
      },
      wait: () => {
        return new Promise<CommandResult>((resolve) => {
          let stdout = '';
          let stderr = '';
          child.stdout?.on('data', (d) => { stdout += d.toString(); });
          child.stderr?.on('data', (d) => { stderr += d.toString(); });
          const start = Date.now();
          child.on('close', (code) => {
            resolve({
              exitCode: code ?? 0,
              stdout,
              stderr,
              durationMs: Date.now() - start,
            });
          });
        });
      },
    };
  }

  async openBrowser(url: string): Promise<void> {
    const platform = process.platform;
    const commands: Record<string, string[]> = {
      darwin: ['open', url],
      win32: ['cmd', '/c', 'start', url],
      linux: ['xdg-open', url],
    };
    const cmd = commands[platform] || ['xdg-open', url];
    await this.executeCommand(cmd[0], cmd.slice(1));
  }

  async takeScreenshot(): Promise<Buffer> {
    throw new Error('Screenshot not supported on host runtime without additional tools');
  }

  hasCapability(capability: string): boolean {
    return this.ref.capabilities.includes(capability as any);
  }
}
