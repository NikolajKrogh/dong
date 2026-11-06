import type { GoalNotificationBrowser } from "./goalNotificationBrowser";

export const goalNotifications: GoalNotificationBrowser = {
  availability: () => ({ kind: "native" }),
  permission: () => "default",
  prepare: async () => undefined,
  subscription: async () => null,
  subscribe: async () => { throw new Error("unsupported"); },
  unsubscribe: async () => undefined,
  read: () => null,
  save: () => undefined,
  onResume: () => () => undefined,
};
