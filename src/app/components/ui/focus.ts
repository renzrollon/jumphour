// Focus helpers for the shared overlay core (design.md Decision 4). Plain DOM,
// no React: overlay.ts is the intended caller, and these are exported so the
// core's tests can pin the tab-order rules it relies on.

const NATIVELY_FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "summary",
  "[contenteditable]:not([contenteditable='false'])",
].join(",");

const CANDIDATES = `${NATIVELY_FOCUSABLE},[tabindex]`;

function isFocusTarget(el: Element): el is HTMLElement {
  return typeof (el as HTMLElement).focus === "function";
}

/**
 * The element's effective tab index: the `tabindex` attribute when present,
 * otherwise 0 for natively focusable elements and -1 for everything else. Read
 * from the attribute rather than `el.tabIndex` so the answer does not depend on
 * how completely the DOM implementation models native focusability.
 */
function effectiveTabIndex(el: Element): number {
  const attr = el.getAttribute("tabindex");
  if (attr !== null) {
    const parsed = Number.parseInt(attr, 10);
    return Number.isNaN(parsed) ? -1 : parsed;
  }
  return el.matches(NATIVELY_FOCUSABLE) ? 0 : -1;
}

/** Disabled, hidden, inert, or not rendered — it cannot take focus. */
function isUnreachable(el: Element): boolean {
  if (!el.isConnected || el.matches(":disabled")) return true;
  if (el.closest("[hidden],[inert]") !== null) return true;
  const view = el.ownerDocument.defaultView;
  if (!view) return false;
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (view.getComputedStyle(node).display === "none") return true;
  }
  return view.getComputedStyle(el).visibility === "hidden";
}

/** True when `el` can take focus right now, programmatically or by Tab. */
export function canFocus(el: Element): el is HTMLElement {
  return isFocusTarget(el) && el.matches(CANDIDATES) && !isUnreachable(el);
}

function radioGroupKey(el: Element): string | null {
  if (el.tagName !== "INPUT") return null;
  const input = el as HTMLInputElement;
  if (input.type !== "radio" || !input.name) return null;
  return `${input.form ? "form" : "document"}:${input.name}`;
}

/**
 * The elements inside `container` that Tab visits, in tab order: positive
 * tabindex first (ascending), then tabindex 0 in document order. A native
 * radio group contributes one stop — its checked radio, or its first when
 * none is checked. The container itself is never included.
 */
export function getTabbables(container: Element): HTMLElement[] {
  const zero: HTMLElement[] = [];
  const positive: HTMLElement[] = [];
  const radioGroups = new Map<string, HTMLInputElement[]>();

  for (const el of container.querySelectorAll(CANDIDATES)) {
    const index = effectiveTabIndex(el);
    if (index < 0 || !canFocus(el)) continue;
    const key = radioGroupKey(el);
    if (key !== null) {
      const group = radioGroups.get(key);
      if (group) {
        group.push(el as HTMLInputElement);
        continue;
      }
      radioGroups.set(key, [el as HTMLInputElement]);
    }
    (index > 0 ? positive : zero).push(el);
  }

  const stopFor = (el: HTMLElement): HTMLElement => {
    const key = radioGroupKey(el);
    if (key === null) return el;
    return radioGroups.get(key)?.find((radio) => radio.checked) ?? el;
  };

  positive.sort((a, b) => effectiveTabIndex(a) - effectiveTabIndex(b));
  return [...positive, ...zero].map(stopFor);
}

/** Sort comparator placing nodes in document order, across separate subtrees. */
export function compareDocumentOrder(a: Node, b: Node): number {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/**
 * Focus `el`, first making it programmatically focusable when it is a plain
 * region. That temporary `tabindex="-1"` is removed again when focus leaves,
 * so the region never becomes a lasting tab stop. Returns whether focus landed.
 */
export function focusElementOrRegion(el: Element): boolean {
  if (!isFocusTarget(el) || isUnreachable(el)) return false;
  if (!el.matches(CANDIDATES)) {
    el.setAttribute("tabindex", "-1");
    el.addEventListener("blur", () => el.removeAttribute("tabindex"), { once: true });
  }
  el.focus();
  return el.ownerDocument.activeElement === el;
}
