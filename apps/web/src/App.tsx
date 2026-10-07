import { Home } from './Home';
import { PAGES } from './routes';

/** The site's pages by path; anything else is the home page. */
export function App({ path = '/' }: { path?: string }) {
  const page = PAGES[path.endsWith('/') ? path : `${path}/`];
  return page ? <page.component /> : <Home />;
}
