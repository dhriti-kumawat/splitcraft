// Workspaces someone has named on purpose (created with a name, renamed, or told the
// "Give your workspace a name" card "Later"), remembered in this browser, so the card only
// asks about names that were filled in for them.
const KEY = 'splitcraft_named_workspaces';

function read(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function markNamed(workspaceId: string): void {
  try {
    const ids = read();
    if (!ids.includes(workspaceId))
      localStorage.setItem(KEY, JSON.stringify([...ids, workspaceId]));
  } catch {
    // Storage blocked: the card may ask again next time.
  }
}

export function isNamed(workspaceId: string): boolean {
  return read().includes(workspaceId);
}
