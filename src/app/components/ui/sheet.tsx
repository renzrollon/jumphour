"use client";

// Task 5.2 (design.md Decision 4): the right-side modal overlay — full height,
// up to 640px wide, full width on narrow viewports. Same behavior as Dialog;
// see modal.tsx for the props.
import { ModalFrame, type ModalProps } from "./modal";

export type { ModalCloseReason } from "./modal";
export type SheetProps = ModalProps;

export function Sheet(props: SheetProps) {
  return <ModalFrame {...props} placement="right" />;
}
