import { EventEmitter } from "events";
import type { DomainEvent, EventType } from "./eventTypes.js";

/**
 * In-process event bus for service-to-service communication.
 *
 * Uses Node's built-in EventEmitter. This is sufficient for a single-instance
 * monolith. When scaling to multiple instances, swap this for Redis pub/sub
 * or a message broker — the interface remains the same.
 */
class EventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50); // Allow many subscribers
  }

  /**
   * Publish a domain event to all subscribers.
   */
  publish<T>(type: EventType, payload: T, meta?: { userId?: number | undefined; requestId?: string | undefined }): void {
    const event: DomainEvent<T> = {
      type,
      payload,
      timestamp: new Date(),
      userId: meta?.userId,
      requestId: meta?.requestId,
    };


    this.emitter.emit(type, event);
  }

  /**
   * Subscribe to a domain event type.
   */
  subscribe<T>(type: EventType, handler: (event: DomainEvent<T>) => void | Promise<void>): void {
    this.emitter.on(type, async (event: DomainEvent<T>) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`[EventBus] Handler error for ${type}:`, error);
      }
    });
  }

  /**
   * Unsubscribe all handlers for an event type.
   */
  removeAllListeners(type?: EventType): void {
    if (type) {
      this.emitter.removeAllListeners(type);
    } else {
      this.emitter.removeAllListeners();
    }
  }
}

/** Singleton event bus instance */
export const eventBus = new EventBus();
