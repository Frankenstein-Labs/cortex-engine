import { CortexEvent, CortexEventHandler, EventBus, EventType } from './types';

export class InMemoryEventBus implements EventBus {
  private handlers: Map<EventType, Set<CortexEventHandler>> = new Map();

  on<T>(eventType: EventType, handler: CortexEventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as CortexEventHandler);
    return () => this.off(eventType, handler);
  }

  off<T>(eventType: EventType, handler: CortexEventHandler<T>): void {
    this.handlers.get(eventType)?.delete(handler as CortexEventHandler);
  }

  emit<T>(event: CortexEvent<T>): void {
    const handlers = this.handlers.get(event.type);
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
}

export function createEvent<T>(
  type: EventType,
  source: string,
  data: T,
  metadata?: Record<string, unknown>
): CortexEvent<T> {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date(),
    source,
    data,
    metadata,
  };
}
