-- The product funnel (proposal §K, §48): each business's first time at each
-- step of the critical path, derived from the append-only audit log. A view,
-- so it's always current and needs no writes from the app. Read it with
-- `npm run funnel` (src/db/funnel/funnel.ts).
CREATE VIEW "business_funnel" AS
SELECT
  o.id AS organization_id,
  o.name AS business_name,
  o.created_at AS organization_created_at,
  min(e.created_at) FILTER (WHERE e.action = 'customer.created') AS first_customer_at,
  min(e.created_at) FILTER (WHERE e.action = 'quote.created') AS first_quote_at,
  min(e.created_at) FILTER (WHERE e.action = 'quote.sent') AS first_quote_sent_at,
  min(e.created_at) FILTER (WHERE e.action = 'quote.approved') AS first_approval_at,
  min(e.created_at) FILTER (WHERE e.action IN ('invoice.created', 'quote.converted')) AS first_invoice_at,
  min(e.created_at) FILTER (WHERE e.action = 'invoice.sent') AS first_invoice_sent_at,
  min(e.created_at) FILTER (WHERE e.action = 'payment.recorded') AS first_payment_at,
  max(e.created_at) FILTER (WHERE e.actor_type = 'user') AS last_active_at
FROM "organizations" o
LEFT JOIN "audit_events" e ON e.organization_id = o.id
GROUP BY o.id, o.name, o.created_at;
