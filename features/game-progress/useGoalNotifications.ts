import { useCallback, useEffect, useRef, useState } from "react";
import { goalNotifications as browser } from "../../platform/notifications/goalNotifications";
import type {
  BrowserPushSubscription, GoalNotificationTarget, InstallationControl, SavedEnrollment,
} from "../../platform/notifications/goalNotificationBrowser";
import { useGameStore } from "../../store/gameStore";
import {
  bindGoalNotifications, invokeGoalNotification, readNotificationIdentity, type GoalGameBinding,
  type NotificationIdentity, type NotificationScope, stopGoalNotificationInstallation,
} from "./goalNotificationClient";

type GoalNotificationStatus = "checking" | "ready" |
  "registered" | "denied" | "pending_stop" | "repair_required" | "registration_unavailable" | "unavailable";

type PreparedEnrollment = { target: GoalNotificationTarget; publicKey: string; owner: string };

async function register(
  saved: SavedEnrollment, identity: NotificationIdentity, target: GoalNotificationTarget,
  subscription: BrowserPushSubscription,
) {
  const response = await invokeGoalNotification<{ installation: InstallationControl }>({
    operation: "register", requestId: saved.requestId, target, proof: identity.proof, subscription,
  }, identity.bearer);
  if (response.installation?.id !== saved.requestId ||
      typeof response.installation.credential !== "string" || !Number.isSafeInteger(response.installation.generation)) {
    throw new Error("invalid_registration");
  }
  browser.save({ ...saved, installation: response.installation });
  return response.installation;
}

export function useGoalNotifications(hydrated: boolean) {
  const [availability, setAvailability] = useState(browser.availability);
  const [status, setStatus] = useState<GoalNotificationStatus>(() => {
    const available = browser.availability();
    if (available.kind !== "supported") return "unavailable";
    return browser.permission() === "denied" ? "denied" : "checking";
  });
  const [message, setMessage] = useState("");
  const [gameBinding, setBinding] = useState<(GoalGameBinding & { gameKey: string }) | null>(null);
  const [needsBinding, setNeedsBinding] = useState(false);
  const associationRevision = useRef<number | null>(null);
  const gameKey = useGameStore(state => {
    if (state.activeGameContext.mode === "multiplayer") return state.activeGameContext.sessionId;
    const grant = state.soloTracking?.grant;
    return grant?.state === "active" ? grant.grantToken : null;
  });
  const binding = gameBinding?.gameKey === gameKey ? gameBinding : null;
  const isEnabledForCurrentGame = binding?.liveEnabled === true && !needsBinding;
  const soloSelection = useGameStore(state => state.soloTracking?.grant?.state === "active"
    ? state.soloTracking.grant.selectionVersion : null);
  const commonPreference = useGameStore(state => state.commonMatchNotificationsEnabled);
  const commonMatch = useGameStore(state => state.commonMatchId);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const setupRequested = useRef(false);
  const prepared = useRef<PreparedEnrollment | null>(null);

  const runIfIdle = useCallback(async (
    operation: () => Promise<void>, { clearMessage = true }: { clearMessage?: boolean } = {},
  ) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    if (clearMessage) setMessage("");
    try { await operation(); } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  const prepareEnrollment = useCallback(async (target: GoalNotificationTarget) => {
    prepared.current = null;
    if (browser.permission() === "denied") {
      setStatus("denied");
      return;
    }
    if (!setupRequested.current) return;
    setStatus("checking");
    try {
      const identity = await readNotificationIdentity();
      if (!identity) {
        setStatus("unavailable");
        setMessage("Open an eligible active game to set up notifications.");
        return;
      }
      const result = await invokeGoalNotification<{ status: string; publicKey?: string }>({ operation: "status", target });
      if (result.status !== "available" || !result.publicKey) {
        setStatus("unavailable");
        return;
      }
      await browser.prepare();
      prepared.current = { target, publicKey: result.publicKey, owner: identity.owner };
      setStatus("ready");
    } catch {
      setStatus("unavailable");
    }
  }, []);

  const refreshGame = useCallback(async (
    installation: InstallationControl, identity: NotificationIdentity,
    { forceRetryStaleBinding = false }: { forceRetryStaleBinding?: boolean } = {},
  ) => {
    try {
      let result = await bindGoalNotifications(installation, identity, associationRevision.current);
      if (result.status === "stale_binding" && (forceRetryStaleBinding || result.sameGame)) {
        result = await bindGoalNotifications(installation, identity, result.revision);
      }
      associationRevision.current = result.revision;
      const gameKey = identity.proof.kind === "solo" ? identity.proof.grantToken : identity.proof.sessionId;
      setBinding(result.status === "bound" ? { ...result, gameKey } : null);
      setNeedsBinding(result.status !== "bound");
    } catch {
      setBinding(null);
      setNeedsBinding(true);
    }
  }, []);

  const reconcile = useCallback(() => {
    void runIfIdle(async () => {
      const available = browser.availability();
      setAvailability(available);
      if (available.kind !== "supported") return;
      const saved = browser.read();
      if (!saved) {
        await prepareEnrollment(available.target);
        return;
      }
      try {
        const identity = await readNotificationIdentity().catch(() => null);
        if (saved.installation && (saved.pendingStop || browser.permission() !== "granted" ||
            (identity !== null && identity.owner !== saved.owner))) {
          setStatus("pending_stop");
          setBinding(null);
          associationRevision.current = null;
          prepared.current = null;
          await stopGoalNotificationInstallation(saved);
          setMessage(saved.pendingStop ? "Notifications turned off." : "");
          await prepareEnrollment(available.target);
          return;
        }
        const subscription = browser.permission() === "granted" ? await browser.subscription() : null;
        if (!saved.installation) {
          if (identity?.owner === saved.owner && subscription) {
            try {
              const installation = await register(saved, identity, available.target, subscription);
              await refreshGame(installation, identity);
              setStatus("registered");
              return;
            } catch { /* The player can retry a registration that did not complete. */ }
          }
          await prepareEnrollment(available.target);
          return;
        }
        if (!subscription) {
          setStatus("repair_required");
          return;
        }
        const result = await invokeGoalNotification<{ status: string }>({
          operation: "status", target: available.target, installation: saved.installation,
        });
        if (result.status === "registered" && identity?.owner === saved.owner) {
          await refreshGame(saved.installation, identity);
        } else {
          setBinding(null);
        }
        if (result.status === "registered") setStatus("registered");
        else if (result.status === "repair_required") setStatus("repair_required");
        else setStatus("registration_unavailable");
      } catch {
        const current = browser.read();
        if (current?.pendingStop) setStatus("pending_stop");
        else if (current?.installation) setStatus("registration_unavailable");
        else setStatus("unavailable");
      }
    }, { clearMessage: false });
  }, [prepareEnrollment, refreshGame, runIfIdle]);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = setTimeout(reconcile, 0);
    const remove = browser.onResume(reconcile);
    return () => { clearTimeout(timeout); remove(); };
  }, [hydrated, reconcile, gameKey, soloSelection, commonPreference, commonMatch]);

  function openSettings() {
    setupRequested.current = true;
    reconcile();
  }

  function enable() {
    void runIfIdle(async () => {
      const access = prepared.current;
      if (!access) return;
      try {
        // Calling subscribe first keeps the browser permission step in the tap's activation.
        const subscription = await browser.subscribe(access.publicKey);
        const identity = await readNotificationIdentity();
        if (!identity || identity.owner !== access.owner) throw new Error("changed_game_identity");
        const current = browser.read();
        if (current?.installation || current?.pendingStop) throw new Error("existing_registration");
        const saved = current?.owner === identity.owner ? current : { owner: identity.owner, requestId: crypto.randomUUID() };
        browser.save(saved);
        const installation = await register(saved, identity, access.target, subscription);
        await refreshGame(installation, identity, { forceRetryStaleBinding: true });
        prepared.current = null;
        setStatus("registered");
      } catch {
        if (browser.permission() === "denied") setStatus("denied");
        else setMessage("Could not register this browser. Try again.");
      }
    });
  }

  function bindCurrentGame() {
    void runIfIdle(async () => {
      const saved = browser.read();
      const identity = await readNotificationIdentity().catch(() => null);
      if (saved?.installation && !saved.pendingStop && identity?.owner === saved.owner) {
        await refreshGame(saved.installation, identity, { forceRetryStaleBinding: true });
      }
    });
  }

  function changeScope(scope: NotificationScope) {
    void runIfIdle(async () => {
      if (binding?.scopeRevision == null || binding.scope === scope) return;
      try {
        const saved = browser.read();
        const identity = await readNotificationIdentity();
        if (!saved?.installation || saved.pendingStop || identity?.owner !== saved.owner || identity.proof.kind === "solo") return;
        const result = await invokeGoalNotification<GoalGameBinding | {
          status: "stale_scope"; scope: NotificationScope; scopeRevision: number;
        }>({
          operation: "scope", installation: saved.installation, proof: identity.proof,
          expectedScopeRevision: binding.scopeRevision, scope,
        }, identity.bearer);
        if (result.status === "bound") setBinding({ ...result, gameKey: binding.gameKey });
        else {
          setBinding({ ...binding, scope: result.scope, scopeRevision: result.scopeRevision });
          setMessage("The match choice changed in another tab. Try again.");
        }
      } catch { setMessage("Could not change which matches to follow."); }
    });
  }

  function repair() {
    void runIfIdle(async () => {
      const saved = browser.read();
      const available = browser.availability();
      if (!saved?.installation || saved.pendingStop || available.kind !== "supported" || browser.permission() !== "granted") return;
      try {
        const identity = await readNotificationIdentity();
        if (identity?.owner !== saved.owner) return;
        const { publicKey } = await invokeGoalNotification<{ status: string; publicKey?: string }>({
          operation: "status", target: available.target,
        });
        if (!publicKey) throw new Error("unavailable");
        await browser.prepare();
        await browser.unsubscribe();
        const subscription = await browser.subscribe(publicKey);
        const latestIdentity = await readNotificationIdentity();
        if (!latestIdentity || latestIdentity.owner !== identity.owner ||
          JSON.stringify(latestIdentity.proof) !== JSON.stringify(identity.proof)) throw new Error("changed_game_identity");
        await invokeGoalNotification({
          operation: "repair", target: available.target, installation: saved.installation, proof: identity.proof, subscription,
        }, identity.bearer);
        await refreshGame(saved.installation, identity, { forceRetryStaleBinding: true });
        setStatus("registered");
        setMessage("Browser notifications repaired.");
      } catch { setMessage("Could not repair browser notifications. Try again."); }
    });
  }

  function disable() {
    void runIfIdle(async () => {
      const available = browser.availability();
      const saved = browser.read();
      if (!saved?.installation || available.kind !== "supported") return;
      setStatus("pending_stop");
      setBinding(null);
      setNeedsBinding(false);
      associationRevision.current = null;
      try {
        await stopGoalNotificationInstallation(saved);
        setMessage("Notifications turned off.");
        await prepareEnrollment(available.target);
      } catch { setMessage("Notification stop pending until DONG reconnects."); }
    });
  }

  return {
    availability, status, message, busy, openSettings, enable, disable, repair,
    binding, needsBinding, isEnabledForCurrentGame, bindCurrentGame, changeScope, commonPreference,
  };
}
