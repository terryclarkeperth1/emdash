import type { DesignModeCapture } from './design-mode-script';

const DEFAULT_CSS_VALUES = new Set(['', 'none', 'normal', 'auto']);

/** Prompt text for a picked element; the screenshot is referenced by file path when present. */
export function formatDesignModePrompt(
  capture: DesignModeCapture,
  screenshotPath?: string
): string {
  const css = Object.entries(capture.css)
    .filter(([, value]) => !DEFAULT_CSS_VALUES.has(value))
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
  const lines = [
    `Design Mode element from ${capture.url}`,
    `Selector: ${capture.selector}`,
    `Size: ${Math.round(capture.rect.width)}x${Math.round(capture.rect.height)}`,
    '',
    'HTML:',
    '```html',
    capture.outerHTML,
    '```',
    '',
    'Computed CSS:',
    '```css',
    css,
    '```',
  ];
  if (screenshotPath) lines.push('', `Screenshot: ${screenshotPath}`);
  return lines.join('\n') + '\n';
}

export function dataUrlToPngFile(dataUrl: string, name: string): File | null {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: 'image/png' });
}
