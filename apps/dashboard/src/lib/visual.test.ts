import { appendCode, visualCode, type VisualChange } from './visual';

describe('visualCode', () => {
  it('turns every kind of change into code, in order, the last one per slot winning', () => {
    const changes: VisualChange[] = [
      { selector: 'h1', kind: 'text', value: 'Old' },
      { selector: '.cta', kind: 'style', prop: 'color', value: '#fff' },
      { selector: 'h1', kind: 'text', value: 'Trips "you" love' },
      { selector: '.hero p', kind: 'html', value: '<b>New</b> copy' },
      { selector: '.promo', kind: 'hide' },
      { selector: '.cta', kind: 'background', value: '#0f6b57' },
      { selector: 'img.hero', kind: 'attr', name: 'src', value: 'https://cdn.test/a.jpg' },
      { selector: '.reviews', kind: 'move', target: '.cta', position: 'after' },
      {
        selector: '.cta',
        kind: 'insert',
        value: '<small>Free cancellation</small>',
        position: 'after',
      },
      { selector: '.banner', kind: 'remove' },
    ];
    const { js, css } = visualCode(changes);
    expect(js.split('\n').filter((l) => l.startsWith('splitcraft.'))).toEqual([
      'splitcraft.waitForElement(".cta", (el) => {',
      'splitcraft.waitForElement("h1", (el) => {',
      'splitcraft.waitForElement(".hero p", (el) => {',
      'splitcraft.waitForElement(".cta", (el) => {',
      'splitcraft.waitForElement("img.hero", (el) => {',
      'splitcraft.waitForElement(".reviews", (el) => {',
      'splitcraft.waitForElement(".cta", (el) => {',
      'splitcraft.waitForElement(".banner", (el) => {',
    ]);
    expect(js).toContain(`el.style.setProperty("color", "#fff", 'important');`);
    expect(js).toContain('el.textContent = "Trips \\"you\\" love";');
    expect(js).not.toContain('"Old"');
    expect(js).toContain('el.innerHTML = "<b>New</b> copy";');
    expect(js).toContain(`el.style.setProperty("background-color", "#0f6b57", 'important');`);
    expect(js).toContain('el.setAttribute("src", "https://cdn.test/a.jpg");');
    expect(js).toContain(
      'splitcraft.waitForElement(".cta", (target) => target.insertAdjacentElement("afterend", el));',
    );
    expect(js).toContain('el.insertAdjacentHTML("afterend", "<small>Free cancellation</small>");');
    expect(js).toContain('el.remove();');
    expect(css).toBe('/* Visual editor changes */\n.promo {\n  display: none !important;\n}\n');
  });

  it('drops changes that could inject code or are malformed', () => {
    const bad = [
      { selector: 'a} body{display:none', kind: 'hide' },
      { selector: 'h1 /* x */', kind: 'hide' },
      { selector: 'p', kind: 'color', value: 'red;background:url(x)' },
      { selector: 'p', kind: 'style', prop: 'behavior', value: 'url(x)' },
      { selector: 'p', kind: 'style', prop: 'color', value: 'red; }' },
      { selector: 'a', kind: 'attr', name: 'onclick', value: 'alert(1)' },
      { selector: 'a', kind: 'attr', name: 'href', value: ' javascript:alert(1)' },
      { selector: 'img', kind: 'attr', name: 'src', value: 'data:text/html,<script>' },
      { selector: 'p', kind: 'move', target: '.x', position: 'sideways' },
      { selector: 'p', kind: 'insert', value: '<b>x</b>', position: 'nowhere' },
      { selector: 'p', kind: 'text' },
      { selector: 'p', kind: 'run-js', value: 'alert(1)' },
    ] as unknown as VisualChange[];
    expect(visualCode(bad)).toEqual({ js: '', css: '' });
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
