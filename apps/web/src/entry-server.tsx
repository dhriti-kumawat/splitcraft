import { renderToString } from 'react-dom/server';
import { App } from './App';
import { PAGES } from './routes';

/** Used at build time to pre-render each page into dist (scripts/prerender.mjs). */
export function render(path = '/'): string {
  return renderToString(<App path={path} />);
}

/** The pages to pre-render beside the home page, with their head tags. */
export function pages() {
  return PAGES;
}
