import { EventBus, CortexEvent, CortexEventHandler, EventType, EntityId } from '@cortex/core';

/**
 * KiloEventAdapter bridges Kilo's event system into Cortex's EventBus.
 *
 * Kilo events are:
 * - Defined via define({ type, durable?, schema })
 * - Published via EventV2.publish()
 * - Subscribed via EventV2.subscribe()
 * - Durable events stored in SQLite
 * - Streamed via SSE to clients
 */
export class KiloEventAdapter implements EventBus {
  private cortexHandlers: Map<EventType, Set<CortexEventHandler>> = new Map();
  private kiloEventBus?: unknown;

  constructor(kiloEventBus?: unknown) {
    this.kiloEventBus = kiloEventBus;
  }

  on<T>(eventType: EventType, handler: CortexEventHandler<T>): () => void {
    if (!this.cortexHandlers.has(eventType)) {
      this.cortexHandlers.set(eventType, new Set());
    }
    this.cortexHandlers.get(eventType)!.add(handler as CortexEventHandler);

    // TODO: Subscribe to corresponding Kilo event
    // Example: if eventType === 'tool.called', subscribe to Tool.Called in Kilo

    return () => this.off(eventType, handler);
  }

  off<T>(eventType: EventType, handler: CortexEventHandler<T>): void {
    this.cortexHandlers.get(eventType)?.delete(handler as CortexEventHandler);
  }

  emit<T>(event: CortexEvent<T>): void {
    // TODO: Publish to Kilo event bus if needed
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

  /**
   * Map Kilo event type to Cortex EventType
   */
  static mapKiloEventType(kiloEventType: string): EventType | null {
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
    };

    return mapping[kiloEventType] || null;
  }
}
