import { bookmarklet, configUrl, INSTALL_TARGETS, snippet } from './snippet';

const values = {
  sdkUrl: 'https://splitcraft.vercel.app/sdk/v1.js',
  publicKey: 'prj_0123456789abcdef0123456789abcdef',
  configUrl: configUrl('https://abc.supabase.co/', 'prj_0123456789abcdef0123456789abcdef'),
};

describe('configUrl', () => {
  it('points at the config Edge Function', () => {
    expect(values.configUrl).toBe(
      'https://abc.supabase.co/functions/v1/config/prj_0123456789abcdef0123456789abcdef.json',
    );
  });
});

describe('snippet', () => {
  it.each(INSTALL_TARGETS.map((t) => t.id))('%s includes the SDK, project key and config', (t) => {
    const code = snippet(t, values);
    expect(code).toContain(`src="${values.sdkUrl}"`);
    expect(code).toContain(`data-project="${values.publicKey}"`);
    expect(code).toContain(`data-config="${values.configUrl}"`);
  });

  it('uses the Next.js Script component with beforeInteractive', () => {
    const code = snippet('nextjs', values);
    expect(code).toContain("import Script from 'next/script';");
    expect(code).toContain('strategy="beforeInteractive"');
  });

  it('loads async as a plain script tag elsewhere', () => {
    expect(snippet('html', values)).toMatch(/<script\n[\s\S]*async\n><\/script>$/);
  });
});

describe('anti-flicker switch', () => {
  it('adds data-antiflicker="off" only when switched off', () => {
    expect(snippet('html', values)).not.toContain('data-antiflicker');
    expect(snippet('html', { ...values, antiFlicker: false })).toContain('data-antiflicker="off"');
    expect(snippet('nextjs', { ...values, antiFlicker: false })).toContain(
      '  data-antiflicker="off"',
    );
  });
});

describe('preview bookmarklet', () => {
  it('loads the preview bundle with the dashboard and config it may use', () => {
    const link = bookmarklet({ configUrl: values.configUrl, dashboard: 'https://dash.test' });
    expect(link.startsWith('javascript:')).toBe(true);
    const code = decodeURIComponent(link.slice('javascript:'.length));
    expect(code).toContain('s.src="https://splitcraft.vercel.app/sdk/splitcraft-preview.iife.js"');
    expect(code).toContain(`'data-config',${JSON.stringify(values.configUrl)}`);
    expect(code).toContain(`'data-dashboard',"https://dash.test"`);
    expect(code).toContain("'data-mode','bookmark'");
    expect(code).toContain('if(window.splitcraft)');
    expect(() => new Function(code)).not.toThrow();
  });
});
