export interface QueuedToastData {
  type: string;
  text1: string;
  text2?: string;
  props?: Record<string, unknown>;
  position?: "top" | "bottom";
  visibilityTime?: number;
}

export interface ToastQueueState {
  queue: QueuedToastData[];
  isToastVisible: boolean;
}

export type ToastQueueAction =
  | { type: "enqueue"; toast: QueuedToastData }
  | { type: "showNext" }
  | { type: "hide" };

export const initialToastQueueState: ToastQueueState = {
  queue: [],
  isToastVisible: false,
};

export const toastQueueReducer = (
  state: ToastQueueState,
  action: ToastQueueAction,
): ToastQueueState => {
  switch (action.type) {
    case "enqueue":
      return {
        ...state,
        queue: [...state.queue, action.toast],
      };
    case "showNext":
      return {
        queue: state.queue.slice(1),
        isToastVisible: true,
      };
    case "hide":
      return {
        ...state,
        isToastVisible: false,
      };
    default:
      return state;
  }
};
