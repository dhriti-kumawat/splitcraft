import { appendCode, visualCode } from './visual';

describe('visualCode', () => {
  it('turns changes into JS and CSS, last change winning', () => {
    const { js, css } = visualCode([
      { selector: 'h1', kind: 'text', value: 'Old' },
      { selector: 'h1', kind: 'text', value: 'Trips "you" love' },
      { selector: '.promo', kind: 'hide' },
      { selector: '.cta', kind: 'background', value: '#0f6b57' },
      { selector: '.cta', kind: 'color', value: '#ffffff' },
    ]);
    expect(js).toBe(
      '// Visual editor changes\nsplitcraft.waitForElement("h1", (el) => {\n  el.textContent = "Trips \\"you\\" love";\n});\n',
    );
    expect(css).toBe(
      '/* Visual editor changes */\n.promo {\n  display: none !important;\n}\n.cta {\n  background-color: #0f6b57 !important;\n}\n.cta {\n  color: #ffffff !important;\n}\n',
    );
  });

  it('drops changes that could inject code', () => {
    expect(
      visualCode([
        { selector: 'a} body{display:none', kind: 'hide' },
        { selector: 'h1 /* x */', kind: 'hide' },
        { selector: 'p', kind: 'color', value: 'red;background:url(x)' },
        { selector: 'p', kind: 'text' },
      ]),
    ).toEqual({ js: '', css: '' });
    const { js } = visualCode([{ selector: 'h1', kind: 'text', value: '"); alert(1); ("' }]);
    expect(js).toContain('el.textContent = "\\"); alert(1); (\\"";');
  });
});

describe('appendCode', () => {
  it('adds after existing code with a blank line', () => {
    expect(appendCode('a();\n', 'b();\n')).toBe('a();\n\nb();\n');
    expect(appendCode('', 'b();\n')).toBe('b();\n');
    expect(appendCode('a();', '')).toBe('a();');
  });
});
