-- Roles, grants, RLS helper functions, and per-table policies (tenant isolation centerpiece).

-- App runtime role: non-superuser so RLS is enforced. Password matches DATABASE_URL.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_password' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_user;--> statement-breakpoint
GRANT USAGE ON TYPE public.role TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;--> statement-breakpoint

-- Current request user from the app.user_id GUC; NULL when unset so policies fail closed.
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
  LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
-- Caller's role on a document (NULL if not a member). DEFINER bypasses RLS to avoid policy recursion.
CREATE OR REPLACE FUNCTION app_role_on(doc uuid) RETURNS public.role
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT m.role FROM document_members m WHERE m.document_id = doc AND m.user_id = app_current_user_id() $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_can_read(doc uuid) RETURNS boolean
  LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT app_role_on(doc) IS NOT NULL $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_can_write(doc uuid) RETURNS boolean
  LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT app_role_on(doc) IN ('owner', 'editor') $$;
--> statement-breakpoint
-- Document owner id, bypassing RLS so the membership-bootstrap policy can reference it.
CREATE OR REPLACE FUNCTION app_doc_owner(doc uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT owner_id FROM documents WHERE id = doc $$;
--> statement-breakpoint
-- Whether the caller shares any document with another user (collaborator name lookup).
CREATE OR REPLACE FUNCTION app_shares_doc(other uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT EXISTS (
  SELECT 1 FROM document_members a JOIN document_members b USING (document_id)
  WHERE a.user_id = app_current_user_id() AND b.user_id = other
) $$;
--> statement-breakpoint
-- Pre-session credential lookup (login runs before app.user_id exists). DEFINER, narrow projection.
CREATE OR REPLACE FUNCTION app_login_lookup(p_email text)
  RETURNS TABLE (id uuid, name text, password_hash text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT u.id, u.name, u.password_hash FROM users u WHERE u.email = lower(p_email) $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_login_lookup(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_login_lookup(text) TO app_user;--> statement-breakpoint
-- Pre-session registration (the new user's id is unknown before insert, so RLS RETURNING can't see it).
CREATE OR REPLACE FUNCTION app_register(p_email text, p_name text, p_hash text) RETURNS uuid
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO users (email, name, password_hash) VALUES (lower(p_email), p_name, p_hash) RETURNING id INTO new_id;
  RETURN new_id;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_register(text, text, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_register(text, text, text) TO app_user;--> statement-breakpoint

-- Enable + force RLS on every tenant table.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE users FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE documents FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE document_members ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE document_members FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE document_updates ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE document_updates FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE document_snapshots ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE document_snapshots FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- users: read self or co-collaborators; update self only. Registration goes through app_register only.
CREATE POLICY users_select ON users FOR SELECT
  USING (id = app_current_user_id() OR app_shares_doc(id));--> statement-breakpoint
CREATE POLICY users_update ON users FOR UPDATE
  USING (id = app_current_user_id()) WITH CHECK (id = app_current_user_id());--> statement-breakpoint

-- documents: members read; creator inserts own; editors/owners update; only owner deletes.
CREATE POLICY documents_select ON documents FOR SELECT USING (app_can_read(id));--> statement-breakpoint
CREATE POLICY documents_insert ON documents FOR INSERT WITH CHECK (owner_id = app_current_user_id());--> statement-breakpoint
CREATE POLICY documents_update ON documents FOR UPDATE
  USING (app_can_write(id)) WITH CHECK (app_can_write(id));--> statement-breakpoint
CREATE POLICY documents_delete ON documents FOR DELETE USING (app_role_on(id) = 'owner');--> statement-breakpoint

-- document_members: members read; owner manages; creator may bootstrap own owner row.
CREATE POLICY members_select ON document_members FOR SELECT USING (app_can_read(document_id));--> statement-breakpoint
CREATE POLICY members_insert ON document_members FOR INSERT WITH CHECK (
  app_role_on(document_id) = 'owner'
  OR (app_doc_owner(document_id) = app_current_user_id() AND user_id = app_current_user_id() AND role = 'owner')
);--> statement-breakpoint
CREATE POLICY members_update ON document_members FOR UPDATE
  USING (app_role_on(document_id) = 'owner') WITH CHECK (app_role_on(document_id) = 'owner');--> statement-breakpoint
CREATE POLICY members_delete ON document_members FOR DELETE USING (app_role_on(document_id) = 'owner');--> statement-breakpoint

-- document_updates: any member pulls; only editor/owner pushes (Viewer blocked at the DB); append-only.
CREATE POLICY updates_select ON document_updates FOR SELECT USING (app_can_read(document_id));--> statement-breakpoint
CREATE POLICY updates_insert ON document_updates FOR INSERT WITH CHECK (
  app_can_write(document_id) AND (author_id = app_current_user_id() OR author_id IS NULL)
);--> statement-breakpoint

-- document_snapshots: members read the timeline; editor/owner create; history is immutable.
CREATE POLICY snapshots_select ON document_snapshots FOR SELECT USING (app_can_read(document_id));--> statement-breakpoint
CREATE POLICY snapshots_insert ON document_snapshots FOR INSERT WITH CHECK (
  app_can_write(document_id) AND (author_id = app_current_user_id() OR author_id IS NULL)
);
