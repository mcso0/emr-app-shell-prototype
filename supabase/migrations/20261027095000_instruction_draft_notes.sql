-- Preserve common set instructions through the existing chart-scoped draft CAS.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $patch$
declare d text; old text; replacement text;
begin
 d:=pg_get_functiondef('public.clair_save_chart_order_draft_candidate_base(text,text,uuid,jsonb)'::regprocedure);
 old:='''detailInputs'',''detailSchemaVersion'',''priority'',''childInputs''';
 replacement:='''detailInputs'',''detailSchemaVersion'',''priority'',''childInputs'',''instruction''';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_draft_fields_anchor'; end if;
 d:=replace(d,old,replacement);
 old:='      or ((entry.value ? ''detailInputs'') <> (entry.value ? ''detailSchemaVersion''))';
 replacement:='      or (entry.value ? ''instruction'' and (entry.value->>''rowType''<>''set''
        or jsonb_typeof(entry.value->''instruction'')<>''string'' or length(entry.value->>''instruction'')>5000))
      or ((entry.value ? ''detailInputs'') <> (entry.value ? ''detailSchemaVersion''))';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_draft_validation_anchor'; end if;
 d:=replace(d,old,replacement);
 old:='    update public.orders orders
    set
      priority = v_priority,';
 replacement:='    update public.orders orders
    set
      instruction = case when v_row ? ''instruction'' then v_row->>''instruction'' else orders.instruction end,
      priority = v_priority,';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_draft_save_anchor'; end if;
 execute replace(d,old,replacement);

 d:=pg_get_functiondef('private.clair_b3_runtime_row_json(public.orders)'::regprocedure);
 old:='''originChartId'', p_order.origin_chart_id,';
 replacement:='''originChartId'', p_order.origin_chart_id,
      ''instruction'', p_order.instruction,';
 if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'instruction_draft_readback_anchor'; end if;
 execute replace(d,old,replacement);
end $patch$;
commit;
