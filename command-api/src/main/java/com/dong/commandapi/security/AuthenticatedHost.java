package com.dong.commandapi.security;

/**
 * Typed security principal (ADR-4). Set by {@link SupabaseJwtFilter} after JWT
 * validation; obtained by controllers/handlers via {@code @AuthenticationPrincipal}.
 * Downstream commands read {@code hostId} without re-parsing the token.
 *
 * <p>{@code rawToken} is the original Bearer token string, forwarded by
 * {@code StartGameCommandHandler}/{@code PersistentIdempotencyService} as the
 * {@code Authorization} header when calling Supabase REST/RPC endpoints, so those
 * calls execute under the host's own Postgres credentials (RLS applies) instead of
 * a service-role secret (research.md R6).
 *
 * @param hostId   Supabase user id (JWT {@code sub} claim)
 * @param role     JWT {@code role} claim (always {@code authenticated} here)
 * @param rawToken the original, unparsed Bearer token string
 */
public record AuthenticatedHost(String hostId, String role, String rawToken) {
}
