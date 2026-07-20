import { describe, expect, it } from "@jest/globals";

import {
  initialToastQueueState,
  toastQueueReducer,
  type QueuedToastData,
  type ToastQueueState,
} from "../../../hooks/gameProgress/toastQueueReducer";

const buildToast = (
  overrides: Partial<QueuedToastData> = {},
): QueuedToastData => ({
  type: "success",
  text1: "Arsenal 1-0 Chelsea",
  text2: "Alice should drink!",
  ...overrides,
});

describe("toastQueueReducer", () => {
  it("enqueue appends to the queue without affecting visibility", () => {
    const toast = buildToast();
    const next = toastQueueReducer(initialToastQueueState, {
      type: "enqueue",
      toast,
    });

    expect(next.queue).toEqual([toast]);
    expect(next.isToastVisible).toBe(false);
  });

  it("enqueue preserves FIFO order across multiple calls", () => {
    const first = buildToast({ text1: "first" });
    const second = buildToast({ text1: "second" });

    const afterFirst = toastQueueReducer(initialToastQueueState, {
      type: "enqueue",
      toast: first,
    });
    const afterSecond = toastQueueReducer(afterFirst, {
      type: "enqueue",
      toast: second,
    });

    expect(afterSecond.queue).toEqual([first, second]);
  });

  it("showNext pops the front of the queue and marks a toast visible", () => {
    const first = buildToast({ text1: "first" });
    const second = buildToast({ text1: "second" });
    const state: ToastQueueState = {
      queue: [first, second],
      isToastVisible: false,
    };

    const next = toastQueueReducer(state, { type: "showNext" });

    expect(next.queue).toEqual([second]);
    expect(next.isToastVisible).toBe(true);
  });

  it("hide clears visibility without touching the queue", () => {
    const state: ToastQueueState = {
      queue: [buildToast()],
      isToastVisible: true,
    };

    const next = toastQueueReducer(state, { type: "hide" });

    expect(next.isToastVisible).toBe(false);
    expect(next.queue).toEqual(state.queue);
  });

  it("returns the same state reference for an unknown action", () => {
    const next = toastQueueReducer(
      initialToastQueueState,
      { type: "noop" } as any,
    );

    expect(next).toBe(initialToastQueueState);
  });
});
