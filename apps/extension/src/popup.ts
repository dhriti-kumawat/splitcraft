// Toolbar popup: what this tab previews, a Stop button, and whether JS runs on strict sites.
import type { Session } from './sessions';

const $ = (id: string) => document.getElementById(id)!;

async function main(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const k = `tab:${tab?.id}`;
  const s = (await chrome.storage.session.get(k))[k] as Session | undefined;
  if (s) {
    const v = s.state.variants.find((x) => x.key === s.state.variantKey);
    $('status').textContent =
      `Previewing ${s.state.experimentName}: ${v?.name ?? s.state.variantKey}`;
    const stop = $('stop') as HTMLButtonElement;
    stop.hidden = false;
    stop.onclick = async () => {
      await chrome.storage.session.remove(k);
      await chrome.tabs.reload(tab!.id!);
      window.close();
    };
  }
  $('scripts').hidden = await userScriptsAllowed();
}

async function userScriptsAllowed(): Promise<boolean> {
  try {
    if (typeof chrome.userScripts?.execute !== 'function') return false;
    await chrome.userScripts.getScripts();
    return true;
  } catch {
    return false;
  }
}

void main();
