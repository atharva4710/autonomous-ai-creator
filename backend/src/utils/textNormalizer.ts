/**
 * Dependency-free helper to normalize text.
 * - Lowercases the string.
 * - Replaces non-alphanumeric punctuation with spaces.
 * - Splits words and filters out common grammatical stopwords.
 * - Rejoins with a single whitespace.
 */
export function normalizeText(text: string): string {
  if (!text) return '';

  let normalized = text.toLowerCase();
  
  // Replace non-alphanumeric chars (excluding letters/numbers/spaces) with spaces
  normalized = normalized.replace(/[^\w\s]/g, ' ');

  // Split into words, trimming spaces
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);

  // Common stopwords to filter out
  const stopwords = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'but',
    'is',
    'are',
    'was',
    'were',
    'of',
    'to',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'about',
    'as',
    'that',
    'this',
  ]);

  const filteredWords = words.filter((w) => !stopwords.has(w));

  return filteredWords.join(' ');
}
