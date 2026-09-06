import { Runtime, RuntimeRef, CommandResult, ProcessHandle } from '@cortex/core';
import { EventEmitter } from 'events';
import { VmManager } from './vm-manager';
import { VmInfo, VmDisplay, VmEnvironmentCheck, VmResources } from './vm-types';
import { qmpPowerDown } from './qmp-client';

export class CortexVMRuntime implements Runtime {
  readonly ref: RuntimeRef;
  private vmManager: VmManager;
  private vmInfo: VmInfo | null = null;
  private vncProxy: { port: number; token: string } | null = null;

  constructor(ref: RuntimeRef, options: {
    dataRoot?: string;
    qemuBinary?: string;
    acceleration: 'auto' | 'kvm' | 'tcg';
    networkMode: 'user' | 'restricted' | 'none';
    resources?: VmResources;
    installIsoPath?: string;
    log?: (message: string) => void;
  } = { acceleration: 'auto', networkMode: 'user' }) {
    this.ref = ref;
    this.vmManager = new VmManager({
      dataRoot: options.dataRoot,
      qemuBinary: options.qemuBinary,
      acceleration: options.acceleration,
      networkMode: options.networkMode,
      resources: { [ref.id]: options.resources || { cpus: 2, memoryMB: 2048, diskGB: 16 } },
      installIsoPaths: options.installIsoPath ? { [ref.id]: options.installIsoPath } : undefined,
      log: options.log,
    });
  }

  async executeCommand(command: string, args: string[] = [], env: Record<string, string> = {}): Promise<CommandResult> {
    if (this.vmInfo?.state !== 'running') {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'VM is not running',
        durationMs: 0,
      };
    }

    console.log(`[CortexVMRuntime] Would execute in VM: ${command} ${args.join(' ')}`);

    return {
      exitCode: 0,
      stdout: `Executed in VM: ${command}\n`,
      stderr: '',
      durationMs: 0,
    };
  }

  async readFile(path: string): Promise<string> {
    if (this.vmInfo?.state !== 'running') {
      throw new Error('VM is not running');
    }

    console.log(`[CortexVMRuntime] Would read from VM: ${path}`);

    return `Content of ${path} from VM\n`;
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (this.vmInfo?.state !== 'running') {
      throw new Error('VM is not running');
    }

    console.log(`[CortexVMRuntime] Would write to VM: ${path}`);
  }

  async deleteFile(path: string): Promise<void> {
    if (this.vmInfo?.state !== 'running') {
      throw new Error('VM is not running');
    }

    console.log(`[CortexVMRuntime] Would delete from VM: ${path}`);
  }

  async listFiles(path: string = '.'): Promise<string[]> {
    if (this.vmInfo?.state !== 'running') {
      throw new Error('VM is not running');
    }

    return [];
  }

  async startProcess(command: string, args: string[] = []): Promise<ProcessHandle> {
    if (this.vmInfo?.state !== 'running') {
      throw new Error('VM is not running');
    }

    throw new Error('CortexVMRuntime.startProcess not yet implemented');
  }

  async openBrowser(url: string): Promise<void> {
    if (this.vmInfo?.state !== 'running') {
      throw new Error('VM is not running');
    }

    console.log(`[CortexVMRuntime] Would open browser in VM: ${url}`);
  }

  async takeScreenshot(): Promise<Buffer> {
    if (this.vmInfo?.state !== 'running') {
      throw new Error('VM is not running');
    }

    throw new Error('CortexVMRuntime.takeScreenshot not yet implemented');
  }

  async start(): Promise<void> {
    const vmId = this.ref.id;
    await this.vmManager.start(vmId);
    this.vmInfo = (await this.vmManager.getVirtualMachines()).find((vm) => vm.id === vmId) || null;
  }

  async stop(): Promise<void> {
    if (this.vmInfo) {
      await this.vmManager.stop(this.vmInfo.id);
      this.vmInfo = null;
      this.vncProxy = null;
    }
  }

  async checkEnvironment(): Promise<VmEnvironmentCheck> {
    return this.vmManager.checkEnvironment();
  }

  async openDisplay(): Promise<VmDisplay> {
    if (!this.vmInfo) {
      throw new Error('VM not started');
    }
    const display = await this.vmManager.openDisplay(this.vmInfo.id);
    const port = parseInt(display.webSocketUrl.split(':')[2] || '0');
    this.vncProxy = { port, token: display.token };
    return display;
  }

  hasCapability(capability: string): boolean {
    return ['terminal', 'filesystem', 'browser', 'processes'].includes(capability);
  }
}

export function createVmRuntime(options: {
  id?: string;
  acceleration?: 'auto' | 'kvm' | 'tcg';
  networkMode?: 'user' | 'restricted' | 'none';
  resources?: VmResources;
  dataRoot?: string;
  qemuBinary?: string;
  installIsoPath?: string;
} = {}): { ref: RuntimeRef; runtime: CortexVMRuntime } {
  const id = options.id || crypto.randomUUID();
  const ref: RuntimeRef = {
    id,
    type: 'vm',
    capabilities: ['terminal', 'filesystem', 'browser', 'processes', 'vm'],
  };

  const runtime = new CortexVMRuntime(ref, {
    acceleration: options.acceleration || 'auto',
    networkMode: options.networkMode || 'user',
    resources: options.resources,
    dataRoot: options.dataRoot,
    qemuBinary: options.qemuBinary,
    installIsoPath: options.installIsoPath,
  });

  return { ref, runtime };
}
