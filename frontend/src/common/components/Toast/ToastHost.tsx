import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import {
  dismissToast,
  getToastSnapshot,
  subscribeToasts,
  type ToastRecord,
} from "./toastStore";
import "./toast.css";

function ToastItem({ t }: { t: ToastRecord }) {
  const isSuccess = t.variant === "success";
  return (
    <div
      className="toast_pill"
      role="alert"
      aria-live={isSuccess ? "polite" : "assertive"}
    >
      <div
        className={`toast_pill_icon ${isSuccess ? "toast_pill_icon--success" : "toast_pill_icon--error"}`}
        aria-hidden
      >
        {isSuccess ? (
          <Check size={18} strokeWidth={2.5} />
        ) : (
          <X size={18} strokeWidth={2.5} />
        )}
      </div>
      <div className="toast_pill_body">
        <div className="toast_pill_title">{t.title}</div>
        {t.description ? (
          <div className="toast_pill_desc">{t.description}</div>
        ) : null}
      </div>
      <button
        type="button"
        className="toast_pill_close"
        aria-label="Dismiss"
        onClick={() => dismissToast(t.id)}
      >
        <X size={16} strokeWidth={2} aria-hidden />
      </button>
      <div
        className="toast_pill_timer"
        style={{ animationDuration: `${t.duration}ms` }}
        aria-hidden
      />
    </div>
  );
}

export default function ToastHost() {
  const list = useSyncExternalStore(
    subscribeToasts,
    getToastSnapshot,
    () => [],
  );

  if (typeof document === "undefined" || list.length === 0) {
    return null;
  }

  return createPortal(
    <div className="toast_viewport">
      {list.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>,
    document.body,
  );
}
