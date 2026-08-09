import { useSyncExternalStore } from "react";

export type CallStatus = "idle" | "dialing" | "on_call";

let current: CallStatus = "idle";
const listeners = new Set<() => void>();

export function setCallStatus(status: CallStatus) {
  if (current === status) return;
  current = status;
  // Notify synchronously: useSyncExternalStore expects the store to be
  // consistent with its subscribers. Deferring the notification to a
  // microtask made React re-render subscribers that were no longer (or not
  // yet) mounted, which logged a false "state update on an unmounted
  // component" warning. Every caller lives in an effect, never in render.
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = () => current;

export function useCallStatus(): CallStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
