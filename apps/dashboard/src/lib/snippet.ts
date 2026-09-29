export type InstallTarget = 'html' | 'nextjs' | 'react' | 'gtm';

export const INSTALL_TARGETS: Array<{ id: InstallTarget; label: string }> = [
  { id: 'html', label: 'HTML' },
  { id: 'nextjs', label: 'Next.js' },
  { id: 'react', label: 'React' },
  { id: 'gtm', label: 'GTM' },
];

export interface SnippetValues {
  sdkUrl: string;
  publicKey: string;
  configUrl: string;
}

/** Where the SDK file is served from. Placeholder until the SDK is hosted (see Install page). */
export const SDK_URL =
  (import.meta.env.VITE_SDK_URL as string | undefined) ?? 'https://splitcraft.app/sdk/v1.js';
export const SDK_URL_IS_PLACEHOLDER = !import.meta.env.VITE_SDK_URL;

export function configUrl(supabaseUrl: string, publicKey: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/config/${publicKey}.json`;
}

/** The install code for each target, as shown in the drawer's tabs. */
export function snippet(target: InstallTarget, v: SnippetValues): string {
  const attrs = [
    `src="${v.sdkUrl}"`,
    `data-project="${v.publicKey}"`,
    `data-config="${v.configUrl}"`,
  ];
  const tag = (indent: string) =>
    `<script\n${attrs.map((a) => `${indent}${a}`).join('\n')}\n${indent}async\n></script>`;

  switch (target) {
    case 'html':
      return `<!-- Paste inside <head>, as high as possible -->\n${tag('  ')}`;
    case 'nextjs':
      return [
        '// app/layout.tsx',
        "import Script from 'next/script';",
        '',
        '<Script',
        ...attrs.map((a) => `  ${a}`),
        '  strategy="beforeInteractive"',
        '/>',
      ].join('\n');
    case 'react':
      return `<!-- index.html (Vite, Create React App), inside <head> -->\n${tag('  ')}`;
    case 'gtm':
      return [
        '<!-- Google Tag Manager: Tags > New > Custom HTML',
        '     Trigger: All Pages (Page View). Loads later than a direct',
        '     install, so the page can flash before variants apply. -->',
        tag('  '),
      ].join('\n');
  }
}
