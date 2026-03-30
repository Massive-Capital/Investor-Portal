export type ToastVariant = "success" | "error";

export type ToastRecord = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration: number;
};

let toasts: ToastRecord[] = [];
const listeners = new Set<() => void>();
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

function emit(): void {
  for (const l of listeners) l();
}

export function getToastSnapshot(): ToastRecord[] {
  return toasts;
}

export function subscribeToasts(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function dismissToast(id: string): void {
  const tid = timeouts.get(id);
  if (tid !== undefined) {
    clearTimeout(tid);
    timeouts.delete(id);
  }
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function pushToast(
  partial: Omit<ToastRecord, "id" | "duration"> & { duration?: number },
): string {
  const id = crypto.randomUUID();
  const duration = partial.duration ?? 5000;
  const { duration: _d, ...rest } = partial;
  toasts = [...toasts, { ...rest, id, duration }];
  emit();
  const tid = window.setTimeout(() => dismissToast(id), duration);
  timeouts.set(id, tid);
  return id;
}

export const toast = {
  success(
    title: string,
    description?: string,
    durationMs?: number,
  ): string {
    return pushToast({
      variant: "success",
      title,
      description,
      duration: durationMs,
    });
  },
  error(title: string, description?: string, durationMs?: number): string {
    return pushToast({
      variant: "error",
      title,
      description,
      duration: durationMs,
    });
  },
  dismiss: dismissToast,
};
