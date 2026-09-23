// Test-only helper: a minimal CSS rule reader for the two global stylesheets.
// It strips comments and walks braces, returning each style rule with the chain
// of at-rule preludes it is nested in. Enough for tokens.css and globals.css;
// not a general CSS parser.
import { readFileSync } from "node:fs";

export interface CssRule {
  /** Enclosing at-rule preludes, outermost first, e.g. ["@media (pointer: coarse)"]. */
  atRules: string[];
  selector: string;
  /** Declarations in source order as [property, value]. */
  declarations: Array<[string, string]>;
}

export function readCss(url: URL): string {
  return readFileSync(url, "utf8");
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function parseCssRules(source: string): CssRule[] {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: CssRule[] = [];

  function walk(start: number, atRules: string[]): number {
    let i = start;
    let prelude = "";
    while (i < css.length) {
      const ch = css[i]!;
      if (ch === "}") return i + 1;
      if (ch === "{") {
        const head = normalize(prelude);
        prelude = "";
        if (head.startsWith("@")) {
          i = walk(i + 1, [...atRules, head]);
        } else {
          const end = css.indexOf("}", i);
          if (end === -1) throw new Error(`Unclosed rule: ${head}`);
          const body = css.slice(i + 1, end);
          rules.push({ atRules, selector: head, declarations: splitDeclarations(body) });
          i = end + 1;
        }
        continue;
      }
      prelude += ch;
      i++;
    }
    return i;
  }

  walk(0, []);
  return rules;
}

function splitDeclarations(body: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let depth = 0;
  let current = "";
  const flush = () => {
    const text = current.trim();
    current = "";
    if (!text) return;
    const colon = text.indexOf(":");
    if (colon === -1) throw new Error(`Malformed declaration: ${text}`);
    out.push([text.slice(0, colon).trim(), normalize(text.slice(colon + 1))]);
  };
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === ";" && depth === 0) flush();
    else current += ch;
  }
  flush();
  return out;
}
