// Pure helpers for Roc signature help. No `vscode` import, so they can be tested with plain Node.

const OPEN = { "(": ")", "[": "]", "{": "}" };
const CLOSE = { ")": "(", "]": "[", "}": "{" };

// Look backwards from the end of `text` for the `(` of the call the cursor is inside.
// Returns { openIndex, commas } or null. `commas` = top-level commas typed so far.
function findCall(text) {
  const stack = [];
  let commas = 0;
  let inString = false;
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '"' && text[i - 1] !== "\\") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (CLOSE[ch]) {
      stack.push(CLOSE[ch]);
    } else if (OPEN[ch]) {
      if (stack.length === 0) {
        if (ch === "(") return { openIndex: i, commas };
        // Cursor is inside a record or list that is itself an argument:
        // its commas don't count, so keep looking outwards for the call.
        commas = 0;
        continue;
      }
      stack.pop();
    } else if (ch === "," && stack.length === 0) {
      commas++;
    }
  }
  return null;
}

// Find the function name right before the `(`, e.g. `List.sublist` or `xs.sublist`.
// Returns { nameStart, name, isMethodCall } or null.
function findCallee(text, openIndex) {
  const before = text.slice(0, openIndex);
  const match = before.match(/([A-Za-z_][\w]*\.)?([a-z_][\w]*!?)\s*$/);
  if (!match) return null;
  const qualifier = match[1] ? match[1].slice(0, -1) : null;
  const name = match[2];
  const nameStart = before.length - match[0].length + (match[1] ? match[1].length : 0);
  // `List.sublist(` is a plain call; `xs.sublist(` passes `xs` as the first argument.
  const isMethodCall = qualifier !== null && !/^[A-Z]/.test(qualifier);
  return { nameStart, name, isMethodCall };
}

// Pull the type signature and the docs out of the server's hover markdown.
function parseHover(markdown) {
  const blocks = [...markdown.matchAll(/```roc\n([\s\S]*?)```/g)];
  if (blocks.length === 0) return null;
  const signature = blocks[blocks.length - 1][1].trim();
  if (!signature.includes("->") && !signature.includes("=>")) return null;
  // Everything except the final signature block: the description plus any
  // ```roc examples, which VS Code now colours using the Roc grammar.
  const last = blocks[blocks.length - 1];
  const docs = (markdown.slice(0, last.index) + markdown.slice(last.index + last[0].length)).trim();
  return { signature, docs };
}

// Split the argument part of `A, B, C -> D` into [start, end] offsets of each argument.
function parameterRanges(signature) {
  const arrow = findTopLevel(signature, ["->", "=>"]);
  const argsPart = arrow === -1 ? signature : signature.slice(0, arrow);
  const ranges = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i <= argsPart.length; i++) {
    const ch = argsPart[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (i === argsPart.length || (ch === "," && depth === 0)) {
      let s = start;
      let e = i;
      while (s < e && argsPart[s] === " ") s++;
      while (e > s && argsPart[e - 1] === " ") e--;
      if (e > s) ranges.push([s, e]);
      start = i + 1;
    }
  }
  return ranges;
}

function findTopLevel(text, needles) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (depth === 0 && needles.some((n) => text.startsWith(n, i))) return i;
  }
  return -1;
}

module.exports = { findCall, findCallee, parseHover, parameterRanges };