import { EventBus, CortexEvent, CortexEventHandler, EventType } from '@cortex/core';
import { createKiloClient } from '@kilocode/sdk';

export interface KiloEventAdapterOptions {
  baseUrl?: string;
  apiKey?: string;
}

export class KiloEventAdapter implements EventBus {
  private cortexHandlers: Map<EventType, Set<CortexEventHandler>> = new Map();
  private options: KiloEventAdapterOptions;
  private client: ReturnType<typeof createKiloClient> | null = null;
  private connected = false;

  constructor(options: KiloEventAdapterOptions = {}) {
    this.options = options;
  }

  connect(): void {
    if (this.connected) return;
    this.connected = true;

    const baseUrl = this.options.baseUrl ?? 'http://127.0.0.1:4096';
    this.client = createKiloClient({ baseUrl });

    const consumeStream = async () => {
      try {
        const result = await this.client!.event.subscribe();
        for await (const event of result.stream) {
          const cortexEvent = this.mapKiloEvent(event);
          if (cortexEvent) {
            this.emitToCortexHandlers(cortexEvent);
          }
        }
      } catch {
        this.connected = false;
      }
    };
    consumeStream().catch(() => {
      this.connected = false;
    });
  }

  disconnect(): void {
    this.connected = false;
    this.client = null;
  }

  on<T>(eventType: EventType, handler: CortexEventHandler<T>): () => void {
    if (!this.cortexHandlers.has(eventType)) {
      this.cortexHandlers.set(eventType, new Set());
    }
    this.cortexHandlers.get(eventType)!.add(handler as CortexEventHandler);

    if (!this.connected) {
      this.connect();
    }

    return () => this.off(eventType, handler);
  }

  off<T>(eventType: EventType, handler: CortexEventHandler<T>): void {
    this.cortexHandlers.get(eventType)?.delete(handler as CortexEventHandler);
  }

  emit<T>(event: CortexEvent<T>): void {
    this.emitToCortexHandlers(event);
  }

  private emitToCortexHandlers(event: CortexEvent): void {
    const handlers = this.cortexHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          const result = handler(event);
          if (result instanceof Promise) {
            result.catch((err) => {
              console.error(`Event handler error for ${event.type}:`, err);
            });
          }
        } catch (err) {
          console.error(`Event handler sync error for ${event.type}:`, err);
        }
      }
    }
  }

  private mapKiloEvent(kiloEvent: unknown): CortexEvent | null {
    const event = kiloEvent as { type?: string; event?: string; data?: unknown };
    const eventType = event.type || event.event;

    if (!eventType) return null;

    const mapping: Record<string, EventType> = {
      'SessionEvent.Prompted': 'task.created',
      'SessionEvent.PromptAdmitted': 'task.assigned',
      'SessionEvent.AgentSwitched': 'agent.started',
      'SessionEvent.ModelSwitched': 'agent.started',
      'SessionEvent.Step.Started': 'task.started',
      'SessionEvent.Step.Ended': 'task.completed',
      'SessionEvent.Step.Failed': 'task.failed',
      'SessionEvent.Tool.Called': 'tool.called',
      'SessionEvent.Tool.Success': 'tool.completed',
      'SessionEvent.Tool.Failed': 'tool.error',
      'SessionEvent.Compaction.Started': 'task.started',
      'SessionEvent.Compaction.Ended': 'task.completed',
      'SessionEvent.Text.Started': 'agent.message',
      'SessionEvent.Text.Delta': 'agent.message',
      'SessionEvent.Text.Ended': 'agent.message',
      'SessionEvent.Reasoning.Started': 'agent.message',
      'SessionEvent.Reasoning.Delta': 'agent.message',
      'SessionEvent.Reasoning.Ended': 'agent.message',
    };

    const mappedType = mapping[eventType];
    if (!mappedType) return null;

    return {
      id: crypto.randomUUID(),
      type: mappedType,
      timestamp: new Date(),
      source: 'kilo',
      data: event.data || kiloEvent,
      metadata: { originalType: eventType },
    };
  }
}
