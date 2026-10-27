import { describe, expect, it } from 'vitest';
import { createTutorialController } from './controller.js';
import { describeMove, tutorialCopy } from './copy.js';

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
      }
      if (s.stage === 'opponent') s.opponentMove(s.generation, s.index);
      else if (s.stage === 'opponent-result') s.next(s.generation, s.index);
      else expect(s.submit(s.generation, s.step!.id, s.snapshot!.revision, s.step!.action)).toBe(true);
    }
    expect(c.getState().stage).toBe('finished');
  });
});
