import { VmResources, VmAcceleration, VmNetworkMode } from './vm-types';
import { spawn } from 'child_process';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface QemuLaunchSpec {
  vmId: string;
  qemuBinary: string;
  acceleration: 'kvm' | 'tcg';
  resources: VmResources;
  diskPath: string;
  installIsoPath?: string;
  vncSocketPath: string;
  qmpSocketPath: string;
  networkMode: 'user' | 'restricted' | 'none';
}

export function buildQemuArgs(spec: QemuLaunchSpec): string[] {
  const args: string[] = [
    '-name', `cortex-${spec.vmId}`,
    '-machine', 'q35',
    '-accel', spec.acceleration === 'kvm' ? 'kvm' : 'tcg,thread=multi',
    '-cpu', spec.acceleration === 'kvm' ? 'host' : 'max',
    '-smp', String(spec.resources.cpus),
    '-m', String(spec.resources.memoryMB),
    '-drive', `file=${spec.diskPath},format=qcow2,if=virtio,discard=unmap`,
    '-display', 'none',
    '-vga', 'virtio',
    '-vnc', `unix:${spec.vncSocketPath}`,
    '-qmp', `unix:${spec.qmpSocketPath},server=on,wait=off`,
    '-monitor', 'none',
    '-serial', 'none',
    '-parallel', 'none',
  ];

  switch (spec.networkMode) {
    case 'user':
      args.push('-nic', 'user,model=virtio-net-pci');
      break;
    case 'restricted':
      args.push('-nic', 'user,model=virtio-net-pci,restrict=on');
      break;
    case 'none':
      args.push('-nic', 'none');
      break;
  }

  if (spec.installIsoPath) {
    args.push('-cdrom', spec.installIsoPath, '-boot', 'once=d');
  }

  return args;
}

export function qemuImgCreateArgs(diskPath: string, sizeGB: number): string[] {
  return ['create', '-f', 'qcow2', diskPath, `${sizeGB}G`];
}

export function resolveAcceleration(setting: 'auto' | 'kvm' | 'tcg', kvmAvailable: boolean): { acceleration: 'kvm' | 'tcg'; problems: string[] } {
  const problems: string[] = [];
  if (setting === 'tcg') {
    return { acceleration: 'tcg', problems };
  }
  if (kvmAvailable) {
    return { acceleration: 'kvm', problems };
  }
  if (setting === 'auto') {
    problems.push('KVM is not available on this host and acceleration is "auto". Set it to "tcg" to fall back to software emulation, or enable KVM.');
    return { acceleration: 'tcg', problems };
  }
  problems.push('KVM is required but /dev/kvm is missing or not accessible.');
  return { acceleration: 'kvm', problems };
}

export async function createDisk(qemuImgBinary: string, diskPath: string, sizeGB: number): Promise<void> {
  const args = qemuImgCreateArgs(diskPath, sizeGB);
  const diskDir = path.dirname(diskPath);
  await fs.mkdir(diskDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const child = spawn(qemuImgBinary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;

    const finish = (error: Error | null) => {
      if (!settled) {
        settled = true;
        error ? reject(error) : resolve();
      }
    };

    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (error) => finish(error));
    child.on('exit', (code) => {
      if (code === 0) {
        finish(null);
      } else {
        finish(new Error(`qemu-img exited with code ${code}: ${stderr.slice(-512)}`));
      }
    });
  });
}

export async function findExecutable(name: string): Promise<string | undefined> {
  const pathEnv = process.env.PATH ?? '';
  const extensions = process.platform === 'win32' ? ['.exe', ''] : [''];
  for (const dir of pathEnv.split(path.delimiter)) {
    for (const ext of extensions) {
      const candidate = path.join(dir, name + ext);
      try {
        await fs.access(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // keep searching
      }
    }
  }
  return undefined;
}

export async function checkKvmAvailable(): Promise<boolean> {
  try {
    await fs.access('/dev/kvm', fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function spawnQemu(qemuBinary: string, args: string[]): { pid: number | undefined; kill: (signal?: NodeJS.Signals) => void; onExit: NodeJS.EventEmitter } {
  const child = spawn(qemuBinary, args, { stdio: ['ignore', 'ignore', 'pipe'] });

  return {
    pid: child.pid,
    kill: (signal?: NodeJS.Signals) => {
      try {
        child.kill(signal);
      } catch {
        // already gone
      }
    },
    onExit: child,
  };
}
