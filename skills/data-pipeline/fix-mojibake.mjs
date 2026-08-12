/**
 * Repairs UTF-8 that was read as CP1252 and re-saved as UTF-8.
 *
 * Windows PowerShell 5.1's `Get-Content -Raw | Set-Content -Encoding utf8`
 * round trip mangles every non-ASCII character this way: an accented letter
 * turns into a two-character run beginning with a capital A-tilde, and an em
 * dash into a three-character run beginning with a lowercase a-circumflex.
 * (Examples are described rather than written out, because this file is itself
 * in scope for the repair.)
 *
 *   node skills/data-pipeline/fix-mojibake.mjs [--dry]
 *
 * Repair is per-sequence rather than per-file, because a file can hold both
 * mangled text and correctly-encoded text written later by a different tool.
 * Each candidate run is mapped back to bytes through the CP1252 table and
 * re-decoded as UTF-8; if that does not produce valid UTF-8 the run is left
 * alone, so correctly-encoded characters are never touched.
 *
 * Kept in the repo because the trap is easy to fall into again. **Prefer Node
 * or an editor over PowerShell for scripted rewrites of source files.**
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DRY = process.argv.includes('--dry');

const TARGET_DIRS = ['src', 'skills', 'creative'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.md', '.mjs', '.json', '.html']);

/** CP1252's 0x80-0x9F block, which differs from Latin-1. Everything else is identity. */
const CP1252_HIGH = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

const toByte = (ch) => {
  const code = ch.charCodeAt(0);
  if (code <= 0xff) return code;
  return CP1252_HIGH[code] ?? null;
};

/**
 * A mangled character always begins with a UTF-8 lead byte rendered as a
 * Latin-1 letter (Â-ß range) and is followed by one or two continuation bytes.
 */
const CANDIDATE = /[Â-ßà-ï][-ÿŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]{1,2}/g;

function repair(text) {
  return text.replace(CANDIDATE, (run) => {
    const bytes = [];
    for (const ch of run) {
      const b = toByte(ch);
      if (b === null) return run;
      bytes.push(b);
    }
    const decoded = Buffer.from(bytes).toString('utf8');
    // A failed decode yields U+FFFD; anything that still looks mangled is left.
    if (decoded.includes('�') || decoded.length >= run.length) return run;
    return decoded;
  });
}

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(path.extname(entry.name))) yield full;
  }
}

let repaired = 0;
for (const dir of TARGET_DIRS) {
  for await (const file of walk(path.join(ROOT, dir))) {
    const text = await fs.readFile(file, 'utf8');
    const fixed = repair(text);
    if (fixed === text) continue;

    const changes = [...text].reduce((n, c, i) => n + (c !== fixed[i] ? 1 : 0), 0);
    console.log(`  ✔ ${path.relative(ROOT, file)}  (${changes} chars)`);
    if (!DRY) await fs.writeFile(file, fixed, 'utf8');
    repaired++;
  }
}

console.log(`\n  ${repaired} file(s) repaired.${DRY ? ' (dry run)' : ''}\n`);
