/* eslint-disable import/no-unresolved */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = user.id;

  try {
    // Collect owned session IDs first so child rows can be deleted before the sessions.
    const { data: ownedSessions } = await supabaseAdmin
      .from("game_sessions")
      .select("id")
      .eq("owner_account_id", userId);

    const ownedSessionIds = (ownedSessions ?? []).map(
      (s: { id: string }) => s.id,
    );

    if (ownedSessionIds.length > 0) {
      const { error: snapshotPurgeError } = await supabaseAdmin.rpc(
        "purge_assignment_snapshots_for_sessions",
        { session_ids: ownedSessionIds },
      );
      if (snapshotPurgeError) {
        throw snapshotPurgeError;
      }

      // Delete child rows in dependency order before removing the sessions themselves.
      await supabaseAdmin
        .from("assignments")
        .delete()
        .in("session_id", ownedSessionIds);
      await supabaseAdmin
        .from("gameplay_events")
        .delete()
        .in("session_id", ownedSessionIds);
      await supabaseAdmin
        .from("participants")
        .delete()
        .in("session_id", ownedSessionIds);
      await supabaseAdmin
        .from("matches")
        .delete()
        .in("session_id", ownedSessionIds);
      await supabaseAdmin
        .from("game_sessions")
        .delete()
        .eq("owner_account_id", userId);
    }

    // Convert any remaining participant rows (member role in other users' sessions) to
    // anonymous guests so those sessions keep their history.
    // Each row gets its own random token to satisfy the per-session uniqueness index.
    const { data: memberParticipants } = await supabaseAdmin
      .from("participants")
      .select("id")
      .eq("account_id", userId);

    for (const participant of memberParticipants ?? []) {
      await supabaseAdmin
        .from("participants")
        .update({
          account_id: null,
          membership_type: "guest",
          session_role: "member",
          guest_rejoin_token_hash: crypto.randomUUID(),
        })
        .eq("id", participant.id);
    }

    await supabaseAdmin
      .from("friendships")
      .delete()
      .or(
        `requester_account_id.eq.${userId},addressee_account_id.eq.${userId}`,
      );

    // Deleting the accounts row cascades to profiles, settings, and legacy import state.
    await supabaseAdmin.from("accounts").delete().eq("id", userId);

    const { error: deleteUserError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      throw deleteUserError;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Deletion failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
