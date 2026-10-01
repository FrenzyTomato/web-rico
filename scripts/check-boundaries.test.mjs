// node --test: the lint must catch each prohibited pattern and accept the real engine source.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkBoundaries } from './check-boundaries.mjs';

test('the real engine source passes', () => assert.deepEqual(checkBoundaries('packages/game-engine/src'), []));

for (const [name, source] of [
  ['network import', "import { createServer } from 'node:http';"],
  ['UI import', "import { useState } from 'react';"],
  ['socket import', "import { Server } from 'socket.io';"],
  ['dynamic import', "const fs = await import('fs');"],
  ['Math.random', 'const roll = Math.random();'],
  ['system time', 'const t = Date.now();'],
]) {
  test(`detects a prohibited ${name}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'engine-'));
    writeFileSync(join(dir, 'bad.ts'), `import { ok } from './ok.js';\n${source}\n`);
    assert.equal(checkBoundaries(dir).length, 1);
  });
}
