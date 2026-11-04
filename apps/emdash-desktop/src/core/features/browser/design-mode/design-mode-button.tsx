import { Button, toast, Tooltip } from '@emdash/ui/react/primitives';
import { MousePointerClick } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useRef, useState } from 'react';
import type { BrowserWebviewAdapter } from '@core/features/browser/browser/browser-webview-types';
import { createConversationTerminalAttachments } from '@core/features/conversations/browser/terminal-attachments';
import { activeConversationId } from '@core/features/conversations/browser/pane-selectors';
import { pastePromptInjection } from '@core/features/terminals/api/browser/pty/prompt-injection';
import {
  useConversations,
  useTaskComposition,
} from '@core/features/workbench/api/browser/task-composition-context';
import { cn } from '@core/primitives/styling/browser/cn';
import { dataUrlToPngFile, formatDesignModePrompt } from './design-mode-format';
import {
  DESIGN_MODE_CANCEL_SCRIPT,
  DESIGN_MODE_PICK_SCRIPT,
  type DesignModeCapture,
} from './design-mode-script';

/** Pick an element in the preview; its HTML, computed CSS and screenshot go to the agent prompt. */
export const DesignModeButton = observer(function DesignModeButton({
  adapter,
  disabled,
}: {
  adapter: BrowserWebviewAdapter | null;
  disabled?: boolean;
}) {
  const taskView = useTaskComposition();
  const conversations = useConversations();
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);

  const targetConversationId = () => {
    const layout = taskView.paneLayout;
    for (const pane of [layout.focusedPane, ...layout.groups.map((g) => g.pane)]) {
      const id = activeConversationId(pane);
      if (id) return id;
    }
    // The browser tab is usually the active tab, so fall back to any open conversation.
    return conversations.sessions.keys().next().value as string | undefined;
  };

  const run = async () => {
    if (!adapter) return;
    if (pickingRef.current) {
      await adapter.executeJavaScript(DESIGN_MODE_CANCEL_SCRIPT).catch(() => undefined);
      return;
    }
    const conversationId = targetConversationId();
    const session = conversationId ? conversations.sessions.get(conversationId) : undefined;
    if (!conversationId || !session) {
      toast.error('Open an agent conversation first', {
        description: 'Design Mode sends the element to the active agent prompt.',
      });
      return;
    }
    pickingRef.current = true;
    setPicking(true);
    try {
      const capture = (await adapter.executeJavaScript(DESIGN_MODE_PICK_SCRIPT)) as
        | DesignModeCapture
        | null;
      if (!capture) return;

      let screenshotPath: string | undefined;
      try {
        const { x, y, width, height } = capture.rect;
        const dataUrl = await adapter.capturePageDataUrl({
          x: Math.round(x),
          y: Math.round(y),
          width: Math.max(1, Math.round(width)),
          height: Math.max(1, Math.round(height)),
        });
        const file = dataUrlToPngFile(dataUrl, `design-mode-${Date.now()}.png`);
        if (file) {
          const prepared = await createConversationTerminalAttachments(conversationId).prepareFiles(
            [file],
            new AbortController().signal
          );
          screenshotPath = prepared.paths[0];
        }
      } catch (error) {
        console.error('Design Mode screenshot failed', error);
        toast.error('Could not attach screenshot', { description: 'Sending HTML and CSS only.' });
      }

      await pastePromptInjection({
        providerId: conversations.conversations.get(conversationId)?.data.providerId,
        text: formatDesignModePrompt(capture, screenshotPath),
        forceBracketedPaste: true,
        sendInput: async (data) => {
          await session.connect();
          session.pty?.sendInput(data);
        },
      });
      toast('Element added to agent prompt');
    } catch (error) {
      console.error('Design Mode failed', error);
      toast.error('Design Mode failed', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      pickingRef.current = false;
      setPicking(false);
    }
  };

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Button
            type="button"
            variant="ghost"
            icon
            className={cn('size-7 shrink-0', picking && 'bg-background-2 text-foreground')}
            disabled={disabled || !adapter}
            aria-label="Design Mode"
            aria-pressed={picking}
            onClick={() => void run()}
          >
            <MousePointerClick className="size-4" />
          </Button>
        }
      />
      <Tooltip.Content>
        {picking ? 'Cancel Design Mode' : 'Design Mode: send an element to the agent'}
      </Tooltip.Content>
    </Tooltip.Root>
  );
});
