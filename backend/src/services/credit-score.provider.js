export class CreditScoreProvider {
  async getCreditScore() {
    throw new Error('CreditScoreProvider.getCreditScore must be implemented');
  }
}

export function createMockCreditScoreProvider({
  scores = {},
  defaultScore = 801,
} = {}) {
  return {
    async getCreditScore({ scenario = 'default', applicantId } = {}) {
      const score = scores[scenario] ?? scores[applicantId] ?? defaultScore;
      if (!Number.isInteger(score) || score < 300 || score > 900) {
        throw new Error('Mock credit score must be an integer between 300 and 900');
      }
      return { score, provider: 'mock', scenario };
    },
  };
}
