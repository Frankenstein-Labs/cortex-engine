import { Runtime, RuntimeRef, CommandResult, ProcessHandle } from '@cortex/core';

export interface SshRuntimeOptions {
  host: string;
  port: number;
  username: string;
  privateKey?: string;
  password?: string;
}

export class SshRuntime implements Runtime {
  readonly ref: RuntimeRef;

  private options: SshRuntimeOptions;
  private connected = false;

  constructor(ref: RuntimeRef, options: SshRuntimeOptions) {
    this.ref = ref;
    this.options = options;
  }

  async executeCommand(command: string, args: string[] = [], env: Record<string, string> = {}): Promise<CommandResult> {
    const start = Date.now();
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

    try {
      const result = await this.exec(fullCommand, env);
      return {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }

  async readFile(path: string): Promise<string> {
    const result = await this.exec(`cat ${path}`);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }
    return result.stdout;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const escaped = content.replace(/'/g, "'\\''");
    await this.exec(`cat > ${path} << 'ENDOFFILE'\n${escaped}\nENDOFFILE`);
  }

  async deleteFile(path: string): Promise<void> {
    await this.exec(`rm -f ${path}`);
  }

  async listFiles(path: string = '.'): Promise<string[]> {
    const result = await this.exec(`ls -1 ${path}`);
    if (result.exitCode !== 0) {
      return [];
    }
    return result.stdout.split('\n').filter((line) => line.trim().length > 0);
  }

  async startProcess(command: string, args: string[] = []): Promise<ProcessHandle> {
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
    const result = await this.exec(`nohup ${fullCommand} > /dev/null 2>&1 & echo $!`);
    const pid = parseInt(result.stdout.trim(), 10);

    return {
      pid: isNaN(pid) ? 0 : pid,
      kill: async () => {
        await this.exec(`kill -9 ${pid}`);
      },
      wait: async (): Promise<CommandResult> => {
        const result = await this.exec(`wait ${pid}`);
        return { ...result, durationMs: 0 };
      },
    };
  }

  async openBrowser(url: string): Promise<void> {
    await this.exec(`xdg-open ${url} || echo 'Browser open not supported'`);
  }

  async takeScreenshot(): Promise<Buffer> {
    const result = await this.exec(`scrot -o /tmp/screenshot.png 2>/dev/null || gnome-screenshot -f /tmp/screenshot.png 2>/dev/null || echo 'Screenshot not supported'`);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }
    return Buffer.from(result.stdout);
  }

  hasCapability(capability: string): boolean {
    const capabilities = ['terminal', 'filesystem', 'browser', 'processes'];
    return capabilities.includes(capability);
  }

  private exec(command: string, env: Record<string, string> = {}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      // @ts-ignore - ssh2 types not available
      const Client = require('ssh2').Client;
      const client = new Client();

      let stdout = '';
      let stderr = '';

      client.on('ready', () => {
        client.exec(command, { pty: true, env }, (err: Error | null, stream: unknown) => {
          if (err) {
            client.end();
            return reject(err);
          }

          const channel = stream as { on(event: string, listener: (...args: any[]) => void): unknown; stderr: { on(event: string, listener: (...args: any[]) => void): unknown } };
          channel.on('close', (code: number | undefined) => {
            client.end();
            resolve({
              exitCode: code ?? 0,
              stdout: stdout.trim(),
              stderr: stderr.trim(),
            });
          });

          channel.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          channel.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
        });
      });

      client.on('error', (err: Error) => {
        reject(err);
      });

      const authMethod = this.options.privateKey
        ? { privateKey: this.options.privateKey }
        : { password: this.options.password };

      client.connect({
        host: this.options.host,
        port: this.options.port,
        username: this.options.username,
        ...authMethod,
      });
    });
  }
}
