import { useCallback, useEffect, useRef, useState } from "react";
import { goalNotifications as browser } from "../../platform/notifications/goalNotifications";
import type {
  BrowserPushSubscription, GoalNotificationTarget, InstallationControl, SavedEnrollment,
} from "../../platform/notifications/goalNotificationBrowser";
import { invokeGoalNotification, readNotificationIdentity, type NotificationIdentity } from "./goalNotificationClient";

type Status = "checking" | "ready" |
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
}

async function stop(saved: SavedEnrollment) {
  if (!saved.installation) return;
  browser.save({ ...saved, pendingStop: true });
  const unsubscribe = browser.unsubscribe().catch(() => {});
  await invokeGoalNotification({ operation: "disable", installation: saved.installation });
  await unsubscribe;
  const current = browser.read();
  if (current?.installation?.id === saved.installation.id &&
      current.installation.generation === saved.installation.generation) browser.save(null);
}

export function useGoalNotifications(hydrated: boolean) {
  const [availability, setAvailability] = useState(browser.availability);
  const [status, setStatus] = useState<Status>(() => {
    const available = browser.availability();
    if (available.kind !== "supported") return "unavailable";
    return browser.permission() === "denied" ? "denied" : "checking";
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const setupRequested = useRef(false);
  const prepared = useRef<PreparedEnrollment | null>(null);
  const testRequest = useRef<string | null>(null);

  const run = useCallback(async (operation: () => Promise<void>, interactive = true) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    if (interactive) setMessage("");
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

  const reconcile = useCallback(() => {
    void run(async () => {
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
          prepared.current = null;
          await stop(saved);
          setMessage(saved.pendingStop ? "Notifications turned off." : "");
          await prepareEnrollment(available.target);
          return;
        }
        const subscription = browser.permission() === "granted" ? await browser.subscription() : null;
        if (!saved.installation) {
          if (identity?.owner === saved.owner && subscription) {
            try {
              await register(saved, identity, available.target, subscription);
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
        setStatus(result.status === "registered" ? "registered" :
          result.status === "repair_required" ? "repair_required" : "registration_unavailable");
      } catch {
        const current = browser.read();
        setStatus(current?.pendingStop ? "pending_stop" : current?.installation ? "registration_unavailable" : "unavailable");
      }
    }, false);
  }, [prepareEnrollment, run]);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = setTimeout(reconcile, 0);
    const remove = browser.onResume(reconcile);
    return () => { clearTimeout(timeout); remove(); };
  }, [hydrated, reconcile]);

  function openSettings() {
    setupRequested.current = true;
    reconcile();
  }

  function enable() {
    void run(async () => {
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
        await register(saved, identity, access.target, subscription);
        prepared.current = null;
        setStatus("registered");
      } catch {
        if (browser.permission() === "denied") setStatus("denied");
        else setMessage("Could not register this browser. Try again.");
      }
    });
  }

  function sendTest() {
    void run(async () => {
      try {
        const saved = browser.read();
        const identity = await readNotificationIdentity();
        if (!saved?.installation || saved.pendingStop || identity?.owner !== saved.owner ||
            browser.permission() !== "granted" || !await browser.subscription()) {
          setMessage("The current game or browser subscription is unavailable.");
          return;
        }
        const requestId = testRequest.current ??= crypto.randomUUID();
        const result = await invokeGoalNotification<{ outcome: string }>({
          operation: "test", requestId, installation: saved.installation, proof: identity.proof,
        }, identity.bearer);
        if (result.outcome !== "pending") testRequest.current = null;
        setMessage(result.outcome === "accepted"
          ? "The push service accepted the test. Check your notification tray."
          : result.outcome === "pending" ? "The test is still being sent."
          : result.outcome === "unconfirmed" ? "The test could not be confirmed. Check your notification tray or send another test."
          : "The test could not be sent.");
      } catch (error) {
        if (error instanceof Error && error.message === "rate_limited") {
          testRequest.current = null;
          setMessage("Wait a minute before sending another test.");
        } else setMessage("The test could not be confirmed. Try again.");
      }
    });
  }

  function disable() {
    void run(async () => {
      const available = browser.availability();
      const saved = browser.read();
      if (!saved?.installation || available.kind !== "supported") return;
      setStatus("pending_stop");
      try {
        await stop(saved);
        setMessage("Notifications turned off.");
        await prepareEnrollment(available.target);
      } catch { setMessage("Notification stop pending until DONG reconnects."); }
    });
  }

  return { availability, status, message, busy, openSettings, enable, sendTest, disable };
}
