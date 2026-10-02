-- New accounts no longer get a workspace automatically. The dashboard sends someone with no
-- workspace to the setup screen, where they name their own (or accept an invite). Existing
-- workspaces are untouched.
drop trigger if exists on_auth_user_created on auth.users;
