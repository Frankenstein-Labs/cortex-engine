import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import {
  VmInfo,
  VmState,
  VmResources,
  VmDisplay,
  VmEnvironmentCheck,
  VmAcceleration,
  VmNetworkMode,
  sanitizeResources,
  WELL_KNOWN_VMS,
  DEFAULT_VM_RESOURCES,
} from './vm-types';
import { buildQemuArgs, qemuImgCreateArgs, createDisk, findExecutable, checkKvmAvailable, resolveAcceleration, spawnQemu } from './qemu-launcher';
import { qmpPowerDown } from './qmp-client';
import { VncWebSocketProxy } from './vnc-proxy';

export interface VmManagerOptions {
  dataRoot?: string;
  qemuBinary?: string;
  acceleration: VmAcceleration;
  networkMode: VmNetworkMode;
  resources: Record<string, VmResources>;
  installIsoPaths?: Record<string, string | undefined>;
  log?: (message: string) => void;
}

export class VmManager extends EventEmitter {
  private vms = new Map<string, VmRuntime>();
  private options: VmManagerOptions;

  constructor(options: VmManagerOptions) {
    super();
    this.options = {
      dataRoot: options.dataRoot || path.join(os.homedir(), '.cortex', 'vms'),
      qemuBinary: options.qemuBinary || 'qemu-system-x86_64',
      acceleration: options.acceleration,
      networkMode: options.networkMode,
      resources: options.resources || DEFAULT_VM_RESOURCES,
      installIsoPaths: options.installIsoPaths || {},
      log: options.log || (() => {}),
    };
  }

  async checkEnvironment(): Promise<VmEnvironmentCheck> {
    const qemuPath = await findExecutable(this.options.qemuBinary!);
    const kvmAvailable = await checkKvmAvailable();
    const { acceleration, problems } = resolveAcceleration(this.options.acceleration, kvmAvailable);

    return {
      ok: qemuPath !== undefined,
      qemuPath,
      kvmAvailable,
      acceleration,
      problems: qemuPath === undefined ? ['QEMU binary not found'] : problems,
    };
  }

  async getVirtualMachines(): Promise<VmInfo[]> {
    const infos: VmInfo[] = [];
    for (const [id, vm] of this.vms) {
      infos.push(vm.getInfo());
    }
    return infos;
  }

  async start(id: string): Promise<void> {
    if (this.vms.has(id)) {
      const vm = this.vms.get(id)!;
      if (vm.getState() === 'running') {
        return;
      }
      await vm.start();
      return;
    }

    const vm = new VmRuntime(id, this.options, (event) => {
      this.emit('change', this.getVirtualMachinesSync());
    });
    await vm.start();
    this.vms.set(id, vm);
    this.emit('change', this.getVirtualMachinesSync());
  }

  async stop(id: string): Promise<void> {
    const vm = this.vms.get(id);
    if (!vm) {
      return;
    }
    await vm.stop();
    this.emit('change', this.getVirtualMachinesSync());
  }

  async restart(id: string): Promise<void> {
    const vm = this.vms.get(id);
    if (!vm) {
      return;
    }
    await vm.restart();
    this.emit('change', this.getVirtualMachinesSync());
  }

  async remove(id: string): Promise<void> {
    const vm = this.vms.get(id);
    if (!vm) {
      return;
    }
    await vm.stop();
    await vm.removeDisk();
    this.vms.delete(id);
    this.emit('change', this.getVirtualMachinesSync());
  }

  async openDisplay(id: string): Promise<VmDisplay> {
    const vm = this.vms.get(id);
    if (!vm) {
      throw new Error(`VM not found: ${id}`);
    }
    return vm.openDisplay();
  }

  private getVirtualMachinesSync(): VmInfo[] {
    const infos: VmInfo[] = [];
    for (const [, vm] of this.vms) {
      infos.push(vm.getInfo());
    }
    return infos;
  }
}

class VmRuntime {
  private id: string;
  private options: VmManagerOptions;
  private state: VmState = 'stopped';
  private process: { pid?: number; onExit: EventEmitter; kill: (signal?: NodeJS.Signals) => void } | null = null;
  private vncProxy: VncWebSocketProxy | null = null;
  private diskPath: string = '';
  private vncSocketPath: string = '';
  private qmpSocketPath: string = '';
  private info: VmInfo;
  private stderrTail: string = '';
  private changeHandler: (event: VmInfo[]) => void;

  constructor(id: string, options: VmManagerOptions, changeHandler: (event: VmInfo[]) => void) {
    this.id = id;
    this.options = options;
    this.changeHandler = changeHandler;
    this.info = {
      id,
      name: id,
      description: '',
      state: 'stopped',
      resources: options.resources[id] || { cpus: 2, memoryMB: 2048, diskGB: 16 },
    };
  }

  async start(): Promise<void> {
    const env = await this.checkEnvironment();
    if (!env.ok) {
      throw new Error(`QEMU not available: ${env.problems.join(', ')}`);
    }

    this.setState('starting');
    const resources = sanitizeResources(this.info.resources);

    // Setup paths
    const vmDir = path.join(this.options.dataRoot!, this.id);
    this.diskPath = path.join(vmDir, 'disk.qcow2');
    this.vncSocketPath = path.join(vmDir, 'vnc.sock');
    this.qmpSocketPath = path.join(vmDir, 'qmp.sock');

    await fs.mkdir(vmDir, { recursive: true });

    // Create disk if it doesn't exist
    try {
      await fs.access(this.diskPath);
    } catch {
      await createDisk(env.qemuPath!, this.diskPath, resources.diskGB);
    }

    // Build QEMU args
    const args = buildQemuArgs({
      vmId: this.id,
      qemuBinary: env.qemuPath!,
      acceleration: env.acceleration,
      resources,
      diskPath: this.diskPath,
      installIsoPath: this.options.installIsoPaths?.[this.id],
      vncSocketPath: this.vncSocketPath,
      qmpSocketPath: this.qmpSocketPath,
      networkMode: this.options.networkMode,
    });

    // Start QEMU
    const result = spawnQemu(env.qemuPath!, args);
    this.process = result;

    result.onExit.on('exit', (code) => {
      this.process = null;
      this.setState('stopped');
    });

    // Wait for VNC socket to appear
    await this.waitForSocket(this.vncSocketPath, 30000);

    // Start VNC proxy
    this.vncProxy = new VncWebSocketProxy(this.vncSocketPath);
    await this.vncProxy.start(0); // random port

    this.setState('running');
  }

  async stop(): Promise<void> {
    if (this.process) {
      // Try graceful shutdown via QMP
      try {
        await qmpPowerDown(this.qmpSocketPath, 10000);
      } catch {
        // Force kill if QMP fails
        this.process.kill('SIGKILL');
      }
      this.process = null;
    }

    if (this.vncProxy) {
      await this.vncProxy.stop();
      this.vncProxy = null;
    }

    this.setState('stopped');
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async removeDisk(): Promise<void> {
    try {
      await fs.unlink(this.diskPath);
    } catch {
      // ignore
    }
  }

  async openDisplay(): Promise<VmDisplay> {
    if (!this.vncProxy) {
      throw new Error('VM is not running');
    }

    const token = crypto.randomUUID();
    return this.vncProxy.getDisplayInfo(this.id, token);
  }

  getState(): VmState {
    return this.state;
  }

  getInfo(): VmInfo {
    return { ...this.info, state: this.state };
  }

  private setState(state: VmState): void {
    this.state = state;
    this.info.state = state;
    this.changeHandler([this.getInfo()]);
  }

  private async checkEnvironment(): Promise<{ ok: boolean; qemuPath?: string; kvmAvailable: boolean; acceleration: 'kvm' | 'tcg'; problems: string[] }> {
    const qemuPath = await findExecutable(this.options.qemuBinary!);
    const kvmAvailable = await checkKvmAvailable();
    const { acceleration, problems } = resolveAcceleration(this.options.acceleration, kvmAvailable);

    return {
      ok: qemuPath !== undefined,
      qemuPath,
      kvmAvailable,
      acceleration,
      problems: qemuPath === undefined ? ['QEMU binary not found'] : problems,
    };
  }

  private async waitForSocket(socketPath: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        await fs.access(socketPath);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error(`Timeout waiting for socket: ${socketPath}`);
  }
}
