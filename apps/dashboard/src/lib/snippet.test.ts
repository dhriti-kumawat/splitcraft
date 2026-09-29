import { configUrl, INSTALL_TARGETS, snippet } from './snippet';

const values = {
  sdkUrl: 'https://splitcraft.app/sdk/v1.js',
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
