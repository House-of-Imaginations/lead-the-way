"use client";

import { CheckmarkFilled, Close } from "@carbon/icons-react";
import { Toast as RadixToast } from "radix-ui";
import {
  createContext,
  use,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastInput = { title: string; body?: string };
type Shown = ToastInput & { id: number };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/** Mount once near the root. Toasts only confirm an action just taken. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Shown[]>([]);
  const nextId = useRef(0);

  const show = useCallback((toast: ToastInput) => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((list) => [...list, { ...toast, id }]);
  }, []);

  return (
    <ToastContext value={show}>
      <RadixToast.Provider
        label="Notifications"
        duration={5000}
        swipeDirection="right"
      >
        {children}
        {toasts.map((t) => (
          <RadixToast.Root
            key={t.id}
            className="ltw-toast"
            onOpenChange={(open) => {
              if (!open) setToasts((list) => list.filter((x) => x.id !== t.id));
            }}
          >
            <CheckmarkFilled className="ltw-i" aria-hidden="true" />
            <div>
              <RadixToast.Title className="ltw-toast-t">
                {t.title}
              </RadixToast.Title>
              {t.body && (
                <RadixToast.Description className="ltw-toast-d">
                  {t.body}
                </RadixToast.Description>
              )}
            </div>
            <RadixToast.Close aria-label="Close">
              <Close className="ltw-i" aria-hidden="true" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="ltw-toast-vp" />
      </RadixToast.Provider>
    </ToastContext>
  );
}

export function useToast() {
  const show = use(ToastContext);
  if (!show) throw new Error("useToast must be used inside ToastProvider.");
  return show;
}
