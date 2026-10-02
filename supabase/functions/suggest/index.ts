// POST /functions/v1/suggest { projectId } — scans the project's main domain and suggests
// experiments to start from. Signed-in members only: the project is read with the caller's
// token, so Row Level Security decides access. With ANTHROPIC_API_KEY set, Claude picks and
// words the suggestions; without it (or if the call fails) simple rules do.
import Anthropic from 'npm:@anthropic-ai/sdk@0.131';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { empty, json } from '../_shared/http.ts';
import {
  MAX_SUGGESTIONS,
  pagesToScan,
  ruleSuggestions,
  scanPage,
  siteOrigin,
  sitemapPages,
  TEMPLATE_IDS,
  validSuggestions,
  type PageScan,
  type Suggestion,
} from '../_shared/suggest.ts';

const MAX_BYTES = 1_000_000;

/** GET a page on the site. Redirects are followed only within public hosts. */
async function fetchText(url: string, hops = 3): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
      headers: { 'user-agent': 'SplitcraftScanner/1.0 (+https://splitcraft.vercel.app)' },
    });
    if (res.status >= 300 && res.status < 400 && hops > 0) {
      const next = new URL(res.headers.get('location') ?? '', url);
      return siteOrigin(next.origin) ? fetchText(next.href, hops - 1) : null;
    }
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, MAX_BYTES);
  } catch {
    return null;
  }
}

async function aiSuggestions(pages: PageScan[]): Promise<Suggestion[] | null> {
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return null;
  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['suggestions'],
            properties: {
              suggestions: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['name', 'hypothesis', 'page', 'template'],
                  properties: {
                    name: { type: 'string' },
                    hypothesis: { type: 'string' },
                    page: { type: 'string', enum: pages.map((p) => p.url) },
                    template: { type: 'string', enum: [...TEMPLATE_IDS] },
                  },
                },
              },
            },
          },
        },
      },
      system:
        'You suggest A/B tests for a website from a scan of its pages. Each test starts from one ' +
        'variant template: headline (new heading copy), button (call-to-action text and colour), ' +
        'promo (offer bar at the top), sticky (call-to-action bar that stays in view), trust ' +
        '(reviews and guarantees near prices or buttons), hide (remove a distracting element). ' +
        `Return up to ${MAX_SUGGESTIONS} tests, most promising first, spread over different pages ` +
        'when that makes sense. name: under 50 characters. hypothesis: one sentence, "Doing X ' +
        'will raise Y because Z", using the real copy found on the page. Use only the page URLs given.',
      messages: [{ role: 'user', content: JSON.stringify(pages) }],
    });
    if (response.stop_reason === 'refusal') return null;
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return null;
    const found = validSuggestions(JSON.parse(text.text).suggestions, pages);
    return found.length ? found : null;
  } catch (error) {
    console.error('suggest: AI call failed, using rules', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return empty(204);
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const { projectId } = (await req.json().catch(() => ({}))) as { projectId?: string };
  if (typeof projectId !== 'string') return json({ error: 'projectId is required' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false },
    global: { headers: { authorization: req.headers.get('authorization') ?? '' } },
  });
  const { data: project } = await db
    .from('projects')
    .select('main_domain')
    .eq('id', projectId)
    .maybeSingle();
  if (!project) return json({ error: 'Project not found.' }, 404);

  const origin = siteOrigin((project as { main_domain: string }).main_domain ?? '');
  if (!origin)
    return json({ error: 'Set a public main domain in project settings to scan your site.' }, 422);

  const home = `${origin}/`;
  const [homeHtml, sitemapXml] = await Promise.all([
    fetchText(home),
    fetchText(`${origin}/sitemap.xml`),
  ]);
  if (!homeHtml) return json({ error: `Couldn't load ${origin}. Is the site public?` }, 502);

  const homeScan = scanPage(homeHtml, home);
  const urls = pagesToScan(
    home,
    sitemapXml ? sitemapPages(sitemapXml, origin) : [],
    homeScan.links,
  );
  const rest = await Promise.all(
    urls.slice(1).map(async (url) => {
      const html = await fetchText(url);
      return html ? scanPage(html, url).page : null;
    }),
  );
  const pages = [homeScan.page, ...rest].filter((p): p is PageScan => p !== null);

  const ai = await aiSuggestions(pages);
  return json({
    source: ai ? 'ai' : 'rules',
    pages,
    suggestions: ai ?? ruleSuggestions(pages),
  });
});
