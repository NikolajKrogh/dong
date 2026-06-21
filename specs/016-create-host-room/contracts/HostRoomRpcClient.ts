// Contract: HostRoomRpcClient
// Implementation: utils/supabaseClient.ts (add HostRoomRpcClient interface + createHostRoomRpcClient factory)
//
// Mirrors the GuestRoomRpcClient pattern already in utils/supabaseClient.ts.

import type { HostRoomCreateResponse } from '../../../types/hostRoom';

export interface HostRoomRpcClient {
  /**
   * Creates a new room for the authenticated host, or returns the host's
   * existing joinable room if one already exists.
   *
   * Calls: public.create_room_as_host() via supabase.rpc(...)
   *
   * @throws PostgrestError on RPC error (e.g. not_authenticated)
   * @throws Error if the RPC returns no data
   */
  createRoomAsHost(): Promise<HostRoomCreateResponse>;
}
