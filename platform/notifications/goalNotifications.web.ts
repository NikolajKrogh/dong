import type {
  BrowserAvailability, BrowserPushSubscription, GoalNotificationBrowser, GoalNotificationTarget, SavedEnrollment,
} from "./goalNotificationBrowser";

const storageKey = "dong.goal-notifications";
const workerPath = "/goal-push-sw.js";
let registration: ServiceWorkerRegistration | undefined;

function availability(): BrowserAvailability {
  if (typeof window === "undefined") return { kind: "unsupported" };
  const { userAgent } = navigator;
  const iphone = /iPhone|iPod/i.test(userAgent);
  if (iphone && !window.matchMedia("(display-mode: standalone)").matches &&
      !(navigator as Navigator & { standalone?: boolean }).standalone) {
    return { kind: "installation_required" };
  }
  if (!window.isSecureContext || !("Notification" in window) ||
      !("serviceWorker" in navigator) || !("PushManager" in window)) return { kind: "unsupported" };
  let target: GoalNotificationTarget = "other";
  if (iphone) target = "iphone_home_screen";
  else if (/Android/i.test(userAgent)) {
    if (/SamsungBrowser/i.test(userAgent)) target = "android_samsung";
    else if (/Firefox/i.test(userAgent)) target = "android_firefox";
    else if (/Chrome/i.test(userAgent) && !/; wv\)|EdgA|OPR\//i.test(userAgent)) target = "android_chrome";
  }
  return { kind: "supported", target };
}

function serialize(subscription: PushSubscription): BrowserPushSubscription {
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error("invalid_subscription");
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

async function existingWorker() {
  const worker = await navigator.serviceWorker.getRegistration("/");
  return worker?.active?.scriptURL === new URL(workerPath, location.origin).href ? worker : undefined;
}

export const goalNotifications: GoalNotificationBrowser = {
  availability,
  permission: () => typeof Notification === "undefined" ? "default" : Notification.permission,
  async prepare() {
    await navigator.serviceWorker.register(workerPath, { scope: "/" });
    registration = await new Promise<ServiceWorkerRegistration>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("worker_unavailable")), 8000);
      void navigator.serviceWorker.ready.then(worker => {
        window.clearTimeout(timeout);
        resolve(worker);
      });
    });
    if (registration.active?.scriptURL !== new URL(workerPath, location.origin).href) {
      registration = undefined;
      throw new Error("invalid_worker");
    }
  },
  async subscription() {
    const worker = await existingWorker();
    const subscription = await worker?.pushManager.getSubscription();
    return subscription ? serialize(subscription) : null;
  },
  subscribe(publicKey) {
    if (!registration) return Promise.reject(new Error("worker_unavailable"));
    const bytes = Uint8Array.from(atob(publicKey.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
    return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes }).then(serialize);
  },
  async unsubscribe() {
    const worker = await existingWorker();
    const subscription = await worker?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  },
  read() {
    try {
      const value: SavedEnrollment | null = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      return value && typeof value.owner === "string" && typeof value.requestId === "string" ? value : null;
    } catch { return null; }
  },
  save(value) {
    if (value) localStorage.setItem(storageKey, JSON.stringify(value));
    else localStorage.removeItem(storageKey);
  },
  onResume(callback) {
    const onVisible = () => { if (document.visibilityState === "visible") callback(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", callback);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", callback);
    };
  },
};
