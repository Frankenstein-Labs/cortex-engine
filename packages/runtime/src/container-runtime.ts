import { Runtime, RuntimeRef, CommandResult, ProcessHandle } from '@cortex/core';
import { spawn } from 'child_process';

export interface ContainerRuntimeOptions {
  image: string;
  workingDir?: string;
  env?: Record<string, string>;
  volumes?: string[];
  network?: string;
}

export class ContainerRuntime implements Runtime {
  readonly ref: RuntimeRef;
  private options: ContainerRuntimeOptions;
  private containerId?: string;

  constructor(ref: RuntimeRef, options: ContainerRuntimeOptions) {
    this.ref = ref;
    this.options = options;
  }

  async executeCommand(command: string, args: string[] = [], env: Record<string, string> = {}): Promise<CommandResult> {
    const start = Date.now();
    const container = this.containerId || await this.ensureContainer();

    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
    const dockerExecArgs = ['exec', container, 'sh', '-c', fullCommand];

    try {
      const result = await this.runDocker(dockerExecArgs, { ...this.options.env, ...env });
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
    const container = this.containerId || await this.ensureContainer();
    const result = await this.runDocker(['exec', container, 'cat', path]);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }
    return result.stdout;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const container = this.containerId || await this.ensureContainer();
    const escaped = content.replace(/'/g, "'\\''");
    await this.runDocker(['exec', container, 'sh', '-c', `cat > ${path} << 'ENDOFFILE'\n${escaped}\nENDOFFILE`]);
  }

  async deleteFile(path: string): Promise<void> {
    const container = this.containerId || await this.ensureContainer();
    await this.runDocker(['exec', container, 'rm', '-f', path]);
  }

  async listFiles(path: string = '.'): Promise<string[]> {
    const container = this.containerId || await this.ensureContainer();
    const result = await this.runDocker(['exec', container, 'ls', '-1', path]);
    if (result.exitCode !== 0) {
      return [];
    }
    return result.stdout.split('\n').filter((line) => line.trim().length > 0);
  }

  async startProcess(command: string, args: string[] = []): Promise<ProcessHandle> {
    const container = this.containerId || await this.ensureContainer();
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
    const result = await this.runDocker(['exec', '-d', container, 'sh', '-c', fullCommand]);

    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }

    return {
      pid: 0,
      kill: async () => {
        await this.runDocker(['exec', container, 'pkill', '-f', command]);
      },
      wait: async () => {
        return this.runDocker(['exec', container, 'sh', '-c', `wait`]);
      },
    };
  }

  async openBrowser(url: string): Promise<void> {
    const container = this.containerId || await this.ensureContainer();
    await this.runDocker(['exec', container, 'sh', '-c', `xdg-open ${url} || echo 'Browser not supported in container'`]);
  }

  async takeScreenshot(): Promise<Buffer> {
    const container = this.containerId || await this.ensureContainer();
    const result = await this.runDocker(['exec', container, 'sh', '-c', 'scrot -o /tmp/screenshot.png 2>/dev/null || echo "Screenshot not supported"']);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr);
    }
    return Buffer.from(result.stdout);
  }

  async start(): Promise<void> {
    this.containerId = await this.ensureContainer();
  }

  async stop(): Promise<void> {
    if (this.containerId) {
      await this.runDocker(['rm', '-f', this.containerId]);
      this.containerId = undefined;
    }
  }

  hasCapability(capability: string): boolean {
    const capabilities = ['terminal', 'filesystem', 'browser', 'processes'];
    return capabilities.includes(capability);
  }

  private async ensureContainer(): Promise<string> {
    const containerName = `cortex-${this.ref.id}`;

    const volumeArgs = this.options.volumes?.flatMap((v) => ['-v', v]) || [];
    const envArgs = Object.entries(this.options.env || {}).flatMap(([k, v]) => ['-e', `${k}=${v}`]);

    const args = [
      'run',
      '-d',
      '--name', containerName,
      ...volumeArgs,
      ...envArgs,
      this.options.image,
      'sleep',
      'infinity',
    ];

    const result = await this.runDocker(args);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to create container: ${result.stderr}`);
    }

    this.containerId = result.stdout.trim();
    return this.containerId;
  }

  private async runDocker(args: string[], env: Record<string, string> = {}): Promise<CommandResult> {
    const start = Date.now();
    const dockerArgs = ['docker', ...args];

    try {
      const { stdout, stderr } = await this.exec(dockerArgs.join(' '), env);
      return {
        exitCode: 0,
        stdout,
        stderr,
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

  private exec(command: string, env: Record<string, string> = {}): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        shell: true,
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(stderr || `Command failed with code ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }
}
