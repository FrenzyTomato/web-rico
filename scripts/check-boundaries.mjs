// Engine boundary lint (ARCHITECTURE "Build dependencies"; IMPLEMENTATION_PLAN "Global Constraints"):
// engine source imports only its own relative modules (no frameworks, network or IO), and neither
// Math.random() nor system time may drive rules. Usage: node scripts/check-boundaries.mjs [engine-src-dir]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RULES = [
  { pattern: /\bfrom\s+['"](?!\.)[^'"]+['"]|\bimport\s*\(\s*['"](?!\.)|\brequire\s*\(/, message: 'non-relative import (frameworks, network and IO are not allowed in the engine)' },
  { pattern: /\bMath\.random\s*\(/, message: 'Math.random() (use the seeded RNG)' },
  { pattern: /\bDate\.now\s*\(|\bnew Date\s*\(|\bperformance\.now\s*\(/, message: 'system time (rules must be deterministic)' },
];

export function checkBoundaries(dir) {
  const problems = [];
  const walk = d => {
    for (const name of readdirSync(d)) {
      const path = join(d, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (path.endsWith('.ts')) {
        readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
          for (const rule of RULES) if (rule.pattern.test(line)) problems.push(`${relative(process.cwd(), path)}:${i + 1}: ${rule.message}`);
        });
      }
    }
  };
  walk(dir);
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = checkBoundaries(process.argv[2] ?? 'packages/game-engine/src');
  for (const p of problems) console.error(p);
  if (problems.length) process.exit(1);
  console.log('engine boundaries ok');
}
