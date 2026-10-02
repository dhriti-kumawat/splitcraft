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

/** The marketing site and its docs, which host the SDK too. */
export const SITE_URL = new URL('/', SDK_URL).href;
export const DOCS_URL = new URL('/docs/', SDK_URL).href;

/** The preview bundle and the extension zip, next to the SDK file on the site. */
export const PREVIEW_BUNDLE_URL = new URL('splitcraft-preview.iife.js', SDK_URL).href;
export const EXTENSION_ZIP_URL = new URL('/extension/splitcraft-preview.zip', SDK_URL).href;

/**
 * The preview bookmarklet (decisions #25, #29): loads the preview bundle on the current
 * page. It takes live edits from the dashboard tab that opened the page, or else the saved
 * code named by the preview link. On a page that already has the snippet, the snippet
 * shows the preview, so the bookmark says so instead.
 */
export function bookmarklet(v: { configUrl: string; dashboard: string }): string {
  const code = `(function(){if(window.splitcraftPreview)return;if(window.splitcraft){alert('Splitcraft is already on this page, so it shows the preview itself. Open the page with Preview on site.');return}var s=document.createElement('script');s.src=${JSON.stringify(PREVIEW_BUNDLE_URL)};s.setAttribute('data-mode','bookmark');s.setAttribute('data-dashboard',${JSON.stringify(v.dashboard)});s.setAttribute('data-config',${JSON.stringify(v.configUrl)});document.head.appendChild(s)})()`;
  return `javascript:${encodeURIComponent(code)}`;
}
