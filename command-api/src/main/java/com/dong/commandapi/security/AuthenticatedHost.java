package com.dong.commandapi.security;

/**
 * Typed security principal (ADR-4). Set by {@link SupabaseJwtFilter} after JWT
 * validation; obtained by controllers/handlers via {@code @AuthenticationPrincipal}.
 * Downstream commands read {@code hostId} without re-parsing the token.
 *
 * @param hostId Supabase user id (JWT {@code sub} claim)
 * @param role   JWT {@code role} claim (always {@code authenticated} here)
 */
public record AuthenticatedHost(String hostId, String role) {
}
