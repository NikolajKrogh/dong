import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../lib/supabase";
import type { Database } from "../../types/database";
import type { HostRoomCreateResponse } from "../../types/hostRoom";

export interface HostRoomRpcClient {
  createRoomAsHost(): Promise<HostRoomCreateResponse>;
}

let cachedHostRoomRpcClient: HostRoomRpcClient | null = null;

const createHostRoomRpcClient = (
  client: SupabaseClient<Database> = getSupabaseClient(),
): HostRoomRpcClient => {
  return {
    async createRoomAsHost() {
      const { data, error } = await client
        .rpc("create_room_as_host")
        .overrideTypes<HostRoomCreateResponse, { merge: false }>();

      if (error) {
        throw error;
      }

      if (!data || typeof data !== "object" || Array.isArray(data) || "Error" in data) {
        throw new Error(
          "Supabase create_room_as_host returned no response payload.",
        );
      }

      return data;
    },
  };
};

export const getHostRoomRpcClient = () => {
  cachedHostRoomRpcClient ??= createHostRoomRpcClient();

  return cachedHostRoomRpcClient;
};
