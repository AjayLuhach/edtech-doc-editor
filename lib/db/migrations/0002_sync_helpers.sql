-- Lazily create a locally-authored document on first push, race-safe. DEFINER avoids the
-- "INSERT ... ON CONFLICT under RLS WITH CHECK" limitation while document_updates stays RLS-gated.
-- Returns the caller's role on the document, or NULL if it exists and they are not a member.
CREATE OR REPLACE FUNCTION app_ensure_document(p_doc uuid, p_title text) RETURNS public.role
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me uuid := app_current_user_id();
  existing_owner uuid;
  my_role public.role;
BEGIN
  IF me IS NULL THEN RETURN NULL; END IF;

  SELECT owner_id INTO existing_owner FROM documents WHERE id = p_doc;
  IF existing_owner IS NULL THEN
    BEGIN
      INSERT INTO documents (id, owner_id, title) VALUES (p_doc, me, coalesce(p_title, 'Untitled'));
      INSERT INTO document_members (document_id, user_id, role) VALUES (p_doc, me, 'owner');
      RETURN 'owner';
    EXCEPTION WHEN unique_violation THEN
      -- Created by a concurrent request; fall through and read our role.
      NULL;
    END;
  END IF;

  SELECT role INTO my_role FROM document_members WHERE document_id = p_doc AND user_id = me;
  IF my_role IS NOT NULL AND p_title IS NOT NULL THEN
    UPDATE documents SET title = p_title, updated_at = now() WHERE id = p_doc;
  END IF;
  RETURN my_role;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_ensure_document(uuid, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_ensure_document(uuid, text) TO app_user;
