"use client";

// Task 5.2 (design.md Decision 4): the markup and state shared by Dialog and
// Sheet. Internal — import Dialog or Sheet, not this module. The behavior
// (focus in, Tab trap, background isolation, Escape, focus restoration, scroll
// lock) is the overlay core's; this frame renders what the core leaves to its
// primitives: role="dialog", aria-modal, aria-labelledby/-describedby, and
// tabIndex={-1} on the surface, plus the "working" statement a guarded
// overlay must show (specs/design-system/spec.md, "Trap, dismiss, and restore
// focus for modal overlays" — Failure scenario).
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useOverlay } from "./overlay";
import { IconButton } from "./icon-button";
import { CloseIcon } from "./icon";
import styles from "./modal.module.css";

/** Why a modal asked to close: the Escape key or its own close button. */
export type ModalCloseReason = "escape" | "close-button";

export interface ModalProps {
  /** Whether the overlay is shown. Controlled by the caller. */
  open: boolean;
  /** Called when the viewer asks to close. The caller closes it by setting `open` to false. */
  onClose: (reason: ModalCloseReason) => void;
  /** The overlay's heading; also its accessible name. */
  title: ReactNode;
  /** Optional supporting line under the title; becomes the accessible description. */
  description?: ReactNode;
  children?: ReactNode;
  /** Actions row pinned under the content. */
  footer?: ReactNode;
  /**
   * Set while an operation started from this overlay is in flight. Escape and
   * the close button are refused, and `busyMessage` is shown and announced.
   */
  closeGuard?: boolean;
  /** States the in-flight work while `closeGuard` is set. Default "Working…". */
  busyMessage?: string;
  /** The control that opened the overlay; focus returns to it on close. */
  invokerRef?: RefObject<HTMLElement | null>;
  /** Where focus lands on open. Defaults to the first tabbable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Accessible name of the close button. Default "Close". */
  closeLabel?: string;
  className?: string;
}

const REFUSED_NOTE = "It can be closed once this finishes.";

const noopSubscribe = () => () => {};

/** True on the client, false during server rendering — without a hydration mismatch. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function ModalFrame({
  placement,
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeGuard = false,
  busyMessage = "Working…",
  invokerRef,
  initialFocusRef,
  closeLabel = "Close",
  className,
}: ModalProps & { placement: "center" | "right" }) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const isClient = useIsClient();
  // Set when a close was refused, so the working statement also says why the
  // key did nothing — the overlay never ignores Escape silently.
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    if (!closeGuard || !open) setRefused(false);
  }, [closeGuard, open]);

  useOverlay({
    open: open && isClient,
    kind: "modal",
    surfaceRef,
    invokerRef,
    initialFocusRef,
    closeGuard,
    onDismiss: () => onClose("escape"),
    onDismissRefused: () => setRefused(true),
  });

  if (!open || !isClient) return null;

  const requestClose = () => {
    if (closeGuard) {
      setRefused(true);
      return;
    }
    onClose("close-button");
  };

  const panelClasses = [styles.panel, placement === "right" ? styles.sheet : styles.dialog, className]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div className={placement === "right" ? styles.backdropRight : styles.backdropCenter}>
      <div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={closeGuard || undefined}
        tabIndex={-1}
        className={panelClasses}
      >
        <div className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            ) : null}
          </div>
          <IconButton
            icon={<CloseIcon size={12} />}
            aria-label={closeLabel}
            aria-disabled={closeGuard || undefined}
            onClick={requestClose}
          />
        </div>
        {/* Always rendered so assistive technology is already watching it when work starts. */}
        <p role="status" className={closeGuard ? styles.busy : styles.idle}>
          {closeGuard ? (refused ? `${busyMessage} ${REFUSED_NOTE}` : busyMessage) : null}
        </p>
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
