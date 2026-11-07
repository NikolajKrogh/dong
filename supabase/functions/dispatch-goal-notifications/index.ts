import { createGoalNotificationDispatcher } from '../_shared/goal-notifications/dispatch.ts';
import { readGoalPushConfiguration } from '../_shared/goal-notifications/pushConfiguration.ts';

let handle: ReturnType<typeof createGoalNotificationDispatcher> | undefined;

export default {
  async fetch(request: Request) {
    try {
      handle ??= createGoalNotificationDispatcher(readGoalPushConfiguration(),
        Deno.env.get('GOAL_NOTIFICATION_DISPATCH_DATABASE_URL') ?? '',
        Deno.env.get('GOAL_NOTIFICATION_WAKE_SECRET') ?? '');
      return await handle(request);
    } catch {
      return new Response(null, { status: 503 });
    }
  },
};
