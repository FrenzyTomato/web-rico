/**
 * TypeSafe Jev System One client (https://docs.typesafe.ai). Only Choice questions are used: comparisons
 * worked best as one Choice whose options carry code-computed facts (docs/BOT_STRATEGY.md "Prompt findings").
 */
export interface ChoiceQuestion { readonly type: 'choice'; readonly instructions: string; readonly criteria: Readonly<Record<string, string | null>> }
export interface ChoiceAnswer { readonly choice: string; readonly confidence: number; readonly probabilities: Readonly<Record<string, number>> }
export interface DecisionClient {
  ask(state: unknown, questions: Readonly<Record<string, ChoiceQuestion>>): Promise<Record<string, ChoiceAnswer>>;
}

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
/** A Choice accepts at most 255 options. */
export const MAX_OPTIONS = 255;

export class JevClient implements DecisionClient {
  constructor(private readonly apiKey: string, private readonly model = 'jev-1.14.0',
    private readonly timeoutMs = 5000, private readonly fetchImpl: typeof fetch = fetch) {}

  async ask(state: unknown, questions: Readonly<Record<string, ChoiceQuestion>>): Promise<Record<string, ChoiceAnswer>> {
    for (const [id, q] of Object.entries(questions)) {
      if (Object.keys(q.criteria).length > MAX_OPTIONS) throw new Error(`Question ${id} has more than ${MAX_OPTIONS} options`);
    }
    const body = JSON.stringify({ model: this.model, state, questions });
    // One retry for timeouts, rate limits and server errors; the caller falls back after that.
    for (let attempt = 0; ; attempt++) {
      const response = await this.fetchImpl(ENDPOINT, {
        method: 'POST', body, signal: AbortSignal.timeout(this.timeoutMs),
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      }).catch((e: unknown) => { if (attempt === 0) return null; throw e; });
      if (response?.ok) return (await response.json() as { answers: Record<string, ChoiceAnswer> }).answers;
      const retryable = !response || response.status === 429 || response.status >= 500;
      if (attempt > 0 || !retryable) throw new Error(`Jev request failed: ${response?.status ?? 'timeout'}`);
      const wait = Number(response?.headers.get('retry-after') ?? 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, Math.min(wait, 3000)));
    }
  }
}
