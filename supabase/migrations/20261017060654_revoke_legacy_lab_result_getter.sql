-- Retain owner-only compatibility calls; deny direct Data API execution.
do $legacy$
begin
  if to_regprocedure('public.clair_get_lab_result_entry_legacy_base(text,text,uuid,uuid)') is not null then
    revoke all on function public.clair_get_lab_result_entry_legacy_base(text,text,uuid,uuid)
      from public, anon, authenticated, service_role;
  end if;
end
$legacy$;
