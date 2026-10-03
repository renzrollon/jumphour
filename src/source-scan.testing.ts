// Test-only helper for the repository guard tests: enumerate source files,
// strip comments so a guard matches code rather than prose that names what it
// forbids, and pull out the module specifiers a file imports. Like
// app/css-rules.testing.ts, it is enough for this codebase, not a general
// parser: strings and comments are tracked exactly, and regex literals and JSX
// text are handled by the usual heuristics, with every string or regex state
// ending at a newline so a misread can never swallow more than one line.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Built from the import.meta.url string: under a jsdom test the global URL is jsdom's, which fileURLToPath rejects.
export const SRC_ROOT = dirname(fileURLToPath(import.meta.url)) + sep;
export const REPO_ROOT = resolve(SRC_ROOT, "..");

export const SCRIPT_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

/** Every file under `dir` whose name matches `pattern`, recursively, sorted. */
export function listFiles(dir: string, pattern: RegExp = SCRIPT_EXTENSIONS): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return name === "node_modules" ? [] : listFiles(full, pattern);
      return pattern.test(name) ? [full] : [];
    })
    .sort();
}

export function readSource(file: string): string {
  return readFileSync(file, "utf8");
}

/** A path relative to the repository root, with forward slashes, for readable failures. */
export function repoPath(file: string): string {
  return relative(REPO_ROOT, file).split(sep).join("/");
}

/** Test files and test-only helpers, which may name what the guards forbid. */
export function isTestFile(file: string): boolean {
  return /\.test\.[cm]?[jt]sx?$/.test(file) || /\.testing\.[cm]?[jt]sx?$/.test(file);
}

const REGEX_AFTER_WORD = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await",
]);

/**
 * Replace every comment with whitespace, keeping newlines, strings, template
 * literals, and regex literals intact.
 */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  // Brace depth of each open `${` inside a template literal, innermost last.
  const templateDepths: number[] = [];
  let braceDepth = 0;
  let lastSignificant = "";

  // The identifier or keyword `out` ends with, ignoring trailing whitespace.
  const trailingWord = () => {
    let end = out.length;
    while (end > 0 && /\s/.test(out[end - 1]!)) end--;
    let start = end;
    while (start > 0 && /[\w$]/.test(out[start - 1]!)) start--;
    return out.slice(start, end);
  };

  const regexMayStart = () => {
    if (lastSignificant === "") return true;
    if (/[\w$]/.test(lastSignificant)) return REGEX_AFTER_WORD.has(trailingWord());
    // `</` closes a JSX tag; `)`, `]`, `}` and string ends precede division.
    return "(,=:[!&|?{};+-*%>~^".includes(lastSignificant);
  };

  const note = (ch: string) => {
    if (!/\s/.test(ch)) lastSignificant = ch;
  };

  // Copies a quoted string or regex body starting after its opener; stops after the closer or at a newline.
  const copyUntil = (closer: string, regex: boolean) => {
    let inClass = false;
    while (i < source.length) {
      const ch = source[i]!;
      if (ch === "\n") return;
      out += ch;
      i++;
      if (ch === "\\") {
        if (i < source.length && source[i] !== "\n") out += source[i++];
        continue;
      }
      if (regex && ch === "[") inClass = true;
      else if (regex && ch === "]") inClass = false;
      else if (ch === closer && !inClass) return;
    }
  };

  // Copies template text; returns at the closing backtick or after an opening `${`.
  const copyTemplate = () => {
    while (i < source.length) {
      const ch = source[i]!;
      if (ch === "\\") {
        out += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (ch === "`") {
        out += ch;
        i++;
        return;
      }
      if (ch === "$" && source[i + 1] === "{") {
        out += "${";
        i += 2;
        templateDepths.push(braceDepth);
        braceDepth++;
        return;
      }
      out += ch;
      i++;
    }
  };

  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];

    if (ch === "/" && next === "/" && source[i - 1] !== ":") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'") {
      out += ch;
      i++;
      copyUntil(ch, false);
      note(ch);
      continue;
    }
    if (ch === "`") {
      out += ch;
      i++;
      copyTemplate();
      note("`");
      continue;
    }
    if (ch === "/" && regexMayStart()) {
      out += ch;
      i++;
      copyUntil("/", true);
      // A regex literal is an operand, like a closing parenthesis: a `/` after it divides.
      lastSignificant = ")";
      continue;
    }
    if (ch === "{") braceDepth++;
    if (ch === "}") {
      braceDepth--;
      if (templateDepths.length > 0 && templateDepths[templateDepths.length - 1] === braceDepth) {
        templateDepths.pop();
        out += ch;
        i++;
        copyTemplate();
        note("`");
        continue;
      }
    }
    out += ch;
    i++;
    note(ch);
  }
  return out;
}

const SPECIFIER_PATTERNS = [
  // import x from "m"; import { x } from "m"; export { x } from "m"; export * from "m"
  /\b(?:import|export)\s[^;"'`]*?\bfrom\s*["']([^"']+)["']/g,
  // import "m";
  /\bimport\s*["']([^"']+)["']/g,
  // import("m"); require("m")
  /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g,
];

/** Every module specifier `source` imports or re-exports, statically or dynamically. Comments are ignored. */
export function moduleSpecifiers(source: string): string[] {
  const code = stripComments(source);
  return SPECIFIER_PATTERNS.flatMap((pattern) => [...code.matchAll(pattern)].map((match) => match[1]!));
}

/**
 * Resolve a relative specifier from `fromFile` to the module it names, trying
 * the extensions and index files the bundler would. `exists` decides which
 * candidate is real, so callers can resolve against the file system or
 * against an in-memory module map. Bare specifiers resolve to undefined.
 */
export function resolveRelative(fromFile: string, specifier: string, exists: (path: string) => boolean): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, ...["ts", "tsx", "js", "jsx"].flatMap((ext) => [`${base}.${ext}`, join(base, `index.${ext}`)])];
  return candidates.find(exists);
}
