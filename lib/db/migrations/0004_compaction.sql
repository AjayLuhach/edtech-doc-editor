-- Fold the merged state computed by the caller into the document and drop the covered updates.
-- DEFINER because app_user has no DELETE policy on document_updates (the log is append-only to it).
-- Only advances (compacted_seq strictly increases) so concurrent/stale compactions can't regress or
-- delete updates a newer compaction already folded in.
CREATE OR REPLACE FUNCTION app_compact(p_doc uuid, p_state bytea, p_seq bigint) RETURNS boolean
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE advanced int;
BEGIN
  IF app_can_write(p_doc) IS NOT TRUE THEN RETURN false; END IF;

  UPDATE documents SET compacted_state = p_state, compacted_seq = p_seq
    WHERE id = p_doc AND compacted_seq < p_seq;
  GET DIAGNOSTICS advanced = ROW_COUNT;

  IF advanced > 0 THEN
    DELETE FROM document_updates WHERE document_id = p_doc AND seq <= p_seq;
    RETURN true;
  END IF;
  RETURN false;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_compact(uuid, bytea, bigint) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_compact(uuid, bytea, bigint) TO app_user;
