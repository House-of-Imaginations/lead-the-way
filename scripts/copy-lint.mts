/**
 * Copy lint: the house copy rules from DESIGN.md, as a check.
 *
 * Reads string literals, template text and JSX text (never comments) in
 * src/ and convex/, and fails on em or en dashes, a spaced hyphen used as a
 * dash, hyphenated number or time ranges, emoji, more than one middle dot, and
 * title-case button labels.
 *
 * ponytail: title case is only checked on <Button> and <button> labels, where
 * it is unambiguous. Headings carry proper nouns ("AI Productivity
 * Fundamentals") that no rule can tell apart from title case; review catches
 * those.
 */
import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export type Rule =
  | "dash"
  | "spaced-hyphen"
  | "range"
  | "emoji"
  | "middle-dot"
  | "title-case-button";
export type Finding = { file: string; line: number; rule: Rule; text: string };

const DASH = /[–—]/;
const SPACED_HYPHEN = / --? /;
// "2-5", "9 - 30", "2:00 - 3:00 PM"; not "2026-09-09" or "cols-2".
const RANGE =
  /(?<![\w\-:.])\d{1,2}(?::\d{2})?\s?(?:AM|PM)?\s?-\s?\d{1,2}(?::\d{2})?(?![\w\-:])/;
const EMOJI = /\p{Extended_Pictographic}/u;
const CSS = /\b(?:calc|var|min|max|clamp)\(/;
const PRODUCT_TERM = "Team AI Agreement";

function textRules(text: string): Rule[] {
  const found: Rule[] = [];
  if (DASH.test(text)) found.push("dash");
  if (!CSS.test(text) && SPACED_HYPHEN.test(text)) found.push("spaced-hyphen");
  if (RANGE.test(text)) found.push("range");
  if (EMOJI.test(text)) found.push("emoji");
  if ((text.match(/·/g) ?? []).length > 1) found.push("middle-dot");
  return found;
}

/** Two or more ordinary words, every one capitalised. Acronyms don't count. */
export function isTitleCase(label: string): boolean {
  const words = label
    .replace(PRODUCT_TERM, "")
    .trim()
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && w !== w.toUpperCase());
  return words.length >= 2 && words.every((w) => /^[A-Z]/.test(w));
}

function isButton(node: ts.Node): boolean {
  if (!ts.isJsxElement(node)) return false;
  const tag = node.openingElement.tagName.getText();
  return tag === "Button" || tag === "button";
}

function isModuleSpecifier(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    ts.isImportDeclaration(parent) ||
    ts.isExportDeclaration(parent) ||
    ts.isExternalModuleReference(parent) ||
    (ts.isCallExpression(parent) &&
      parent.expression.kind === ts.SyntaxKind.ImportKeyword)
  );
}

export function lintSource(source: string, fileName: string): Finding[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const findings: Finding[] = [];
  const report = (node: ts.Node, rule: Rule, text: string) =>
    findings.push({
      file: fileName,
      line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      rule,
      text: text.trim(),
    });

  const visit = (node: ts.Node) => {
    let text: string | null = null;
    if (ts.isStringLiteral(node) && !isModuleSpecifier(node)) text = node.text;
    else if (
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    )
      text = node.text;
    else if (ts.isJsxText(node)) text = node.text;

    if (text) for (const rule of textRules(text)) report(node, rule, text);

    if (isButton(node)) {
      const label = (node as ts.JsxElement).children
        .filter(ts.isJsxText)
        .map((child) => child.text)
        .join(" ")
        .trim();
      if (label && isTitleCase(label)) report(node, "title-case-button", label);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return findings;
}

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === "_generated" || name === "node_modules") continue;
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (/\.(ts|tsx|mts)$/.test(name) && !name.endsWith(".d.ts")) yield path;
  }
}

// ponytail: @types/node is pinned to v20 (Node 20 types) while this repo runs
// Node 26; `import.meta.main` (Node 24+) has no type yet. Augment locally
// rather than bumping @types/node repo-wide for one field.
declare global {
  interface ImportMeta {
    main: boolean;
  }
}

if (import.meta.main) {
  const root = process.cwd();
  const findings = ["src", "convex"].flatMap((dir) =>
    [...sourceFiles(join(root, dir))].flatMap((path) =>
      lintSource(readFileSync(path, "utf8"), relative(root, path)),
    ),
  );
  for (const f of findings) console.log(`${f.file}:${f.line} ${f.rule} "${f.text}"`);
  if (findings.length > 0) {
    console.error(`\ncopy-lint: ${findings.length} problem(s). See DESIGN.md, "Content and voice".`);
    process.exit(1);
  }
  console.log("copy-lint: clean");
}
