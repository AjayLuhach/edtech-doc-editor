-- Owner adds/updates a collaborator by email. DEFINER because the target is not yet a co-collaborator,
-- so the owner cannot see them under the users RLS policy. Returns a status string for the API.
CREATE OR REPLACE FUNCTION app_add_member(p_doc uuid, p_email text, p_role public.role) RETURNS text
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me uuid := app_current_user_id();
  target uuid;
BEGIN
  IF me IS NULL OR app_role_on(p_doc) <> 'owner' THEN RETURN 'forbidden'; END IF;
  IF p_role NOT IN ('editor', 'viewer') THEN RETURN 'invalid_role'; END IF;

  SELECT id INTO target FROM users WHERE email = lower(p_email);
  IF target IS NULL THEN RETURN 'user_not_found'; END IF;
  IF target = me THEN RETURN 'self'; END IF;

  INSERT INTO document_members (document_id, user_id, role) VALUES (p_doc, target, p_role)
  ON CONFLICT (document_id, user_id) DO UPDATE SET role = excluded.role;
  RETURN 'ok';
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_add_member(uuid, text, public.role) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_add_member(uuid, text, public.role) TO app_user;
