CREATE FUNCTION public.block_account(target_account_id uuid,operation_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.social_command('block',target_account_id,operation_id,'{}'::jsonb);
$$;
CREATE FUNCTION public.unblock_account(target_account_id uuid,block_id uuid,operation_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.social_command('unblock',target_account_id,operation_id,jsonb_build_object('block_id',block_id));
$$;
REVOKE ALL ON FUNCTION public.block_account(uuid,uuid),public.unblock_account(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.block_account(uuid,uuid),public.unblock_account(uuid,uuid,uuid) TO authenticated;
