import { RuntimeRef } from '@cortex/core';
import { HostRuntime } from './host-runtime';

export function createHostRuntime(): RuntimeRef {
  return {
    id: crypto.randomUUID(),
    type: 'host',
    capabilities: ['terminal', 'filesystem', 'processes'],
  };
}

export { HostRuntime };
