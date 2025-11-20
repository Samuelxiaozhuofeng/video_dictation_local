/**
 * Simple test script for the tokenizer
 * Run with: node test-tokenizer.js
 */

// Mock the tokenizer logic for testing
const TokenType = {
  WORD: 'WORD',
  PUNCTUATION: 'PUNCTUATION',
  SPACE: 'SPACE'
};

const tokenizeText = (text) => {
  const tokens = [];
  let index = 0;
  
  // Unicode-aware regex pattern
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

// Test cases
const testCases = [
  {
    name: "Spanish with ñ",
    text: "El niño está en España.",
    expected: ["El", "niño", "está", "en", "España"]
  },
  {
    name: "Spanish with accents",
    text: "¿Cómo estás? ¡Muy bien!",
    expected: ["Cómo", "estás", "Muy", "bien"]
  },
  {
    name: "Spanish names",
    text: "José y María están en Bogotá.",
    expected: ["José", "y", "María", "están", "en", "Bogotá"]
  },
  {
    name: "Spanish question",
    text: "¿Dónde está la señorita Martínez?",
    expected: ["Dónde", "está", "la", "señorita", "Martínez"]
  },
  {
    name: "English with contractions",
    text: "Don't worry, it's okay!",
    expected: ["Don't", "worry", "it's", "okay"]
  },
  {
    name: "Mixed punctuation",
    text: "Hello, world! How are you?",
    expected: ["Hello", "world", "How", "are", "you"]
  }
];

console.log("🧪 Testing Tokenizer with Unicode Support\n");
console.log("=".repeat(60));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, i) => {
  console.log(`\nTest ${i + 1}: ${testCase.name}`);
  console.log(`Input: "${testCase.text}"`);
  
  const tokens = tokenizeText(testCase.text);
  const words = tokens.filter(t => t.type === TokenType.WORD).map(t => t.value);
  
  console.log(`Expected words: [${testCase.expected.join(', ')}]`);
  console.log(`Actual words:   [${words.join(', ')}]`);
  
  const isCorrect = JSON.stringify(words) === JSON.stringify(testCase.expected);
  
  if (isCorrect) {
    console.log("✅ PASSED");
    passed++;
  } else {
    console.log("❌ FAILED");
    failed++;
  }
  
  // Show all tokens for debugging
  console.log("All tokens:");
  tokens.forEach(token => {
    const typeSymbol = token.type === TokenType.WORD ? '📝' : 
                       token.type === TokenType.PUNCTUATION ? '🔣' : '⎵';
    console.log(`  ${typeSymbol} ${token.type.padEnd(12)} "${token.value}"`);
  });
});

console.log("\n" + "=".repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
  console.log("🎉 All tests passed! Unicode support is working correctly.");
} else {
  console.log("⚠️  Some tests failed. Please review the implementation.");
}

