-- Audit history is append-only (docs/foundation-proposal.md §39, §C).
-- Row-level UPDATE and DELETE are rejected for every role, including the
-- owner the app connects as. (TRUNCATE is statement-level and still works,
-- which the integration tests rely on to reset their own database.)
CREATE OR REPLACE FUNCTION audit_events_reject_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION audit_events_reject_change();
