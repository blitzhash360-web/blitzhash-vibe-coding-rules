import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { slug, extract } from "../scripts/check-links.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (...a) => spawnSync(process.execPath, [join(root, "scripts/check-links.mjs"), ...a], { encoding: "utf8" });

test("GitHub-style slugs", () => {
  assert.equal(slug("Going to production? What this doesn't cover"), "going-to-production-what-this-doesnt-cover");
  assert.equal(slug("Quick start (3 steps)"), "quick-start-3-steps");
  assert.equal(slug("`install.sh` options"), "installsh-options");
});

test("extract skips code fences and inline code", () => {
  const { links, anchors } = extract("# Title\n\n[a](x.md) `[b](y.md)`\n\n```md\n[c](z.md)\n```\n<https://example.com>\n");
  assert.deepEqual(links.map((l) => l.url), ["x.md", "https://example.com"]);
  assert.ok(anchors.has("title"));
});

test("repo has no broken relative links or anchors", () => {
  const r = run();
  assert.equal(r.status, 0, r.stderr);
});

test("broken file and anchor links fail", () => {
  const d = mkdtempSync(join(tmpdir(), "bhvcr-links-"));
  mkdirSync(join(d, "docs"));
  writeFileSync(join(d, "docs/ok.md"), "# Real heading\n");
  writeFileSync(join(d, "README.md"), "[ok](docs/ok.md#real-heading) [gone](docs/missing.md) [bad](docs/ok.md#nope)\n");
  const r = run("--root", d);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /missing file: docs\/missing\.md/);
  assert.match(r.stderr, /missing anchor #nope/);
  assert.doesNotMatch(r.stderr, /real-heading/);
});
