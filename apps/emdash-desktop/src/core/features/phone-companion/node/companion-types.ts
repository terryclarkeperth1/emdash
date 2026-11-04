export type CompanionStatus = 'idle' | 'working' | 'awaiting-input' | 'error' | 'completed';

export type CompanionSession = {
  id: string;
  title: string;
  task: string;
  project: string;
  provider: string;
  status: CompanionStatus;
  /** Only PTY (TUI) conversations accept follow-up text. */
  canMessage: boolean;
  updatedAt: string | null;
};

export type CompanionAlertKind = 'done' | 'needs-input' | 'error';

export type CompanionAlert = {
  id: number;
  at: number;
  kind: CompanionAlertKind;
  conversationId: string;
  title: string;
  text: string;
};

export type CompanionSendResult = { ok: true } | { ok: false; error: string };

export interface CompanionSource {
  listSessions(): Promise<CompanionSession[]>;
  sendMessage(conversationId: string, text: string): Promise<CompanionSendResult>;
}

export const MAX_MESSAGE_LENGTH = 4000;
