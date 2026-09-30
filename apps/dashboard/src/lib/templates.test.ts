import { syntaxError } from './launch';
import { TEMPLATES } from './templates';

describe('variant templates', () => {
  it('are all valid JavaScript with a name, description and category', () => {
    for (const t of TEMPLATES) {
      expect(syntaxError(t.js), t.id).toBeNull();
      expect(t.name && t.description && t.category, t.id).toBeTruthy();
    }
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });
});
