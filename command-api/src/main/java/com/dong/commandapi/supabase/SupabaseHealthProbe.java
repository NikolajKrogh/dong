package com.dong.commandapi.supabase;

/**
 * Checks Supabase auth health without exposing the HTTP implementation.
 */
public interface SupabaseHealthProbe {

    /** @return true if Supabase auth is reachable and healthy. */
    boolean isReachable();
}
