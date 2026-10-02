CREATE FUNCTION public.respond_friend_request(target_account_id uuid,request_id uuid,decision text,operation_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.social_command('respond',target_account_id,operation_id,jsonb_build_object('request_id',request_id,'decision',decision));
$$;
CREATE FUNCTION public.cancel_friendship(target_account_id uuid,request_id uuid,expected_status text,operation_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.social_command('cancel',target_account_id,operation_id,jsonb_build_object('request_id',request_id,'expected_status',expected_status));
$$;
REVOKE ALL ON FUNCTION public.respond_friend_request(uuid,uuid,text,uuid),public.cancel_friendship(uuid,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(uuid,uuid,text,uuid),public.cancel_friendship(uuid,uuid,text,uuid) TO authenticated;
