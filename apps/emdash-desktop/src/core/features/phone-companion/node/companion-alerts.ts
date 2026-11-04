import type { AgentEvent } from '@core/primitives/agents/api';
import { isAttentionNotification } from '@core/primitives/agents/api';
import type {
  CompanionAlert,
  CompanionAlertKind,
  CompanionSession,
} from './companion-types';

const MAX_REPLY_LENGTH = 2000;
const ALERT_REPLY_LENGTH = 140;

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
  /** Latest alert per conversation; Claude's idle notice after a finished turn repeats it. */
  private readonly latest = new Map<string, { kind: CompanionAlertKind; at: number; reply?: string }>();

  constructor(
    private readonly capacity = 100,
    private readonly now: () => number = Date.now
  ) {}

  push(event: AgentEvent, title: string): CompanionAlert | null {
    const kind = alertKind(event);
    if (!kind) return null;
    const idle =
      event.type === 'notification' && event.payload.notificationType === 'idle_prompt';
    if (idle && this.latest.get(event.conversationId)?.kind === 'done') return null;
    const reply = event.payload.lastAssistantMessage?.trim().slice(0, MAX_REPLY_LENGTH) || undefined;
    this.latest.set(event.conversationId, { kind, at: this.now(), ...(reply ? { reply } : {}) });
    const text =
      kind === 'done'
        ? (reply?.slice(0, ALERT_REPLY_LENGTH) ?? 'Finished')
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

  /** Adds the last reply and event time; a finished turn reads as done, not as Claude's idle notice. */
  decorate(session: CompanionSession): CompanionSession {
    const latest = this.latest.get(session.id);
    if (!latest) return session;
    return {
      ...session,
      status:
        session.status === 'awaiting-input' && latest.kind === 'done' ? 'completed' : session.status,
      activityAt: latest.at,
      ...(latest.reply ? { lastReply: latest.reply } : {}),
    };
  }

  since(id: number): CompanionAlert[] {
    return this.items.filter((a) => a.id > id);
  }

  get lastId(): number {
    return this.nextId - 1;
  }
}
