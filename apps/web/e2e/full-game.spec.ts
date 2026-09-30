import { expect, test } from '@playwright/test';
import { applyCommand, createGame } from '@vibe-rico/game-engine';
import type { CreateGameInput, GameCommand } from '@vibe-rico/game-engine';
import * as three from '../../../packages/game-engine/test/scenarios/fixtures/full-game-3p.js';
import * as four from '../../../packages/game-engine/test/scenarios/fixtures/full-game-4p.js';
import * as five from '../../../packages/game-engine/test/scenarios/fixtures/full-game-5p.js';
import { play, seatTable } from './table.js';

// TS-UI: the frozen PR-036 histories, played through the real UI by independent browser contexts.
for (const [name, fixture] of [['3p', three], ['4p', four], ['5p', five]] as const) {
  test(`${name}: every seat reaches game over with the same final scores; a mid-game refresh keeps the seat`, async ({ browser }) => {
    const input = fixture.input as unknown as CreateGameInput;
    const created = createGame(input);
    if (!created.ok) throw Error(created.error.message);
    const seats = input.seatOrder;
    const pages = await seatTable(browser, seats, { seed: input.seed, governor: seats.indexOf(input.governorPlayerId) });
    const page = (id: string) => pages[seats.indexOf(id as never)]!;
    let state = created.state;
    const refreshAt = Math.floor(fixture.commands.length / 2);
    for (const [k, raw] of fixture.commands.entries()) {
      const command = raw as GameCommand;
      if (k === refreshAt) {
        // Refresh the next actor: the saved seat resumes and the game continues without a duplicate action.
        await page(command.actorId).reload();
        await expect(page(command.actorId).getByText(`${command.actorId}（你）`, { exact: false }).first()).toBeVisible();
      }
      await play(page(command.actorId), state, command);
      const result = applyCommand(state, command);
      if (!result.ok) throw Error(result.error.message);
      state = result.state;
    }
    if (state.phase.kind !== 'game-over') throw Error('fixture did not end');
    const expected = [...state.phase.scores].sort((a, b) => a.rank - b.rank).map(s => [String(s.rank), s.playerId, String(s.totalVp)]);
    for (const p of pages) {
      await expect(p.locator(`[data-revision="${state.revision}"]`)).toBeVisible();
      const rows = p.getByRole('table', { name: '最终计分' }).locator('tbody tr');
      await expect(rows).toHaveCount(seats.length);
      const cells = await rows.evaluateAll(trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent)));
      expect(cells.map(c => [c[0], c[1], c[9]])).toEqual(expected);
    }
  });
}
