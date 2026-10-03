"use client";

// Task 5.2 (design.md Decision 4): the centered modal overlay. All modal
// behavior comes from the shared overlay core through ModalFrame; see
// modal.tsx for the props.
import { ModalFrame, type ModalProps } from "./modal";

export type { ModalCloseReason } from "./modal";
export type DialogProps = ModalProps;

export function Dialog(props: DialogProps) {
  return <ModalFrame {...props} placement="center" />;
}
