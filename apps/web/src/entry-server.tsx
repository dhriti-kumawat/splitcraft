import { renderToString } from 'react-dom/server';
import { App } from './App';

/** Used at build time to pre-render the page into dist/index.html (scripts/prerender.mjs). */
export function render(): string {
  return renderToString(<App />);
}
