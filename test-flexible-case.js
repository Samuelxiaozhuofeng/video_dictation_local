/**
 * Test script for flexible case matching
 * Run with: node test-flexible-case.js
 */

// Mock the tokenizer logic for testing
const TokenType = {
  WORD: 'WORD',
  PUNCTUATION: 'PUNCTUATION',
  SPACE: 'SPACE'
};

const isInputCorrectFlexibleCase = (input, target) => {
  const trimmedInput = input.trim();
  const trimmedTarget = target.trim();
  
  if (trimmedInput.length !== trimmedTarget.length) {
    return false;
  }
  
  if (trimmedInput.length === 0) {
    return false;
  }
  
  // Compare first letter (case-insensitive)
  if (trimmedInput[0].toLowerCase() !== trimmedTarget[0].toLowerCase()) {
    return false;
  }
  
  // Compare rest of the word (case-sensitive)
  if (trimmedInput.length > 1) {
    return trimmedInput.slice(1) === trimmedTarget.slice(1);
  }
  
  return true;
};

const tokenizeText = (text) => {
  const tokens = [];
  let index = 0;
  
  const pattern = /([\p{L}\p{N}]+(?:'[\p{L}]+)?)|([^\p{L}\p{N}\s])|(\s+)/gu;
  
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match[1]) {
      tokens.push({
        type: TokenType.WORD,
        value: match[1],
        index: index++
      });
    } else if (match[2]) {
      tokens.push({
        type: TokenType.PUNCTUATION,
        value: match[2],
        index: index++
      });
    } else if (match[3]) {
      tokens.push({
        type: TokenType.SPACE,
        value: match[3],
        index: index++
      });
    }
  }
  
  return tokens;
};

const getWordTokens = (tokens) => {
  return tokens.filter(t => t.type === TokenType.WORD);
};

console.log("🧪 Testing Flexible Case Matching\n");
console.log("=".repeat(70));

// Test cases based on the user's example
const testCases = [
  {
    name: "Exact match",
    input: "Oigan",
    target: "Oigan",
    expected: true
  },
  {
    name: "First letter different case (should pass)",
    input: "Miren",
    target: "miren",
    expected: true
  },
  {
    name: "First letter different case reversed (should pass)",
    input: "miren",
    target: "Miren",
    expected: true
  },
  {
    name: "Rest of word different case (should fail)",
    input: "mirEn",
    target: "miren",
    expected: false
  },
  {
    name: "Correct word",
    input: "aquí",
    target: "aquí",
    expected: true
  },
  {
    name: "Wrong word",
    input: "dicen",
    target: "dice",
    expected: false
  },
  {
    name: "Different length",
    input: "entrada",
    target: "entrad",
    expected: false
  }
];

let passed = 0;
let failed = 0;

testCases.forEach((testCase, i) => {
  console.log(`\nTest ${i + 1}: ${testCase.name}`);
  console.log(`Input:    "${testCase.input}"`);
  console.log(`Target:   "${testCase.target}"`);
  console.log(`Expected: ${testCase.expected}`);
  
  const result = isInputCorrectFlexibleCase(testCase.input, testCase.target);
  console.log(`Result:   ${result}`);
  
  if (result === testCase.expected) {
    console.log("✅ PASSED");
    passed++;
  } else {
    console.log("❌ FAILED");
    failed++;
  }
});

console.log("\n" + "=".repeat(70));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

// Test the full sentence from the user's example
console.log("\n" + "=".repeat(70));
console.log("\n🎯 Testing User's Example:");
console.log('Original: "Oigan, miren aquí en la entrada dice que los tacos,"');
console.log('User:     "Oigan Miren aquí en la entrada dicen que los tacos"');

const originalText = "Oigan, miren aquí en la entrada dice que los tacos,";
const userInputWords = ["Oigan", "Miren", "aquí", "en", "la", "entrada", "dicen", "que", "los", "tacos"];

const tokens = tokenizeText(originalText);
const wordTokens = getWordTokens(tokens);

console.log("\nWord-by-word comparison:");
wordTokens.forEach((token, i) => {
  const userWord = userInputWords[i] || '';
  const isCorrect = isInputCorrectFlexibleCase(userWord, token.value);
  const status = isCorrect ? '✅' : '❌';
  console.log(`${status} Target: "${token.value}" | User: "${userWord}" | ${isCorrect ? 'CORRECT' : 'WRONG'}`);
});

if (failed === 0) {
  console.log("\n🎉 All tests passed! Flexible case matching is working correctly.");
} else {
  console.log("\n⚠️  Some tests failed. Please review the implementation.");
}

