// Design Mode picker injected into the browser webview. Idea ported from Orca
// (stablyai/orca, MIT); written fresh for Emdash. Resolves with the clicked
// element's details, or null when cancelled (Esc or a second activation).

export type DesignModeCapture = {
  url: string;
  selector: string;
  outerHTML: string;
  css: Record<string, string>;
  rect: { x: number; y: number; width: number; height: number };
};

export const DESIGN_MODE_MAX_HTML = 6000;

export const DESIGN_MODE_CSS_PROPERTIES = [
  'display',
  'position',
  'width',
  'height',
  'margin',
  'padding',
  'color',
  'background-color',
  'background-image',
  'border',
  'border-radius',
  'box-shadow',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-align',
  'opacity',
  'flex-direction',
  'justify-content',
  'align-items',
  'gap',
  'overflow',
  'z-index',
] as const;

export const DESIGN_MODE_CANCEL_SCRIPT = `(() => { window.__emdashDesignCancel && window.__emdashDesignCancel(); })()`;

export const DESIGN_MODE_PICK_SCRIPT = `new Promise((resolve) => {
  if (window.__emdashDesignCancel) window.__emdashDesignCancel();
  const MAX_HTML = ${DESIGN_MODE_MAX_HTML};
  const PROPS = ${JSON.stringify(DESIGN_MODE_CSS_PROPERTIES)};
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:rgba(59,130,246,0.15);display:none;box-sizing:border-box';
  document.documentElement.appendChild(box);
  const prevCursor = document.documentElement.style.cursor;
  document.documentElement.style.cursor = 'crosshair';
  let current = null;
  const selectorOf = (start) => {
    const parts = [];
    let el = start;
    while (el && el.nodeType === 1 && parts.length < 6) {
      if (el.id) { parts.unshift('#' + CSS.escape(el.id)); break; }
      const cls = Array.from(el.classList).slice(0, 2).map((c) => '.' + CSS.escape(c)).join('');
      parts.unshift(el.tagName.toLowerCase() + cls);
      el = el.parentElement;
    }
    return parts.join(' > ');
  };
  const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };
  const stop = (value) => {
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('mousedown', swallow, true);
    window.removeEventListener('mouseup', swallow, true);
    window.removeEventListener('keydown', onKey, true);
    box.remove();
    document.documentElement.style.cursor = prevCursor;
    window.__emdashDesignCancel = undefined;
    resolve(value);
  };
  const onMove = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === box) return;
    current = el;
    const r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = r.left + 'px';
    box.style.top = r.top + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
  };
  const onClick = (e) => {
    swallow(e);
    const el = document.elementFromPoint(e.clientX, e.clientY) || current;
    if (!el) return stop(null);
    const cs = getComputedStyle(el);
    const css = {};
    for (const p of PROPS) css[p] = cs.getPropertyValue(p);
    const r = el.getBoundingClientRect();
    box.remove();
    let html = el.outerHTML;
    if (html.length > MAX_HTML) html = html.slice(0, MAX_HTML) + '... [truncated]';
    stop({
      url: location.href,
      selector: selectorOf(el),
      outerHTML: html,
      css,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    });
  };
  const onKey = (e) => { if (e.key === 'Escape') { swallow(e); stop(null); } };
  window.__emdashDesignCancel = () => stop(null);
  window.addEventListener('mousemove', onMove, true);
  window.addEventListener('click', onClick, true);
  window.addEventListener('mousedown', swallow, true);
  window.addEventListener('mouseup', swallow, true);
  window.addEventListener('keydown', onKey, true);
})`;
