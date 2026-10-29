import { getSupabaseClient } from "../../lib/supabase";

type RoomRealtimeClient = ReturnType<typeof getSupabaseClient>;

type RoomRealtimeChannel = ReturnType<RoomRealtimeClient["channel"]>;

interface RoomSubscription {
  participantId: string;
  listeners: Set<() => unknown>;
  channel: RoomRealtimeChannel | null;
  ready: Promise<void> | null;
  disposal: Promise<void> | null;
  retired: boolean;
}

// Supabase reuses same-topic channels, and presence handlers cannot be added after subscribe.
const roomSubscriptions = new WeakMap<RoomRealtimeClient, Map<string, RoomSubscription>>();

const retireRoomSubscription = (
  client: RoomRealtimeClient,
  topic: string,
  subscriptions: Map<string, RoomSubscription>,
  entry: RoomSubscription,
): Promise<void> => {
  if (entry.disposal) return entry.disposal;
  entry.retired = true;
  entry.listeners.clear();
  entry.disposal = (entry.ready ?? Promise.resolve()).then(async () => {
    if (!entry.channel) return;
    try {
      const result = await client.removeChannel(entry.channel);
      // removeChannel only tears down on an acknowledged leave in the installed client.
      if (result !== "ok") entry.channel.teardown();
    } catch {
      entry.channel.teardown();
    }
  }).finally(() => {
    if (subscriptions.get(topic) === entry) subscriptions.delete(topic);
  });
  return entry.disposal;
};

export const subscribeToRoomChanges = (
  sessionId: string,
  participantId: string,
  refresh: () => unknown,
) => {
  const client = getSupabaseClient();
  let subscriptions = roomSubscriptions.get(client);
  if (!subscriptions) {
    subscriptions = new Map();
    roomSubscriptions.set(client, subscriptions);
  }
  const topic = `room:${sessionId}`;
  const previous = subscriptions.get(topic);
  let entry = previous;
  if (!entry || entry.retired || entry.participantId !== participantId) {
    const pendingRemoval = previous ? retireRoomSubscription(client, topic, subscriptions, previous) : null;
    entry = { participantId, listeners: new Set(), channel: null, ready: null, disposal: null, retired: false };
    subscriptions.set(topic, entry);
    const current = entry;
    const start = () => {
      if (current.retired) return;
      // A failed leave or hot reload can leave an unowned cached channel. Poll instead of rebinding it.
      if (client.getChannels?.().some(channel => channel.topic === `realtime:${topic}`)) return;
      const channel = client.channel(topic, {
        config: { private: true, presence: { key: participantId } },
      });
      current.channel = channel;
      const notify = () => {
        if (current.retired) return;
        for (const listener of current.listeners) void listener();
      };
      let previousPresence = "";
      channel.on("broadcast", { event: "room_changed" }, notify);
      channel.on("presence", { event: "sync" }, () => {
        if (current.retired) return;
        const presence = Object.keys(channel.presenceState()).sort().join("|");
        if (presence === previousPresence) return;
        previousPresence = presence;
        if (presence) notify();
      });
      channel.subscribe(state => {
        if (!current.retired && state === "SUBSCRIBED") void channel.track({}).catch(() => { });
      });
    };
    // A replacement must wait until the old cached channel has actually left the client.
    if (pendingRemoval) current.ready = pendingRemoval.then(start).catch(() => { });
    else { start(); current.ready = Promise.resolve(); }
  }
  const current = entry;
  // A separate lease preserves two consumers even if they passed the same callback.
  const listener = () => refresh();
  current.listeners.add(listener);
  return () => {
    current.listeners.delete(listener);
    if (!current.listeners.size) void retireRoomSubscription(client, topic, subscriptions, current);
  };
};
