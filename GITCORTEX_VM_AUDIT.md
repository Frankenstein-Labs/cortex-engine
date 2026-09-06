# GitCortex VM Audit

## Repository
`Frankenstein-Labs/vscode` — cloned to `/tmp/vscode-audit`

## VM Implementation

### Location
`src/vs/workbench/contrib/virtualMachines/` — GitCortex VM contribution

### Platform Services
`src/vs/platform/virtualMachines/`

| File | Purpose |
|------|---------|
| `common/virtualMachines.ts` | Service interfaces, config, enums, resource sanitization |
| `node/virtualMachineManager.ts` | VM lifecycle management (start/stop/restart/remove) |
| `node/qemuLauncher.ts` | QEMU command line construction |
| `node/qemuQmpClient.ts` | QMP client for graceful power-down |
| `node/vncWebSocketProxy.ts` | WebSocket proxy for noVNC |
| `electron-browser/virtualMachines.electron.contribution.ts` | Electron daemon supervision |
| `browser/virtualMachinesView.ts` | UI for VM management |
| `browser/virtualDesktopPanel.ts` | Virtual desktop opener |

### Key Interfaces

```ts
export interface IVirtualMachinesService {
  readonly onDidChangeVirtualMachines: Event<readonly IVirtualMachineInfo[]>;
  getVirtualMachines(): Promise<readonly IVirtualMachineInfo[]>;
  checkEnvironment(): Promise<IVirtualMachineEnvironmentCheck>;
  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  restart(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  openDisplay(id: string): Promise<IVirtualMachineDisplay>;
}
```

### VM Types
```ts
export const enum WellKnownVirtualMachine {
  UbuntuDeveloper = 'ubuntu-developer',
  UbuntuSandbox = 'ubuntu-sandbox'
}

export const enum VirtualMachineState {
  Stopped = 'stopped',
  Starting = 'starting',
  Running = 'running',
  Stopping = 'stopping',
  Error = 'error'
}
```

### QEMU Configuration
- **Acceleration modes**: `auto`, `kvm`, `tcg`
- **Network modes**: `user`, `restricted`, `none`
- **Default resources**: Ubuntu Developer (2 CPUs, 4096 MB, 32 GB disk), Ubuntu Sandbox (2 CPUs, 2048 MB, 16 GB disk)
- **VNC**: Unix socket only (never TCP), protected by file permissions
- **QMP**: Unix socket for control (power down)
- **Display**: `none` (headless), VGA `virtio`
- **Machine**: `q35`

### QEMU Command Line
```ts
export function buildQemuArgs(spec: IQemuLaunchSpec): string[] {
  const args: string[] = [
    '-name', `gitcortex-${spec.vmId}`,
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
  // network mode, ISO boot...
}
```

### Resource Sanitization
```ts
export function sanitizeResources(resources: IVirtualMachineResources): IVirtualMachineResources {
  const clamp = (value: number, min: number, max: number, fallback: number): number =>
    typeof value === 'number' && isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
  return {
    cpus: clamp(resources.cpus, 1, 16, 2),
    memoryMB: clamp(resources.memoryMB, 512, 32768, 2048),
    diskGB: clamp(resources.diskGB, 4, 512, 16),
  };
}
```

### noVNC Integration
- Bundled in `browser/media/novnc/`
- QEMU-specific RFB encodings: `pseudoEncodingQEMUExtendedKeyEvent`, `pseudoEncodingQEMULedEvent`
- WebSocket proxy bridges VNC Unix socket to webview

### Electron Daemon
- `virtualMachinesDaemonMain.ts` — Dedicated daemon process
- Supervises VM lifecycle outside main renderer process

## Decision: KEEP / REFACTOR / MERGE / REPLACE / REMOVE

| Component | Decision | Rationale |
|-----------|----------|-----------|
| QEMU command builder | **ADAPT** | Port to TypeScript/Node for Cortex runtime |
| VM state machine | **ADAPT** | Map to Cortex `RuntimeRef` + `RuntimeState` |
| QMP client | **ADAPT** | Minimal Node.js TCP client for power-down |
| VNC WebSocket proxy | **ADAPT** | Port to Node.js `ws` library |
| Resource sanitization | **KEEP** | Already portable TypeScript |
| noVNC core | **KEEP** | Already JavaScript, can be reused |

## Next Steps
1. Port `buildQemuArgs` and `resolveAcceleration` to `packages/vm-runtime`
2. Implement `CortexVMRuntime` wrapping QEMU process spawning
3. Implement VNC WebSocket proxy for browser access
4. Implement QMP client for graceful shutdown
5. Integrate with `@cortex/runtime` interfaces
