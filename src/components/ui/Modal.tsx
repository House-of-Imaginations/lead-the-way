"use client";

import { Close } from "@carbon/icons-react";
import { Dialog } from "radix-ui";
import { useRef, type ReactElement, type ReactNode } from "react";
import { Button, type ButtonKind } from "./Button";

export type ModalProps = {
  title: string;
  /** Context above the title, e.g. the flow name. */
  label?: string;
  /** One sentence under the title; screen readers read it as the dialog's description. */
  description?: string;
  children?: ReactNode;
  /** Pass one so focus returns to it on close. */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Without it the modal is passive: no footer. */
  primaryText?: string;
  /** Doesn't close an uncontrolled modal; control `open` to close it. Toast after closing. */
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  /** The confirm button's kind: "danger" for a destructive action. */
  primaryKind?: ButtonKind;
  secondaryText?: string;
  /** The secondary runs this instead of closing; control `open` to close. */
  onSecondary?: () => void;
  /** The primary submits this form (in the body) instead of calling onPrimary. */
  formId?: string;
  /** Focus something other than the trigger on close: call e.preventDefault(), then focus it. */
  onCloseAutoFocus?: (e: Event) => void;
};

export function Modal({
  title,
  label,
  description,
  children,
  trigger,
  open,
  onOpenChange,
  primaryText,
  onPrimary,
  primaryDisabled,
  primaryKind = "primary",
  secondaryText = "Cancel",
  onSecondary,
  formId,
  onCloseAutoFocus,
}: ModalProps) {
  const primary = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="ltw-scrim ltw-scrim-fixed ltw-scrim-modal">
          <Dialog.Content
            className="ltw-modal"
            // Radix links the description itself; without one, say so explicitly.
            {...(description ? {} : { "aria-describedby": undefined })}
            // Carbon: a form modal starts on its first field, else the primary
            // action takes focus. Close does when there is neither.
            onOpenAutoFocus={(e) => {
              const field = formId
                ? document
                    .getElementById(formId)
                    ?.querySelector<HTMLElement>("input, textarea, select")
                : null;
              const target =
                field ?? (primary.current?.disabled ? null : primary.current);
              if (target) {
                e.preventDefault();
                target.focus();
              }
            }}
            onCloseAutoFocus={onCloseAutoFocus}
          >
            <div className="ltw-modal-h">
              <div>
                {label && <span className="ltw-lbl">{label}</span>}
                <Dialog.Title className="ltw-modal-t">{title}</Dialog.Title>
              </div>
              <Dialog.Close className="ltw-modal-x" aria-label="Close">
                <Close size={20} aria-hidden="true" />
              </Dialog.Close>
            </div>
            <div className="ltw-modal-b">
              {description && (
                <Dialog.Description asChild>
                  <p>{description}</p>
                </Dialog.Description>
              )}
              {children}
            </div>
            {primaryText && (
              <div className="ltw-modal-f">
                {onSecondary ? (
                  <Button kind="secondary" onClick={onSecondary}>
                    {secondaryText}
                  </Button>
                ) : (
                  <Dialog.Close asChild>
                    <Button kind="secondary">{secondaryText}</Button>
                  </Dialog.Close>
                )}
                <Button
                  ref={primary}
                  kind={primaryKind}
                  type={formId ? "submit" : "button"}
                  form={formId}
                  onClick={formId ? undefined : onPrimary}
                  disabled={primaryDisabled}
                >
                  {primaryText}
                </Button>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
