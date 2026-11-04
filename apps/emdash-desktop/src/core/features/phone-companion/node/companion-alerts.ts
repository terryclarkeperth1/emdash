import type { AgentEvent } from '@core/primitives/agents/api';
import { isAttentionNotification } from '@core/primitives/agents/api';
import type { CompanionAlert, CompanionAlertKind } from './companion-types';

export function alertKind(event: AgentEvent): CompanionAlertKind | null {
  if (event.type === 'stop') return 'done';
  if (event.type === 'error') return 'error';
  if (event.type === 'notification' && isAttentionNotification(event.payload.notificationType)) {
    return 'needs-input';
  }
  return null;
}

/** Bounded in-memory feed of the agent events a phone should be told about. */
export class AlertFeed {
  private nextId = 1;
  private items: CompanionAlert[] = [];

  constructor(
    private readonly capacity = 100,
    private readonly now: () => number = Date.now
  ) {}

  push(event: AgentEvent, title: string): CompanionAlert | null {
    const kind = alertKind(event);
    if (!kind) return null;
    const text =
      kind === 'done'
        ? 'Finished'
        : kind === 'error'
          ? (event.payload.message ?? 'Failed')
          : (event.payload.message ?? 'Needs your input');
    const alert: CompanionAlert = {
      id: this.nextId++,
      at: this.now(),
      kind,
      conversationId: event.conversationId,
      title,
      text: text.slice(0, 300),
    };
    this.items.push(alert);
    if (this.items.length > this.capacity) this.items.splice(0, this.items.length - this.capacity);
    return alert;
  }

  since(id: number): CompanionAlert[] {
    return this.items.filter((a) => a.id > id);
  }

  get lastId(): number {
    return this.nextId - 1;
  }
}
