import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataApi, Project, Workspace } from './api';

interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  main_domain: string;
  allowed_domains: string[];
  public_key: string;
  installed_at: string | null;
  created_at: string;
}

const PROJECT_COLUMNS =
  'id, workspace_id, name, main_domain, allowed_domains, public_key, installed_at, created_at';

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    mainDomain: row.main_domain,
    allowedDomains: row.allowed_domains ?? [],
    publicKey: row.public_key,
    installedAt: row.installed_at,
    createdAt: row.created_at,
  };
}

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export function createSupabaseData(supabase: SupabaseClient): DataApi {
  return {
    async listWorkspaces(userId) {
      const rows = check(
        await supabase
          .from('workspace_members')
          .select('role, workspaces (id, name, plan, created_at)')
          .eq('user_id', userId),
      ) as unknown as Array<{
        role: Workspace['role'];
        workspaces: { id: string; name: string; plan: Workspace['plan']; created_at: string };
      }>;
      return rows
        .filter((r) => r.workspaces)
        .sort((a, b) => a.workspaces.created_at.localeCompare(b.workspaces.created_at))
        .map((r) => ({ ...r.workspaces, role: r.role }));
    },

    async listProjects(workspaceId) {
      const rows = check(
        await supabase
          .from('projects')
          .select(PROJECT_COLUMNS)
          .eq('workspace_id', workspaceId)
          .order('created_at'),
      ) as ProjectRow[];
      return rows.map(toProject);
    },

    async getProject(projectId) {
      const row = check(
        await supabase.from('projects').select(PROJECT_COLUMNS).eq('id', projectId).maybeSingle(),
      ) as ProjectRow | null;
      return row && toProject(row);
    },

    async projectOverview(workspaceId) {
      const rows = check(
        await supabase.rpc('project_overview', { p_workspace: workspaceId }),
      ) as Array<{
        project_id: string;
        live_tests: number;
        visitors_30d: number;
        daily_visitors: number[];
      }>;
      return rows.map((r) => ({
        projectId: r.project_id,
        liveTests: r.live_tests,
        visitors30d: r.visitors_30d,
        dailyVisitors: r.daily_visitors ?? [],
      }));
    },

    async eventsThisMonth(workspaceId) {
      return check(
        await supabase.rpc('workspace_events_this_month', { p_workspace: workspaceId }),
      ) as number;
    },

    async createProject(p) {
      const row = check(
        await supabase
          .from('projects')
          .insert({
            workspace_id: p.workspaceId,
            name: p.name,
            main_domain: p.mainDomain,
            allowed_domains: p.allowedDomains,
          })
          .select(PROJECT_COLUMNS)
          .single(),
      ) as ProjectRow;
      return toProject(row);
    },
  };
}
