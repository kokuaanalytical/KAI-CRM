"use client";

import * as React from "react";

type ToastData = {
  id: string;
  title?: string;
  description?: string;
};

const TOAST_LIMIT = 5;

let listeners: Array<(toasts: ToastData[]) => void> = [];
let memory: ToastData[] = [];

function emit() {
  listeners.forEach((l) => l(memory));
}

export function toast(t: Omit<ToastData, "id">) {
  const id = crypto.randomUUID();
  memory = [{ id, ...t }, ...memory].slice(0, TOAST_LIMIT);
  emit();
  return id;
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastData[]>(memory);

  React.useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);

  function dismiss(id: string) {
    memory = memory.filter((t) => t.id !== id);
    emit();
  }

  return { toasts, toast, dismiss };
}
