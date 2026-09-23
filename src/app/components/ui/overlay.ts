// The one overlay core behind Dialog, Sheet, Popover, and Menu (design.md
// Decision 4). It is hand-rolled because jsdom implements neither
// HTMLDialogElement.showModal, `inert`, nor the popover API, so native modality
// could not be tested here; the behavior under test is the behavior below.
//
// Every open surface joins one module-level stack, in the order it opened.
//   - Escape goes to the top of the stack only (innermost-first). A surface
//     whose `closeGuard` is set refuses and consumes it, so the surface beneath
//     never sees that key.
//   - A modal surface traps Tab and Shift+Tab, pulls stray focus back, swallows
//     pointer presses outside itself, hides everything else from pointer and
//     assistive technology (aria-hidden plus inert), and locks page scroll.
//   - A transient surface dismisses on a pointer press outside it (its invoker
//     counts as inside, so the invoker can toggle it), and opening one
//     transient surface dismisses any other that is not its ancestor.
//   - Closing returns focus to the invoker, or, when the invoker is gone, to
//     the nearest surviving region that contained it — never to the document.
//
// Primitives own their markup: role, aria-modal, aria-labelledby, and
// tabIndex={-1} on the surface element are theirs to render.
import { useLayoutEffect, useRef, type RefObject } from "react";
import { canFocus, compareDocumentOrder, focusElementOrRegion, getTabbables } from "./focus";

export type OverlayKind = "modal" | "transient";

/** Why the core asked to close: Escape, a pointer press outside, or another transient opening. */
export type DismissReason = "escape" | "outside" | "superseded";

export interface OverlayOptions {
  /** Whether the surface is open. The surface element must be rendered while this is true. */
  open: boolean;
  /** `modal` for Dialog and Sheet; `transient` for Popover and Menu. */
  kind: OverlayKind;
  /** The surface element: the dialog panel, sheet, popover, or menu box. */
  surfaceRef: RefObject<HTMLElement | null>;
  /** Called when the core wants the surface closed. The caller closes it by setting `open` to false. */
  onDismiss: (reason: DismissReason) => void;
  /** While true, every dismissal the core would request is refused instead (work is in flight). */
  closeGuard?: boolean;
  /** Called with the reason each time `closeGuard` refuses a dismissal, so the surface can say it is working. */
  onDismissRefused?: (reason: DismissReason) => void;
  /** The control that opened the surface. Defaults to whatever held focus when it opened. */
  invokerRef?: RefObject<HTMLElement | null>;
  /** Where focus goes on open. Defaults to the first tabbable element, then the surface itself. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Set false to leave focus where it is on open. Defaults to true. */
  autoFocus?: boolean;
}

interface Entry {
  readonly kind: OverlayKind;
  readonly surface: HTMLElement;
  readonly invoker: HTMLElement | null;
  /** The open surface this one was invoked from, if any. */
  readonly parent: Entry | null;
  /** Where focus may go when the invoker is gone, nearest first. */
  readonly fallbacks: readonly Element[];
  readonly options: () => OverlayOptions;
  lastFocused: HTMLElement | null;
  /** Set when an outside press dismissed it: focus then follows that press instead of being restored. */
  dismissedByOutsidePress: boolean;
}

const stack: Entry[] = [];

function topModalIndex(): number {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].kind === "modal") return i;
  }
  return -1;
}

/** The surfaces of the entry at `index` and of every entry opened above it. */
function surfacesFrom(index: number): HTMLElement[] {
  return stack.slice(index).map((entry) => entry.surface);
}

function isWithin(node: Node | null, containers: readonly Element[]): boolean {
  return node !== null && containers.some((container) => container.contains(node));
}

function descendsFrom(entry: Entry, ancestor: Entry): boolean {
  for (let current = entry.parent; current; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
}

function requestDismiss(entry: Entry, reason: DismissReason): void {
  const options = entry.options();
  if (options.closeGuard) {
    options.onDismissRefused?.(reason);
    return;
  }
  if (reason === "outside") entry.dismissedByOutsidePress = true;
  options.onDismiss(reason);
}

function forgetOutsidePresses(): void {
  for (const entry of stack) entry.dismissedByOutsidePress = false;
}

// ---- Focus trap -----------------------------------------------------------

function trappedTabbables(containers: readonly HTMLElement[]): HTMLElement[] {
  const roots = [...containers]
    .sort(compareDocumentOrder)
    .filter((container, _, all) => !all.some((other) => other !== container && other.contains(container)));
  return roots.flatMap((root) => getTabbables(root));
}

function trapTab(event: KeyboardEvent): void {
  const modal = topModalIndex();
  if (modal < 0) return;
  const containers = surfacesFrom(modal);
  const doc = stack[modal].surface.ownerDocument;
  const tabbables = trappedTabbables(containers);
  event.preventDefault();

  if (tabbables.length === 0) {
    focusElementOrRegion(stack[modal].surface);
    return;
  }

  const count = tabbables.length;
  const active = doc.activeElement;
  const at = active ? tabbables.indexOf(active as HTMLElement) : -1;
  let next: HTMLElement;
  if (at >= 0) {
    next = tabbables[(at + (event.shiftKey ? count - 1 : 1)) % count];
  } else if (active && isWithin(active, containers)) {
    // Focus sits between stops (the surface itself, or a tabindex="-1" element):
    // continue from its position in document order.
    next = event.shiftKey
      ? ([...tabbables].reverse().find((el) => compareDocumentOrder(el, active) < 0) ?? tabbables[count - 1])
      : (tabbables.find((el) => compareDocumentOrder(active, el) < 0) ?? tabbables[0]);
  } else {
    next = event.shiftKey ? tabbables[count - 1] : tabbables[0];
  }
  next.focus();
}

// ---- Document listeners ---------------------------------------------------

function onKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing) return;
  forgetOutsidePresses();
  if (event.key === "Escape") {
    const top = stack[stack.length - 1];
    if (!top) return;
    event.preventDefault();
    requestDismiss(top, "escape");
    return;
  }
  if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
    trapTab(event);
  }
}

function swallowOutsideModal(event: Event): boolean {
  const modal = topModalIndex();
  if (modal < 0 || isWithin(event.target as Node | null, surfacesFrom(modal))) return false;
  event.preventDefault();
  event.stopPropagation();
  return true;
}

function onPointerDown(event: Event): void {
  forgetOutsidePresses();
  const target = event.target as Node | null;
  const modal = topModalIndex();
  // Only transient surfaces above the topmost modal can be pressed outside of;
  // anything beneath a modal is unreachable while it is open.
  const outside: Entry[] = [];
  for (let i = stack.length - 1; i > modal; i--) {
    const entry = stack[i];
    if (isWithin(target, surfacesFrom(i))) continue;
    if (entry.invoker && isWithin(target, [entry.invoker])) continue;
    outside.push(entry);
  }
  for (const entry of outside) requestDismiss(entry, "outside");
  swallowOutsideModal(event);
}

function onMouseOrClick(event: Event): void {
  swallowOutsideModal(event);
}

function onFocusIn(event: FocusEvent): void {
  const modal = topModalIndex();
  if (modal < 0) return;
  const entry = stack[modal];
  const containers = surfacesFrom(modal);
  const target = event.target as Node | null;
  if (isWithin(target, containers)) {
    entry.lastFocused = target as HTMLElement;
    return;
  }
  // Focus escaped the modal (a script, or assistive technology): pull it back.
  const remembered = entry.lastFocused;
  const back =
    remembered && isWithin(remembered, containers) && canFocus(remembered)
      ? remembered
      : (getTabbables(entry.surface)[0] ?? entry.surface);
  focusElementOrRegion(back);
}

let listeningOn: Document | null = null;

function listen(doc: Document): void {
  if (listeningOn) return;
  listeningOn = doc;
  doc.addEventListener("keydown", onKeyDown);
  doc.addEventListener("pointerdown", onPointerDown, true);
  doc.addEventListener("mousedown", onMouseOrClick, true);
  doc.addEventListener("click", onMouseOrClick, true);
  doc.addEventListener("focusin", onFocusIn, true);
}

function unlisten(): void {
  const doc = listeningOn;
  if (!doc) return;
  listeningOn = null;
  doc.removeEventListener("keydown", onKeyDown);
  doc.removeEventListener("pointerdown", onPointerDown, true);
  doc.removeEventListener("mousedown", onMouseOrClick, true);
  doc.removeEventListener("click", onMouseOrClick, true);
  doc.removeEventListener("focusin", onFocusIn, true);
}

// ---- Background isolation -------------------------------------------------

const NEVER_ISOLATED = new Set(["SCRIPT", "STYLE", "TEMPLATE", "LINK", "META", "NOSCRIPT"]);
const isolated = new Map<Element, { ariaHidden: string | null; inert: boolean }>();

function isLiveRegion(el: Element): boolean {
  return el.hasAttribute("aria-live") || el.matches("[role='alert'],[role='status'],[role='log']");
}

/**
 * Hide everything outside the topmost modal (and the surfaces opened above it)
 * from pointer and assistive technology, by marking the siblings along each
 * surface's ancestor path. Recomputed whenever the stack changes; restores the
 * exact prior attribute values when an element no longer needs hiding.
 */
function syncIsolation(doc: Document): void {
  const wanted = new Set<Element>();
  const modal = topModalIndex();
  if (modal >= 0) {
    const allowed = surfacesFrom(modal).filter((surface) => surface.isConnected);
    const path = new Set<Element>();
    for (const surface of allowed) {
      for (let node: Element | null = surface; node && node !== doc.documentElement; node = node.parentElement) {
        path.add(node);
      }
    }
    for (const node of path) {
      if (allowed.some((surface) => surface.contains(node))) continue;
      for (const child of node.children) {
        if (path.has(child) || NEVER_ISOLATED.has(child.tagName) || isLiveRegion(child)) continue;
        wanted.add(child);
      }
    }
  }

  for (const [el, prior] of isolated) {
    if (wanted.has(el)) continue;
    if (prior.ariaHidden === null) el.removeAttribute("aria-hidden");
    else el.setAttribute("aria-hidden", prior.ariaHidden);
    if (!prior.inert) el.removeAttribute("inert");
    isolated.delete(el);
  }
  for (const el of wanted) {
    if (isolated.has(el)) continue;
    isolated.set(el, { ariaHidden: el.getAttribute("aria-hidden"), inert: el.hasAttribute("inert") });
    el.setAttribute("aria-hidden", "true");
    el.setAttribute("inert", "");
  }
}

// ---- Scroll lock ----------------------------------------------------------

let scrollLocks = 0;
let savedScrollStyle: { overflow: string; gutter: string } | null = null;

function lockScroll(doc: Document): void {
  if (scrollLocks++ > 0) return;
  const root = doc.documentElement;
  savedScrollStyle = { overflow: root.style.overflow, gutter: root.style.getPropertyValue("scrollbar-gutter") };
  // Keep the scrollbar's gutter when the page had one, so hiding the
  // scrollbar does not shift the layout sideways. No viewport measurement.
  const hadScrollbar = root.scrollHeight > root.clientHeight;
  root.style.overflow = "hidden";
  if (hadScrollbar) root.style.setProperty("scrollbar-gutter", "stable");
}

function unlockScroll(doc: Document): void {
  if (scrollLocks === 0 || --scrollLocks > 0) return;
  const root = doc.documentElement;
  const saved = savedScrollStyle ?? { overflow: "", gutter: "" };
  savedScrollStyle = null;
  root.style.overflow = saved.overflow;
  if (saved.gutter) root.style.setProperty("scrollbar-gutter", saved.gutter);
  else root.style.removeProperty("scrollbar-gutter");
}

// ---- Open and close -------------------------------------------------------

function ancestorsOf(el: Element | null): Element[] {
  const chain: Element[] = [];
  const body = el?.ownerDocument.body;
  for (let node = el?.parentElement ?? null; node && node !== body && node !== node.ownerDocument.documentElement; node = node.parentElement) {
    chain.push(node);
  }
  return chain;
}

function restoreFocus(entry: Entry): void {
  for (const candidate of [entry.invoker, ...entry.fallbacks]) {
    if (candidate && focusElementOrRegion(candidate)) return;
  }
}

function openSurface(kind: OverlayKind, surface: HTMLElement, options: () => OverlayOptions): () => void {
  const doc = surface.ownerDocument;
  const initial = options();
  const active = doc.activeElement as HTMLElement | null;
  const invoker =
    initial.invokerRef?.current ??
    (active && active !== doc.body && !surface.contains(active) ? active : null);

  let parent: Entry | null = null;
  for (let i = stack.length - 1; i >= 0 && !parent; i--) {
    const candidate = stack[i];
    if ((invoker && candidate.surface.contains(invoker)) || candidate.surface.contains(surface)) parent = candidate;
  }

  const entry: Entry = {
    kind,
    surface,
    invoker,
    parent,
    // The invoker's own regions first; then, when it was inside another open
    // surface, that surface's invoker and its regions (a menu item's menu is
    // gone, but the button that opened the menu may not be).
    fallbacks: [
      ...ancestorsOf(invoker),
      ...(parent ? [parent.invoker, ...parent.fallbacks].filter((el): el is Element => el !== null) : []),
    ],
    options,
    lastFocused: null,
    dismissedByOutsidePress: false,
  };

  const modalBefore = topModalIndex();
  const superseded =
    kind === "transient"
      ? stack.slice(modalBefore + 1).filter((other) => other.kind === "transient" && !descendsFrom(entry, other))
      : [];

  stack.push(entry);
  listen(doc);
  if (kind === "modal") {
    lockScroll(doc);
    syncIsolation(doc);
  }
  for (const other of superseded) requestDismiss(other, "superseded");

  if (initial.autoFocus !== false && !surface.contains(doc.activeElement)) {
    const target = initial.initialFocusRef?.current ?? getTabbables(surface)[0] ?? surface;
    focusElementOrRegion(target);
  }
  if (surface.contains(doc.activeElement)) entry.lastFocused = doc.activeElement as HTMLElement;

  return function closeSurface() {
    const index = stack.indexOf(entry);
    if (index < 0) return;
    // Decide before anything moves: restore only when focus is still ours —
    // inside this surface, inside a surface opened from it, or lost to the body.
    const focused = doc.activeElement;
    const focusIsOurs =
      !focused ||
      focused === doc.body ||
      surface.contains(focused) ||
      stack.some((other) => descendsFrom(other, entry) && other.surface.contains(focused));

    stack.splice(index, 1);
    if (kind === "modal") unlockScroll(doc);
    syncIsolation(doc);
    if (stack.length === 0) unlisten();

    if (!focusIsOurs || entry.dismissedByOutsidePress) return;
    restoreFocus(entry);
    // The invoker may be removed later in the same commit that closed this
    // surface; once the commit settles, retry if focus fell to the document.
    queueMicrotask(() => {
      const now = doc.activeElement;
      if (!now || now === doc.body) restoreFocus(entry);
    });
  };
}

/**
 * Attach the shared overlay behavior to a surface while `open` is true. See the
 * header comment for the full behavior; the options are read fresh on every
 * key and pointer event, so `closeGuard` can change while the surface is open.
 */
export function useOverlay(options: OverlayOptions): void {
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  const { open, kind } = options;
  useLayoutEffect(() => {
    if (!open) return;
    const surface = latest.current.surfaceRef.current;
    if (!surface) return;
    return openSurface(kind, surface, () => latest.current);
  }, [open, kind]);
}
