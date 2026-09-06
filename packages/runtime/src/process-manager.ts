import { spawn } from 'child_process';
import net from 'net';

export interface ManagedProcess {
  pid: number;
  command: string;
  args: string[];
  port?: number;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  waitForPort(timeoutMs?: number): Promise<void>;
}

export class ProcessManager {
  private processes: Map<string, ManagedProcess> = new Map();

  spawn(id: string, command: string, args: string[], options?: { port?: number; timeout?: number }): ManagedProcess {
    if (this.processes.has(id)) {
      throw new Error(`Process ${id} already exists`);
    }

    const child = spawn(command, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const managed: ManagedProcess = {
      pid: child.pid ?? 0,
      command,
      args,
      port: options?.port,
      start: async () => {
        await new Promise<void>((resolve, reject) => {
          if (child.exitCode !== null) {
            return reject(new Error(`Process ${id} exited early with code ${child.exitCode}`));
          }
          child.once('spawn', () => resolve());
          child.once('error', reject);
        });
        if (options?.port) {
          await this.waitForPort(child.pid ?? 0, options.port, options.timeout ?? 10000);
        }
      },
      stop: async () => {
        if (child.pid) {
          try {
            process.kill(-child.pid, 'SIGTERM');
          } catch {
            try {
              process.kill(child.pid, 'SIGTERM');
            } catch {
              // already dead
            }
          }
        }
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        await new Promise<void>((resolve) => {
          const onExit = () => {
            if (timeoutHandle !== undefined) {
              clearTimeout(timeoutHandle);
            }
            resolve();
          };
          child.once('exit', onExit);
          timeoutHandle = setTimeout(onExit, 2000);
        });
      },
      isRunning: () => child.signalCode === null && child.exitCode === null,
      waitForPort: async (timeoutMs?: number) => {
        if (!options?.port) return;
        await this.waitForPort(child.pid ?? 0, options.port, timeoutMs ?? 10000);
      },
    };

    this.processes.set(id, managed);
    return managed;
  }

  kill(id: string): void {
    const managed = this.processes.get(id);
    if (managed) {
      this.processes.delete(id);
      managed.stop().catch(() => {});
    }
  }

  async killAll(): Promise<void> {
    const all = Array.from(this.processes.values());
    this.processes.clear();
    await Promise.all(all.map((p) => p.stop().catch(() => {})));
  }

  get(id: string): ManagedProcess | undefined {
    return this.processes.get(id);
  }

  private waitForPort(pid: number, port: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        if (Date.now() - start > timeoutMs) {
          return reject(new Error(`Timeout waiting for port ${port} on pid ${pid}`));
        }
        const socket = net.createConnection(port, '127.0.0.1');
        socket.once('connect', () => {
          socket.end();
          resolve();
        });
        socket.once('error', () => {
          setTimeout(check, 100);
        });
      };
      check();
    });
  }
}
