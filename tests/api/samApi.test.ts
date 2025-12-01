import { enforceConciseText } from '../../src/server/services/samAPI';

describe('enforceConciseText', () => {
  it('returns the original text when already concise', () => {
    const input = 'Connect now with Jamie? I can queue a call if you say yes.';
    const result = enforceConciseText(input);
    expect(result).toBe(input);
  });

  it('limits the response to two sentences', () => {
    const input =
      'First sentence is the recommendation. Second sentence explains why. Third sentence is filler that should be removed.';
    const result = enforceConciseText(input);
    expect(result).toBe('First sentence is the recommendation. Second sentence explains why.');
  });

  it('caps the total word count and appends an ellipsis', () => {
    const filler = Array.from({ length: 90 }, (_, index) => `word${index + 1}`).join(' ');
    const input = `Here is what to do. ${filler}.`;
    const result = enforceConciseText(input);
    const words = result.split(/\s+/);

    expect(words.length).toBeLessThanOrEqual(60);
    expect(result.endsWith('...')).toBe(true);
  });
});
