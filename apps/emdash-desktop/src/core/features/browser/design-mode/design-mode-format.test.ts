import { describe, expect, it } from 'vitest';
import { dataUrlToPngFile, formatDesignModePrompt } from './design-mode-format';
import { DESIGN_MODE_PICK_SCRIPT, type DesignModeCapture } from './design-mode-script';

const capture: DesignModeCapture = {
  url: 'http://localhost:3000/',
  selector: 'main > button.cta',
  outerHTML: '<button class="cta">Go</button>',
  css: { color: 'rgb(0, 0, 0)', display: 'block', 'z-index': 'auto', 'box-shadow': 'none' },
  rect: { x: 1, y: 2, width: 100.4, height: 40 },
};

describe('formatDesignModePrompt', () => {
  it('includes url, selector, html, css and drops default values', () => {
    const text = formatDesignModePrompt(capture, 'C:/tmp/shot.png');
    expect(text).toContain('http://localhost:3000/');
    expect(text).toContain('Selector: main > button.cta');
    expect(text).toContain('<button class="cta">Go</button>');
    expect(text).toContain('color: rgb(0, 0, 0);');
    expect(text).not.toContain('z-index');
    expect(text).not.toContain('box-shadow');
    expect(text).toContain('Size: 100x40');
    expect(text).toContain('Screenshot: C:/tmp/shot.png');
  });

  it('omits the screenshot line without a path', () => {
    expect(formatDesignModePrompt(capture)).not.toContain('Screenshot:');
  });
});

describe('dataUrlToPngFile', () => {
  it('decodes a png data url', () => {
    const file = dataUrlToPngFile('data:image/png;base64,iVBORw0=', 'a.png');
    expect(file?.type).toBe('image/png');
    expect(file?.size).toBe(5);
  });

  it('rejects other urls', () => {
    expect(dataUrlToPngFile('data:text/plain;base64,AA==', 'a.png')).toBeNull();
  });
});

describe('DESIGN_MODE_PICK_SCRIPT', () => {
  it('is a syntactically valid expression', () => {
    expect(() => new Function(`return ${DESIGN_MODE_PICK_SCRIPT}`)).not.toThrow();
  });
});
