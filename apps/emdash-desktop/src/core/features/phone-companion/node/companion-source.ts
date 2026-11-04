import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '@core/services/app-db/node/db';
import { conversations, projects, tasks } from '@core/services/app-db/node/schema';
import type {
  CompanionSendResult,
  CompanionSession,
  CompanionSource,
  CompanionStatus,
} from './companion-types';

const STATUSES: ReadonlySet<string> = new Set([
  'idle',
  'working',
  'awaiting-input',
  'error',
  'completed',
]);
const SUBMIT_DELAY_MS = 150;

export type CompanionInputPort = {
  /** Writes raw bytes to the conversation's TUI session. */
  sendInput(conversationId: string, data: string): Promise<{ success: boolean }>;
};

const conversationColumns = {
  id: conversations.id,
  title: conversations.title,
  provider: conversations.provider,
  type: conversations.type,
  agentStatus: conversations.agentStatus,
  taskName: tasks.name,
  projectName: projects.name,
  updatedAt: tasks.updatedAt,
};

/** Live state comes from the same `conversations.agent_status` column the app UI reads. */
export function createCompanionSource(db: AppDb, input: CompanionInputPort): CompanionSource {
  const active = and(isNull(tasks.archivedAt), isNull(tasks.deletedAt), isNull(projects.deletedAt));
  const base = () =>
    db
      .select(conversationColumns)
      .from(conversations)
      .innerJoin(tasks, eq(conversations.taskId, tasks.id))
      .innerJoin(projects, eq(conversations.projectId, projects.id));

  return {
    async listSessions(): Promise<CompanionSession[]> {
      const rows = await base().where(active).orderBy(desc(tasks.updatedAt)).limit(60);
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        task: row.taskName,
        project: row.projectName,
        provider: row.provider ?? 'agent',
        status: (STATUSES.has(row.agentStatus ?? '') ? row.agentStatus : 'idle') as CompanionStatus,
        canMessage: row.type !== 'acp',
        updatedAt: row.updatedAt,
      }));
    },

    async sendMessage(conversationId, text): Promise<CompanionSendResult> {
      const [row] = await base()
        .where(and(active, eq(conversations.id, conversationId)))
        .limit(1);
      if (!row) return { ok: false, error: 'Session not found' };
      if (row.type === 'acp') {
        return { ok: false, error: 'Chat sessions cannot take phone messages yet' };
      }
      // Text and Enter go as two writes so a TUI treats the Enter as a keypress, not a paste.
      const typed = await input.sendInput(conversationId, text);
      if (!typed.success) return { ok: false, error: 'Session is not running' };
      await new Promise((resolve) => setTimeout(resolve, SUBMIT_DELAY_MS));
      const submitted = await input.sendInput(conversationId, '\r');
      return submitted.success ? { ok: true } : { ok: false, error: 'Session is not running' };
    },
  };
}

export async function describeConversation(db: AppDb, conversationId: string): Promise<string> {
  const [row] = await db
    .select({ title: conversations.title, task: tasks.name })
    .from(conversations)
    .leftJoin(tasks, eq(conversations.taskId, tasks.id))
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return row ? `${row.task ?? 'Task'} - ${row.title}` : 'Agent';
}
