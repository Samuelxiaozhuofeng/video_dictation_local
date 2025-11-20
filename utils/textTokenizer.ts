/**
 * Text Tokenizer Utility
 * Separates text into words and punctuation tokens for practice input
 */

export enum TokenType {
  WORD = 'WORD',
  PUNCTUATION = 'PUNCTUATION',
  SPACE = 'SPACE'
}

export interface Token {
  type: TokenType;
  value: string;
  index: number; // Position in the token array
}

/**
 * Tokenize text into words, punctuation, and spaces
 * Words need to be typed by user, punctuation is displayed automatically
 * Supports Unicode characters (Spanish ñ, ó, á, etc., Chinese, Arabic, etc.)
 */
export const tokenizeText = (text: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;

  // Regex to match words with Unicode letter support
  // \p{L} matches any Unicode letter (including ñ, ó, á, é, í, ú, ü, etc.)
  // \p{N} matches any Unicode number
  // Supports apostrophes within words (e.g., don't, it's)
  const pattern = /([\p{L}\p{N}]+(?:'[\p{L}]+)?)|([^\p{L}\p{N}\s])|(\s+)/gu;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match[1]) {
      // Word token (includes Unicode letters and numbers)
      tokens.push({
        type: TokenType.WORD,
        value: match[1],
        index: index++
      });
    } else if (match[2]) {
      // Punctuation token (anything that's not a letter, number, or space)
      tokens.push({
        type: TokenType.PUNCTUATION,
        value: match[2],
        index: index++
      });
    } else if (match[3]) {
      // Space token
      tokens.push({
        type: TokenType.SPACE,
        value: match[3],
        index: index++
      });
    }
  }

  return tokens;
};

/**
 * Get only word tokens (for input fields)
 */
export const getWordTokens = (tokens: Token[]): Token[] => {
  return tokens.filter(t => t.type === TokenType.WORD);
};

/**
 * Check if input matches target (case-insensitive)
 */
export const isInputCorrect = (input: string, target: string): boolean => {
  return input.trim().toLowerCase() === target.trim().toLowerCase();
};

/**
 * Reconstruct full text from tokens and user inputs
 * @param tokens - All tokens (words, punctuation, spaces)
 * @param wordInputs - User inputs for word tokens only
 */
export const reconstructText = (tokens: Token[], wordInputs: string[]): string => {
  let wordIndex = 0;
  return tokens.map(token => {
    if (token.type === TokenType.WORD) {
      return wordInputs[wordIndex++] || '';
    }
    return token.value;
  }).join('');
};

/**
 * Check if all words are correctly filled
 */
export const areAllWordsCorrect = (tokens: Token[], wordInputs: string[]): boolean => {
  const wordTokens = getWordTokens(tokens);
  
  if (wordInputs.length !== wordTokens.length) {
    return false;
  }
  
  return wordTokens.every((token, index) => {
    const input = wordInputs[index];
    return input && isInputCorrect(input, token.value);
  });
};

