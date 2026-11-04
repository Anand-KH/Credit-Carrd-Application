import { randomInt } from 'node:crypto';

export const MIN_MOCK_CREDIT_SCORE = 300;
export const MAX_MOCK_CREDIT_SCORE = 900;

export class CreditScoreProvider {
  async getCreditScore() {
    throw new Error('CreditScoreProvider.getCreditScore must be implemented');
  }
}

export function createMockCreditScoreProvider({ scoreGenerator = randomInt } = {}) {
  return {
    async getCreditScore() {
      const score = scoreGenerator(MIN_MOCK_CREDIT_SCORE, MAX_MOCK_CREDIT_SCORE + 1);
      if (!Number.isInteger(score) || score < MIN_MOCK_CREDIT_SCORE || score > MAX_MOCK_CREDIT_SCORE) {
        throw new Error('Mock credit score must be an integer between 300 and 900');
      }
      return { score, provider: 'mock' };
    },
  };
}
