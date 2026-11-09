import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, cpSync, writeFileSync, readFileSync, readdirSync, appendFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { splitFrontmatter, isYamlSafePlain } from "../lib/frontmatter.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lint = (...args) => spawnSync(process.execPath, [join(root, "scripts/lint-rules.mjs"), ...args], { encoding: "utf8" });

function tempPack() {
  const dir = mkdtempSync(join(tmpdir(), "bhvcr-pack-"));
  cpSync(join(root, "rules"), join(dir, "rules"), { recursive: true });
  cpSync(join(root, "skills"), join(dir, "skills"), { recursive: true });
  return dir;
}
const expectFail = (dir, pattern) => {
  const r = lint("--root", dir);
  assert.equal(r.status, 1, `expected failure, got:\n${r.stdout}${r.stderr}`);
  assert.match(r.stderr, pattern);
};

test("the shipped pack passes lint", () => {
  const r = lint();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Rules: 8 {2}Skills: 4/);
});

test("rule without frontmatter fails", () => {
  const d = tempPack();
  const f = join(d, "rules/rate-limits.mdc");
  writeFileSync(f, splitFrontmatter(readFileSync(f, "utf8")).body);
  expectFail(d, /rate-limits\.mdc: missing frontmatter/);
});

test("brace globs and YAML-unsafe descriptions fail", () => {
  const d = tempPack();
  const f = join(d, "rules/error-handling.mdc");
  const t = readFileSync(f, "utf8")
    .replace(/^globs: .*$/m, "globs: **/*.{ts,tsx}")
    .replace(/^description: .*$/m, "description: Errors: always log them properly and return safe messages to users");
  writeFileSync(f, t);
  expectFail(d, /must not contain spaces, quotes or braces/);
  expectFail(d, /description must be plain text/);
});

test("missing sections and unbalanced fences fail", () => {
  const d = tempPack();
  const f = join(d, "rules/secrets-and-env.mdc");
  writeFileSync(f, readFileSync(f, "utf8").replace("## Never", "## Avoid") + "\n```ts\nopen fence\n");
  expectFail(d, /missing "## Never" section/);
  expectFail(d, /unbalanced/);
});

test("two always-on rules fail", () => {
  const d = tempPack();
  const f = join(d, "rules/rate-limits.mdc");
  writeFileSync(f, readFileSync(f, "utf8").replace("alwaysApply: false", "alwaysApply: true"));
  expectFail(d, /exactly one alwaysApply: true rule/);
});

test("skill name must match its folder and say when to use it", () => {
  const d = tempPack();
  const f = join(d, "skills/add-rate-limiting/SKILL.md");
  writeFileSync(f, readFileSync(f, "utf8").replace("name: add-rate-limiting", "name: rate-limits").replace("Use when", "Good for"));
  expectFail(d, /must equal folder name "add-rate-limiting"/);
  expectFail(d, /should say when to use it/);
});

test("banned claims and secret-shaped strings fail", () => {
  const d = tempPack();
  appendFileSync(join(d, "rules/stripe-webhooks.mdc"), "\nWe offer 24/7 support.\n");
  const fakeKey = ["sk", "live", "4eC39HqLyjWDarjtT1zdp7dc"].join("_"); // built at runtime so this repo never contains it
  writeFileSync(join(d, "rules/leak.md"), `const key = "${fakeKey}";\n`);
  expectFail(d, /banned claim "24\/7"/);
  expectFail(d, /secret-shaped string \(Stripe secret key\)/);
});

test("frontmatter subset parser", () => {
  const { frontmatter, body } = splitFrontmatter('---\npaths:\n  - "**/*.ts"\n  - "src/**"\nname: x\nmetadata:\n  origin: BlitzHash\n---\n\n# T\n');
  assert.deepEqual(frontmatter, { paths: ["**/*.ts", "src/**"], name: "x", metadata: { origin: "BlitzHash" } });
  assert.equal(body.trim(), "# T");
  assert.throws(() => splitFrontmatter("---\nname: x\n# never closed\n"), /never closed/);
  assert.equal(isYamlSafePlain("**/api/**"), false);
  assert.equal(isYamlSafePlain("Plain text, with commas."), true);
  assert.equal(isYamlSafePlain("Key: value"), false);
});

// Real YAML parser check (the `yaml` dev dependency): what our installer writes must parse
// the same way in a spec-compliant parser. Cursor .mdc files are excluded on purpose:
// Cursor reads its own unquoted `globs: **/*.ts` style, which is not strict YAML.
test("installed frontmatter parses identically with a real YAML parser", async (t) => {
  let YAML;
  try {
    YAML = await import("yaml");
  } catch {
    t.skip("yaml dev dependency not installed (run npm ci)");
    return;
  }
  const p = mkdtempSync(join(tmpdir(), "bhvcr-proj-"));
  execFileSync("bash", [join(root, "install.sh"), "--target", "all", "--project", p, "--yes"], { encoding: "utf8" });
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const q = join(dir, e.name);
      if (e.isDirectory()) walk(q);
      else if (e.name.endsWith(".md") && !q.includes(".cursor/rules")) files.push(q);
    }
  };
  walk(p);
  files.push(...readdirSync(join(root, "skills")).map((s) => join(root, "skills", s, "SKILL.md")).filter(existsSync));
  let checked = 0;
  for (const f of files) {
    const { frontmatter, raw } = splitFrontmatter(readFileSync(f, "utf8"));
    if (!raw) continue;
    assert.deepEqual(YAML.parse(raw, { strict: true }), frontmatter, f);
    checked++;
  }
  assert.ok(checked >= 30, `only ${checked} frontmatter blocks checked`);
});
