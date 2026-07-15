-- RECEPTION-QA-PR-012: the staff assigned-work API uses the authenticated
-- server session client. RLS already limits reads to active workspace members;
-- expose only SELECT so the API can reach that policy boundary.

grant select on table public.order_fulfillment_work_items to authenticated;
