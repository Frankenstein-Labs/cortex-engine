import { Runtime, RuntimeRef, CommandResult, ProcessHandle } from '@cortex/core';

/**
 * VM Runtime Types - Ported from GitCortex Studio
 */

export type VmAcceleration = 'auto' | 'kvm' | 'tcg';
export type VmNetworkMode = 'user' | 'restricted' | 'none';
export type VmState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface VmResources {
  cpus: number;
  memoryMB: number;
  diskGB: number;
}

export interface VmInfo {
  id: string;
  name: string;
  description: string;
  state: VmState;
  resources: VmResources;
  error?: string;
}

export interface VmDisplay {
  vmId: string;
  webSocketUrl: string;
  token: string;
}

export interface VmEnvironmentCheck {
  ok: boolean;
  qemuPath?: string;
  kvmAvailable: boolean;
  acceleration: 'kvm' | 'tcg';
  problems: string[];
}

export const WELL_KNOWN_VMS = {
  UbuntuDeveloper: 'ubuntu-developer',
  UbuntuSandbox: 'ubuntu-sandbox',
} as const;

export const DEFAULT_VM_RESOURCES: Record<string, VmResources> = {
  [WELL_KNOWN_VMS.UbuntuDeveloper]: { cpus: 2, memoryMB: 4096, diskGB: 32 },
  [WELL_KNOWN_VMS.UbuntuSandbox]: { cpus: 2, memoryMB: 2048, diskGB: 16 },
};

export const VM_DEFINITIONS: readonly { id: string; name: string; description: string }[] = [
  {
    id: WELL_KNOWN_VMS.UbuntuDeveloper,
    name: 'Ubuntu Developer',
    description: 'Machine destinée au développement.',
  },
  {
    id: WELL_KNOWN_VMS.UbuntuSandbox,
    name: 'Ubuntu Sandbox',
    description: 'Machine destinée aux expériences, tests et exécutions isolées.',
  },
];

export function sanitizeResources(resources: VmResources): VmResources {
  const clamp = (value: number, min: number, max: number, fallback: number): number =>
    typeof value === 'number' && isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
  return {
    cpus: clamp(resources.cpus, 1, 16, 2),
    memoryMB: clamp(resources.memoryMB, 512, 32768, 2048),
    diskGB: clamp(resources.diskGB, 4, 512, 16),
  };
}
