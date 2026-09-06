import { InMemoryEventBus, createEvent, EventType } from '../src/index';

describe('InMemoryEventBus', () => {
  it('should register and emit events', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];
    
    const unsub = bus.on<{ message: string }>('agent.started', (event) => {
      received.push(event.data.message);
    });
    
    bus.emit(createEvent('agent.started', 'test-agent', { message: 'hello' }));
    await new Promise((r) => setTimeout(r, 10));
    
    expect(received).toEqual(['hello']);
    unsub();
  });

  it('should allow unsubscribing', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];
    
    const unsub = bus.on<{ message: string }>('agent.started', (event) => {
      received.push(event.data.message);
    });
    
    bus.emit(createEvent('agent.started', 'test-agent', { message: 'hello' }));
    unsub();
    bus.emit(createEvent('agent.started', 'test-agent', { message: 'world' }));
    await new Promise((r) => setTimeout(r, 10));
    
    expect(received).toEqual(['hello']);
  });
});
