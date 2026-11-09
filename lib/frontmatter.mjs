// Minimal, dependency-free frontmatter reader for the subset of YAML this pack uses:
// `key: value`, `key: "quoted"`, `key:` + indented `- "item"` lists, and one level of nested `key: value` maps.

export function splitFrontmatter(text) {
  const src = text.replace(/\r\n/g, "\n");
  if (!src.startsWith("---\n")) return { frontmatter: null, raw: null, body: src };
  const end = src.indexOf("\n---\n", 3);
  const endAtEof = src.endsWith("\n---") ? src.length - 4 : -1;
  const stop = end !== -1 ? end : endAtEof;
  if (stop === -1) throw new Error("frontmatter opened with --- but never closed");
  const raw = src.slice(4, stop + 1);
  const body = src.slice(stop + 5);
  return { frontmatter: parseSubset(raw), raw, body };
}

function scalar(v, lineNo) {
  const t = v.trim();
  if (t.startsWith('"')) {
    try {
      return JSON.parse(t);
    } catch {
      throw new Error(`line ${lineNo}: invalid double-quoted string`);
    }
  }
  if (t.startsWith("'")) {
    if (!t.endsWith("'") || t.length < 2) throw new Error(`line ${lineNo}: unterminated single-quoted string`);
    return t.slice(1, -1).replace(/''/g, "'");
  }
  return t;
}

export function parseSubset(raw) {
  const out = {};
  const lines = raw.split("\n");
  let current = null;
  lines.forEach((line, i) => {
    const n = i + 1;
    if (!line.trim() || line.trim().startsWith("#")) return;
    const top = /^([A-Za-z_][\w-]*):(?:\s(.*)|)$/.exec(line);
    if (top) {
      const [, key, value = ""] = top;
      if (key in out) throw new Error(`line ${n}: duplicate key "${key}"`);
      if (value.trim() === "") {
        out[key] = null;
        current = key;
      } else {
        out[key] = scalar(value, n);
        current = null;
      }
      return;
    }
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && current) {
      if (out[current] === null) out[current] = [];
      if (!Array.isArray(out[current])) throw new Error(`line ${n}: mixed list and map under "${current}"`);
      out[current].push(scalar(item[1], n));
      return;
    }
    const nested = /^\s+([A-Za-z_][\w-]*):\s(.*)$/.exec(line);
    if (nested && current) {
      if (out[current] === null) out[current] = {};
      if (Array.isArray(out[current])) throw new Error(`line ${n}: mixed list and map under "${current}"`);
      out[current][nested[1]] = scalar(nested[2], n);
      return;
    }
    throw new Error(`line ${n}: cannot parse "${line}"`);
  });
  for (const k of Object.keys(out)) if (out[k] === null) out[k] = "";
  return out;
}

// A plain (unquoted) YAML scalar that real YAML parsers read back as the same string.
export function isYamlSafePlain(v) {
  if (v === "") return true;
  if (/^[\s*&!{}[\]|>'"%@`#,?:-]/.test(v)) return false;
  if (/:\s|\s#/.test(v)) return false;
  return !/\s$/.test(v);
}
