/**
 * Turn what people paste ("https://www.MyTrips.dev/trips?x=1") into the domain Splitcraft
 * stores ("www.mytrips.dev"). Keeps a port, since dev servers need one.
 */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/\.$/, '');
}

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const HOST = new RegExp(`^(?:${LABEL}\\.)+[a-z]{2,63}$`);
const PORT = /^\d{1,5}$/;

/** A site's main domain: a real hostname (or localhost), optional port, no wildcard. */
export function isValidMainDomain(domain: string): boolean {
  const [host = '', port, extra] = domain.split(':');
  if (extra !== undefined || (port !== undefined && !PORT.test(port))) return false;
  return host === 'localhost' || HOST.test(host);
}

/** An extra allowed domain: like a main domain, or `*.example.com` for any subdomain. */
export function isValidAllowedDomain(domain: string): boolean {
  return domain.startsWith('*.') ? HOST.test(domain.slice(2)) : isValidMainDomain(domain);
}
