#!/usr/bin/env node
// Thin terminal host for the pure headless controls in src/cli.ts; all game logic stays in the engine.
import { createInterface } from 'node:readline';
import { RULESET, runCliLine, startCli } from '../dist/index.js';

const [seed, ...seatOrder] = process.argv.slice(2);
const start = startCli({ rulesetId: RULESET.id, gameId: 'cli', seatOrder, governorPlayerId: seatOrder[0], seed: Number(seed) });
console.log(start.output);
if (!start.session) {
  console.log('usage: cli <seed> <player> <player> <player> [<player> <player>]  (first player is Governor)');
  process.exit(1);
}
let session = start.session;
for await (const line of createInterface({ input: process.stdin })) {
  const result = runCliLine(session, line);
  session = result.session;
  console.log(result.output);
}
