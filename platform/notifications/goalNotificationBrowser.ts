export type GoalNotificationTarget =
  | "android_chrome" | "android_firefox" | "android_samsung" | "iphone_home_screen" | "other";

export type BrowserAvailability =
  | { kind: "native" | "unsupported" | "installation_required" }
  | { kind: "supported"; target: GoalNotificationTarget };

export interface BrowserPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface InstallationControl {
  id: string;
  credential: string;
  generation: number;
}

export interface SavedEnrollment {
  owner: string;
  requestId: string;
  installation?: InstallationControl;
  pendingStop?: boolean;
}

export interface GoalNotificationBrowser {
  availability(): BrowserAvailability;
  permission(): "default" | "denied" | "granted";
  prepare(): Promise<void>;
  subscription(): Promise<BrowserPushSubscription | null>;
  subscribe(publicKey: string): Promise<BrowserPushSubscription>;
  unsubscribe(): Promise<void>;
  read(): SavedEnrollment | null;
  save(value: SavedEnrollment | null): void;
  onResume(callback: () => void): () => void;
}
