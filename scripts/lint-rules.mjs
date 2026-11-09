#!/usr/bin/env node
// Lints the rules pack (frontmatter, sections, size budgets, banned claims, secret-shaped strings)
// and, with --installed DIR, checks that an installed project loads in every supported tool format.
// Zero dependencies. Usage:
//   node scripts/lint-rules.mjs                 lint this pack
//   node scripts/lint-rules.mjs --root DIR      lint another pack folder (used by tests)
//   node scripts/lint-rules.mjs --installed DIR check files written by install.sh --target all
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { splitFrontmatter, isYamlSafePlain } from "../lib/frontmatter.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const MARKER = "<!-- blitzhash-vibe-coding-rules: managed file.";
const LIMITS = {
  ruleBody: 6000, // Windsurf caps a workspace rule at 12,000 characters; keep half for headroom
  alwaysOnBody: 3000, // always-on context is paid on every message
  allBodies: 28000, // Codex reads AGENTS.md up to 32 KiB by default
  descMin: 40,
  descMax: 300,
  skillDescMin: 80,
  skillDescMax: 1024, // Agent Skills spec limit
};
const BANNED = [
  [/24\s*\/\s*7/i, "24/7"],
  [/\bguarantee(d|s)?\b/i, "guarantee"],
  [/money[- ]back/i, "money-back"],
  [/\bunlimited\b/i, "unlimited"],
  [/free hosting/i, "free hosting"],
  [/25\s*k\s*hours|25,000\s*hours/i, "25k hours"],
];
const SECRETS = [
  [/\bsk_(live|test)_[A-Za-z0-9]{16,}/, "Stripe secret key"],
  [/\brk_(live|test)_[A-Za-z0-9]{16,}/, "Stripe restricted key"],
  [/\bwhsec_[A-Za-z0-9]{20,}/, "Stripe webhook secret"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key id"],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}/, "GitHub token"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, "Google API key"],
  [/\bsk-(proj-)?[A-Za-z0-9_-]{32,}/, "OpenAI-style key"],
  [/\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\./, "JWT"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\b(postgres(ql)?|mysql|mongodb(\+srv)?):\/\/[^\s:@/]+:(?!PASSWORD|password|\$\{|<)[^\s@]{6,}@/, "database URL with password"],
];

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

function read(file) {
  return readFileSync(file, "utf8");
}
function fm(file, text) {
  try {
    return splitFrontmatter(text);
  } catch (e) {
    err(file, `frontmatter: ${e.message}`);
    return { frontmatter: null, body: text };
  }
}
function headings(body) {
  const out = [];
  let fence = false;
  for (const line of body.split("\n")) {
    if (/^```/.test(line)) fence = !fence;
    else if (!fence && /^#{1,6} /.test(line)) out.push(line);
  }
  return { list: out, fenceBalanced: !fence };
}
function walk(dir, pred, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "fixtures") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, pred, acc);
    else if (pred(p)) acc.push(p);
  }
  return acc;
}

export function lintPack(root) {
  const rel = (p) => relative(root, p) || p;
  const rulesDir = join(root, "rules");
  const skillsDir = join(root, "skills");
  if (!existsSync(rulesDir)) err(root, "missing rules/ folder");
  const ruleFiles = existsSync(rulesDir) ? readdirSync(rulesDir).filter((f) => f.endsWith(".mdc")).sort() : [];
  if (ruleFiles.length === 0) err("rules/", "no .mdc rules found");
  const titles = new Map();
  const ruleNames = [];
  let total = 0;
  let alwaysOn = 0;
  let alwaysBody = "";

  for (const f of ruleFiles) {
    const file = `rules/${f}`;
    const name = f.replace(/\.mdc$/, "");
    ruleNames.push(name);
    if (!/^(\d\d-)?[a-z0-9]+(-[a-z0-9]+)*\.mdc$/.test(f)) err(file, "file name must be kebab-case (optional 2-digit prefix)");
    const { frontmatter: meta, body } = fm(file, read(join(rulesDir, f)));
    if (!meta) {
      err(file, "missing frontmatter (--- description / globs / alwaysApply ---)");
      continue;
    }
    const keys = Object.keys(meta).sort().join(",");
    if (keys !== "alwaysApply,description,globs") err(file, `frontmatter keys must be exactly description, globs, alwaysApply (got ${keys})`);
    const d = meta.description ?? "";
    if (typeof d !== "string" || d.length < LIMITS.descMin || d.length > LIMITS.descMax)
      err(file, `description must be ${LIMITS.descMin}-${LIMITS.descMax} characters (got ${String(d).length})`);
    if (!isYamlSafePlain(d)) err(file, 'description must be plain text without ": ", " #" or a leading quote/symbol');
    if (meta.alwaysApply !== "true" && meta.alwaysApply !== "false") err(file, "alwaysApply must be true or false");
    const globs = (meta.globs ?? "").trim();
    if (meta.alwaysApply === "true") {
      alwaysOn++;
      alwaysBody = body;
      if (globs) err(file, "an alwaysApply rule must leave globs empty");
      if (body.length > LIMITS.alwaysOnBody) err(file, `always-on body is ${body.length} chars; keep it under ${LIMITS.alwaysOnBody}`);
    } else {
      if (!globs) err(file, "rules with alwaysApply: false need globs so tools can auto-attach them");
      for (const g of globs.split(",")) {
        if (!g) err(file, "empty glob in list (check for a trailing comma)");
        else if (/[\s"'{}]/.test(g)) err(file, `glob "${g}" must not contain spaces, quotes or braces (Cursor, Windsurf and Copilot read comma-separated globs)`);
      }
    }
    const { list: hs, fenceBalanced } = headings(body);
    if (!fenceBalanced) err(file, "unbalanced ``` code fence");
    const h1 = hs.filter((h) => h.startsWith("# "));
    if (h1.length !== 1 || !body.trimStart().startsWith("# ")) err(file, "body must start with exactly one # title");
    else if (titles.has(h1[0])) err(file, `duplicate title "${h1[0]}" (also in ${titles.get(h1[0])})`);
    else titles.set(h1[0], file);
    if (meta.alwaysApply === "false") {
      for (const s of ["## Do", "## Never"]) if (!hs.includes(s)) err(file, `missing "${s}" section`);
      if (!hs.some((h) => h.startsWith("## Example"))) err(file, 'missing "## Example..." section');
      if (!/```[a-z]+\n/.test(body)) err(file, "example needs a fenced code block with a language");
    }
    if (body.length > LIMITS.ruleBody) err(file, `body is ${body.length} chars; keep it under ${LIMITS.ruleBody}`);
    total += body.length;
  }
  if (ruleFiles.length) {
    if (alwaysOn !== 1) err("rules/", `exactly one alwaysApply: true rule expected (got ${alwaysOn})`);
    if (total > LIMITS.allBodies) err("rules/", `all rule bodies total ${total} chars; AGENTS.md budget is ${LIMITS.allBodies}`);
    for (const n of ruleNames) {
      const short = n.replace(/^\d\d-/, "");
      if (alwaysBody && !/^\d\d-/.test(n) && !alwaysBody.includes(`\`${short}\``))
        err("rules/", `always-on rule should point to topic rule \`${short}\``);
    }
  }

  // skills
  const skillDirs = existsSync(skillsDir) ? readdirSync(skillsDir).filter((d) => statSync(join(skillsDir, d)).isDirectory()).sort() : [];
  for (const dname of skillDirs) {
    const file = `skills/${dname}/SKILL.md`;
    const p = join(skillsDir, dname, "SKILL.md");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(dname) || dname.length > 64) err(`skills/${dname}`, "skill folder must be kebab-case, max 64 chars");
    if (!existsSync(p)) {
      err(file, "missing SKILL.md");
      continue;
    }
    const { frontmatter: meta, body } = fm(file, read(p));
    if (!meta) {
      err(file, "missing frontmatter");
      continue;
    }
    if (meta.name !== dname) err(file, `frontmatter name "${meta.name}" must equal folder name "${dname}"`);
    const d = meta.description ?? "";
    if (d.length < LIMITS.skillDescMin || d.length > LIMITS.skillDescMax) err(file, `description must be ${LIMITS.skillDescMin}-${LIMITS.skillDescMax} characters (got ${d.length})`);
    if (!isYamlSafePlain(d)) err(file, 'description must be plain text without ": ", " #" or a leading quote/symbol');
    if (!/\bUse when\b/.test(d)) err(file, 'description should say when to use it ("Use when ...")');
    if (meta.license !== "MIT") err(file, "license must be MIT");
    const { list: hs, fenceBalanced } = headings(body);
    if (!fenceBalanced) err(file, "unbalanced ``` code fence");
    for (const s of ["## When to use", "## Steps", "## Output format", "## Safety rules (always)"])
      if (!hs.includes(s)) err(file, `missing "${s}" section`);
  }

  // whole-repo text checks
  const textFiles = walk(root, (p) => /\.(md|mdc|sh|mjs|js|ts|json|ya?ml|sql)$/.test(p));
  for (const p of textFiles) {
    if (/scripts[\\/]lint-rules\.mjs$/.test(p)) continue; // holds the patterns themselves
    const text = read(p);
    for (const [re, label] of SECRETS) if (re.test(text)) err(rel(p), `secret-shaped string (${label}) - use a placeholder like sk_test_REPLACE_ME`);
    if (/\.(md|mdc)$/.test(p)) for (const [re, label] of BANNED) if (re.test(text)) err(rel(p), `banned claim "${label}"`);
  }
  return { rules: ruleFiles.length, skills: skillDirs.length, total };
}

export function lintInstalled(dir, root) {
  const rules = readdirSync(join(root, "rules")).filter((f) => f.endsWith(".mdc")).map((f) => f.replace(/\.mdc$/, ""));
  const skills = readdirSync(join(root, "skills")).filter((d) => existsSync(join(root, "skills", d, "SKILL.md")));
  const loaded = {};
  const check = (label, files, fn) => {
    loaded[label] = 0;
    for (const p of files) {
      const r = relative(dir, p);
      if (!existsSync(p)) {
        err(r, `missing (${label})`);
        continue;
      }
      const text = read(p);
      if (!text.includes(MARKER)) err(r, "missing installer marker");
      const parsed = fm(r, text);
      if (fn(r, parsed, text) !== false) loaded[label]++;
    }
  };
  check("cursor", rules.map((n) => join(dir, ".cursor/rules", `blitzhash-${n}.mdc`)), (r, { frontmatter: m }) => {
    if (!m || !("description" in m) || !("globs" in m) || !["true", "false"].includes(m.alwaysApply)) return err(r, "Cursor .mdc needs description, globs and alwaysApply"), false;
  });
  check("claude", rules.map((n) => join(dir, ".claude/rules", `blitzhash-${n}.md`)), (r, { frontmatter: m }) => {
    if (m === null) return; // loads at session start
    if (Object.keys(m).join() !== "paths" || !Array.isArray(m.paths) || m.paths.length === 0) return err(r, "Claude Code rule frontmatter must be a non-empty paths: list"), false;
  });
  check("windsurf", rules.map((n) => join(dir, ".windsurf/rules", `blitzhash-${n}.md`)), (r, { frontmatter: m }, text) => {
    if (!m || !["always_on", "glob", "model_decision", "manual"].includes(m.trigger)) return err(r, "Windsurf rule needs trigger: always_on | glob | model_decision | manual"), false;
    if (m.trigger === "glob" && !m.globs) return err(r, "trigger: glob needs globs"), false;
    if (!m.description) return err(r, "Windsurf rule needs a description"), false;
    if (text.length > 12000) return err(r, `Windsurf rules are capped at 12,000 characters (got ${text.length})`), false;
  });
  check("copilot", rules.map((n) => join(dir, ".github/instructions", `blitzhash-${n}.instructions.md`)), (r, { frontmatter: m }) => {
    if (!m || typeof m.applyTo !== "string" || !m.applyTo) return err(r, "Copilot instructions need applyTo"), false;
  });
  for (const [label, base] of [["cursor-skills", ".cursor/skills"], ["claude-skills", ".claude/skills"], ["codex-skills", ".agents/skills"]]) {
    check(label, skills.map((s) => join(dir, base, s, "SKILL.md")), (r, { frontmatter: m }) => {
      const want = basename(dirname(join(dir, r)));
      if (!m || m.name !== want || !m.description) return err(r, "SKILL.md needs name (= folder) and description"), false;
    });
  }
  const agents = join(dir, "AGENTS.md");
  loaded["agents-md"] = 0;
  if (!existsSync(agents)) err("AGENTS.md", "missing");
  else {
    const t = read(agents);
    const begins = t.split("<!-- BEGIN blitzhash-vibe-coding-rules").length - 1;
    const ends = t.split("<!-- END blitzhash-vibe-coding-rules -->").length - 1;
    if (begins !== 1 || ends !== 1) err("AGENTS.md", `expected one BEGIN/END block (got ${begins}/${ends})`);
    if (Buffer.byteLength(t) > 32768) err("AGENTS.md", "over Codex's default 32 KiB project doc limit");
    for (const n of rules) {
      const { body } = splitFrontmatter(read(join(root, "rules", `${n}.mdc`)));
      const h1 = body.trimStart().split("\n")[0].replace(/^# /, "### ");
      if (!t.includes(`\n${h1}\n`)) err("AGENTS.md", `missing section "${h1}"`);
      else loaded["agents-md"]++;
    }
  }
  return loaded;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
  const root = opt("--root") ?? join(here, "..");
  const installed = opt("--installed");
  if (installed) {
    const loaded = lintInstalled(installed, root);
    for (const [k, v] of Object.entries(loaded)) console.log(`  ${k.padEnd(14)} ${v} loaded`);
  } else {
    const r = lintPack(root);
    console.log(`Rules: ${r.rules}  Skills: ${r.skills}  Rule text: ${r.total} chars`);
  }
  for (const w of warnings) console.log(`warn  ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`FAIL  ${e}`);
    console.error(`\n${errors.length} problem(s).`);
    process.exit(1);
  }
  console.log(installed ? "OK: installed pack loads for every tool format." : "OK: frontmatter, sections, budgets, banned claims and secret scan passed.");
}
