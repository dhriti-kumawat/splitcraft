import { toProject } from './supabaseData';

describe('toProject', () => {
  it('maps a projects row to the dashboard shape', () => {
    expect(
      toProject({
        id: 'p1',
        workspace_id: 'w1',
        name: 'Trip Demo',
        main_domain: 'mytrips.dev',
        allowed_domains: null as unknown as string[],
        public_key: 'prj_x',
        installed_at: null,
        created_at: '2026-09-29T00:00:00Z',
        settings: { spa: false },
      }),
    ).toEqual({
      id: 'p1',
      workspaceId: 'w1',
      name: 'Trip Demo',
      mainDomain: 'mytrips.dev',
      allowedDomains: [],
      publicKey: 'prj_x',
      installedAt: null,
      createdAt: '2026-09-29T00:00:00Z',
      // Missing switches are on.
      settings: { antiFlicker: true, spa: false, ga4: true },
    });
  });
});

describe('experimentKey', () => {
  it('slugs names into valid keys', async () => {
    const { experimentKey } = await import('./supabaseData');
    expect(experimentKey('Trust badges under Book button')).toBe('trust-badges-under-book-button');
    expect(experimentKey('Urgency banner: “3 spots left”')).toBe('urgency-banner-3-spots-left');
    expect(experimentKey('Café crème')).toBe('cafe-creme');
    expect(experimentKey('***')).toMatch(/^exp-[a-z0-9]+$/);
    expect(experimentKey('x'.repeat(100))).toHaveLength(56);
  });
});
