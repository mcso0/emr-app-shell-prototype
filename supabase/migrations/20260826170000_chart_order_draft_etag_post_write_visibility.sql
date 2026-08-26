begin;

-- Draft writers call this helper again after mutating the same encounter in
-- the surrounding RPC statement. STABLE functions retain the caller's
-- statement snapshot and can therefore return the pre-write ETag. VOLATILE
-- gives each call a fresh command snapshot while preserving the function's
-- existing invoker security, search_path, and revoked client privileges.
alter function private.clair_b3_order_draft_etag(text, uuid) volatile;

comment on function private.clair_b3_order_draft_etag(text, uuid) is
  'Draft CAS fingerprint; VOLATILE so writer RPCs return the post-write ETag from the same statement.';

commit;
