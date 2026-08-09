import { useEffect, useState } from "react";

export type CallStatus = "idle" | "dialing" | "on_call";

let current: CallStatus = "idle";
const listeners = new Set<(s: CallStatus) => void>();

export function setCallStatus(status: CallStatus) {
  if (current === status) return;
  current = status;
  listeners.forEach((l) => l(status));
}

export function useCallStatus(): CallStatus {
  const [status, setStatus] = useState<CallStatus>(current);
  useEffect(() => {
    setStatus(current);
    listeners.add(setStatus);
    return () => {
      listeners.delete(setStatus);
    };
  }, []);
  return status;
}
