package com.dong.commandapi.supabase;

/**
 * Outbound Supabase port (Adapter pattern, ADR-5). Health depends on this
 * abstraction, not raw HTTP, so it is trivially mockable. #133's ESPN proxy
 * reuses the same shape.
 */
public interface SupabaseClient {

    /** @return true if Supabase auth is reachable and healthy. */
    boolean isReachable();
}
