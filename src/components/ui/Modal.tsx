"use client";

import { Close } from "@carbon/icons-react";
import { Dialog } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { Button } from "./Button";

export type ModalProps = {
  title: string;
  /** Context above the title, e.g. the flow name. */
  label?: string;
  children: ReactNode;
  /** Pass one so focus returns to it on close. */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Without it the modal is passive: no footer. */
  primaryText?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  secondaryText?: string;
};

export function Modal({
  title,
  label,
  children,
  trigger,
  open,
  onOpenChange,
  primaryText,
  onPrimary,
  primaryDisabled,
  secondaryText = "Cancel",
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="ltw-scrim ltw-scrim-fixed">
          <Dialog.Content className="ltw-modal" aria-describedby={undefined}>
            <div className="ltw-modal-h">
              <div>
                {label && <span className="ltw-lbl">{label}</span>}
                <Dialog.Title className="ltw-modal-t">{title}</Dialog.Title>
              </div>
              <Dialog.Close className="ltw-modal-x" aria-label="Close">
                <Close size={20} aria-hidden="true" />
              </Dialog.Close>
            </div>
            <div className="ltw-modal-b">{children}</div>
            {primaryText && (
              <div className="ltw-modal-f">
                <Dialog.Close asChild>
                  <Button kind="secondary">{secondaryText}</Button>
                </Dialog.Close>
                <Button onClick={onPrimary} disabled={primaryDisabled}>
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
