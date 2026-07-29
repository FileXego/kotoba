/**
 * Aho-Corasick multi-pattern string matcher.
 * Builds a trie, then scans text in O(n + matches).
 * 0 dependencies.
 */
import { fileURLToPath } from "node:url";

interface TrieNode {
  children: Map<string, TrieNode>;
  fail: TrieNode | null;
  output: string[];
}

function node(): TrieNode {
  return { children: new Map(), fail: null, output: [] };
}

export class AhoCorasick {
  private root: TrieNode;

  constructor(words: string[]) {
    this.root = node();
    for (const w of words) {
      const s = w.trim();
      if (!s) continue;
      let n = this.root;
      for (const ch of s) {
        if (!n.children.has(ch)) n.children.set(ch, node());
        n = n.children.get(ch)!;
      }
      n.output.push(s);
    }

    const q: TrieNode[] = [];
    for (const c of this.root.children.values()) { c.fail = this.root; q.push(c); }
    while (q.length) {
      const cur = q.shift()!;
      for (const [ch, child] of cur.children) {
        q.push(child);
        let f = cur.fail;
        while (f && !f.children.has(ch)) f = f.fail;
        child.fail = f ? (f.children.get(ch) ?? this.root) : this.root;
        child.output.push(...(child.fail?.output ?? []));
      }
    }
  }

  /** Returns true if any banned word appears in text */
  containsAny(text: string): boolean {
    let n: TrieNode | null = this.root;
    for (const ch of text) {
      while (n && !n.children.has(ch)) n = n.fail;
      if (!n) { n = this.root; continue; }
      n = n.children.get(ch)!;
      if (n.output.length > 0) return true;
    }
    return false;
  }

  /** Returns all matched banned words (deduplicated) */
  search(text: string): string[] {
    const found = new Set<string>();
    let n: TrieNode | null = this.root;
    for (const ch of text) {
      while (n && !n.children.has(ch)) n = n.fail;
      if (!n) { n = this.root; continue; }
      n = n.children.get(ch)!;
      for (const w of n.output) found.add(w);
    }
    return [...found];
  }
}

// ── Singleton ──
let _ac: AhoCorasick | null = null;

const isProd = import.meta.env.NODE_ENV === "production";

/** Load banned words from file. Call once at startup. */
export async function loadBannedWords(path?: string): Promise<AhoCorasick> {
  if (_ac) return _ac;
  const resolvedPath = path ?? fileURLToPath(new URL("../../banned.txt", import.meta.url));
  try {
    const raw = await Bun.file(resolvedPath).text();
    const words = raw
      .split(/\r?\n/)
      .map((word) => word.trim())
      .filter((word) => word !== "" && !word.startsWith("#"));
    _ac = new AhoCorasick(words);
  } catch (e) {
    if (isProd) {
      console.error("banned.txt not found or unreadable:", e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
    console.warn("banned.txt not found — moderation filter disabled");
    _ac = new AhoCorasick([]);
  }
  return _ac;
}

/** Get the singleton (must call loadBannedWords first) */
export function getBannedFilter(): AhoCorasick {
  return _ac ?? new AhoCorasick([]);
}
