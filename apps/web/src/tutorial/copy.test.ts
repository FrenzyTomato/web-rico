import { describe, expect, it } from 'vitest';
import { createTutorialController } from './controller.js';
import { describeMove, introPages, islandCheck, tutorialCopy } from './copy.js';
import { explainPages } from './rolePages.js';
import type { GuidePage } from './rolePages.js';
import { learner } from './scenario.js';

describe('tutorial guide copy', () => {
  it('explains every move and its follow-up in both languages', () => {
    const c = createTutorialController();
    for (let i = 0; i < 200 && c.getState().stage !== 'finished'; i++) {
      const s = c.getState();
      for (const language of ['en', 'zh'] as const) {
        const copy = tutorialCopy(s.step!, s.snapshot!.view, language);
        expect(copy.title).not.toBe('');
        expect(s.stage === 'action' ? copy.todo : copy.preview).not.toBe('');
        if (s.previous) expect(describeMove(s.previous, s.snapshot!.view, language)).not.toBe('');
        // English pages carry no Chinese characters, full-width punctuation or curly quotes (drawn full width by the Chinese font).
        if (language === 'en') expect([copy.title, copy.todo, copy.preview, s.previous ? describeMove(s.previous, s.snapshot!.view, language) : ''].join(' '))
          .not.toMatch(/[\p{Script=Han}\u3000-\u303f\uff00-\uffef“”]/u);
      }
      if (s.stage === 'intro') { s.begin(s.generation); continue; }
      if (s.stage === 'opponent') s.opponentMove(s.generation, s.index);
      else if (s.stage === 'opponent-result' || s.stage === 'result') {
        if (s.stage === 'result' && s.previous!.step.action.kind !== 'choose-role') expect(islandCheck(s.previous!, s.snapshot!.view, 'en')).toMatch(/^Check your island/);
        s.next(s.generation, s.index);
      }
      else expect(s.submit(s.generation, s.step!.id, s.snapshot!.revision, s.step!.action)).toBe(true);
    }
    expect(c.getState().stage).toBe('finished');
  });
  it('pauses to explain each role pick, the refills, production, the blocked sale, the build maths and the ships', () => {
    const c = createTutorialController();
    const pauses: string[] = [];
    const flat = (page: GuidePage) => page.paragraphs.map(p => typeof p === 'string' ? p : p.text).join(' ');
    for (let i = 0; i < 300 && c.getState().stage !== 'finished'; i++) {
      const s = c.getState();
      for (const language of ['en', 'zh'] as const) {
        const pages = explainPages(s, language);
        if (!pages) continue;
        expect(pages.every(p => p.title && p.paragraphs.length > 0)).toBe(true);
        if (language === 'zh') continue;
        expect(pages.map(p => `${p.title} ${flat(p)}`).join(' ')).not.toMatch(/[\p{Script=Han}\u3000-\u303f\uff00-\uffef“”]/u);
        pauses.push(`R${s.snapshot!.view.roundNumber} ${pages.map(p => `${p.title}${p.diagram ? ` [${p.diagram.kind}]` : ''}`).join(' / ')} | ${flat(pages.at(-1)!).split('. ').at(-1)}`);
      }
      if (s.stage === 'intro') s.begin(s.generation);
      else if (s.stage === 'opponent') s.opponentMove(s.generation, s.index);
      else if (s.stage === 'opponent-result' || s.stage === 'result') s.next(s.generation, s.index);
      else s.submit(s.generation, s.step!.id, s.snapshot!.revision, s.step!.action);
    }
    expect(c.getState().stage).toBe('finished');
    expect(pauses).toMatchInlineSnapshot(`
      [
        "R1 You chose Planter / Planter: quarries [price] | You go first, so it's your turn to take your quarry.",
        "R1 Bruno chose Builder [price] | Then it's your turn to build.",
        "R1 Bruno built Small Fruit Depot [price] | Everyone else builds at full price, less their own staffed quarries.",
        "R1 You built Small Fruit Depot [chain] | Your quarry has no worker yet, so it didn't lower the price.",
        "R1 Chen chose Recruiter [recruit] / Recruiter: placing workers | Then it's your turn to place your workers.",
        "R2 Refilling the hiring pool [refill] / When workers run out [supply] | If the supply ever can't fill the hiring pool, the game ends once that Recruiter turn is over.",
        "R2 Bruno chose Recruiter [recruit] | Then it's your turn to place your workers.",
        "R2 Chen chose Craftsman [chain] / Craftsman: what gets made [produce] | Then it's your turn to produce goods.",
        "R2 You chose Trader [house] / Trader: one of each kind | You go first, so it's your turn to sell a good.",
        "R2 Bruno can't sell Bananas [house] | So Bruno passes and keeps the goods to ship for points later.",
        "R3 Chen chose Recruiter [recruit] | Then it's your turn to place your workers.",
        "R3 You chose Builder [price] | You go first, so it's your turn to build.",
        "R3 You built Small Warehouse [price] | Its worker slot is empty, so it does nothing yet.",
        "R3 Bruno chose Craftsman [produce] | Then it's your turn to produce goods.",
        "R4 You chose Captain [ships] / Captain: which ship / Captain: after shipping | You go first, so it's your turn to ship goods.",
        "R4 Loading is done [ships] | Full ships are emptied after the Captain turn; a ship that isn't full keeps its cargo, so its kind stays locked to it.",
      ]
    `);
  });
  it('opens with the table, the learner’s island, where to look and the round flow', () => {
    for (const language of ['en', 'zh'] as const) {
      const pages = introPages(language);
      expect(pages.map(p => p.camera)).toEqual(['overview', 'mine', 'shared', 'shared']);
      for (const p of pages) expect(p.body.join(' ').length).toBeGreaterThan(40);
      if (language === 'en') expect(pages.map(p => [p.title, ...p.body].join(' ')).join(' ')).not.toMatch(/[\p{Script=Han}\u3000-\u303f\uff00-\uffef“”]/u);
    }
  });
});
