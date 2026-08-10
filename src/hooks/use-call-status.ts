import { useSyncExternalStore } from "react";

export type CallStatus = "idle" | "dialing" | "on_call";

let current: CallStatus = "idle";
const listeners = new Set<() => void>();

export function setCallStatus(status: CallStatus) {
  if (current === status) return;
  current = status;
  // Update the snapshot immediately (so any render happening right now already
  // sees the new value) but notify subscribers after the current commit has
  // fully flushed. Notifying synchronously from a caller's effect re-rendered
  // sibling subscribers that were rendered but not yet mounted, which logged a
  // bogus "state update on a component that hasn't mounted yet" warning.
  setTimeout(() => {
    listeners.forEach((l) => l());
  }, 0);
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
