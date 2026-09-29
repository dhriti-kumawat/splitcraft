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
  /** Default on; off adds `data-antiflicker="off"`. */
  antiFlicker?: boolean;
}

/** Where the SDK file is served from. Placeholder until the SDK is hosted (see Install page). */
export const SDK_URL =
  (import.meta.env.VITE_SDK_URL as string | undefined) ?? 'https://splitcraft.vercel.app/sdk/v1.js';
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
    ...(v.antiFlicker === false ? ['data-antiflicker="off"'] : []),
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

/**
 * A bookmarklet that loads the SDK on the current page, for previews on pages that don't
 * have the snippet yet (decision #25). With `?splitcraft_force=` in the URL (Preview on
 * site adds it) it shows the forced variant and the QA panel. Does nothing if the SDK is
 * already there.
 */
export function bookmarklet(v: SnippetValues): string {
  const code = `(function(){if(window.splitcraft){alert('Splitcraft is already on this page.');return}var s=document.createElement('script');s.src=${JSON.stringify(v.sdkUrl)};s.setAttribute('data-project',${JSON.stringify(v.publicKey)});s.setAttribute('data-config',${JSON.stringify(v.configUrl)});s.setAttribute('data-antiflicker','off');document.head.appendChild(s)})()`;
  return `javascript:${encodeURIComponent(code)}`;
}
