import { useSyncExternalStore } from "react";

export type CallStatus = "idle" | "dialing" | "on_call";

let current: CallStatus = "idle";
const listeners = new Set<() => void>();

export function setCallStatus(status: CallStatus) {
  if (current === status) return;
  current = status;
  // Notify on a microtask so a status change triggered during a render or an
  // unmount cleanup never updates a subscriber mid-commit.
  queueMicrotask(() => listeners.forEach((l) => l()));
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
