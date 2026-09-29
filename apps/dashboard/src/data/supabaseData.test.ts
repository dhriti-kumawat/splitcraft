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
    });
  });
});
