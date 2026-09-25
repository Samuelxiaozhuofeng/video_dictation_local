// Set phrases the word splitter would cut into misleading pieces (初めまして →
// 初め「开始」+ まして「何况」). Each is kept as one group, and a click looks up
// the value: Youdao's headword for it (checked against its Japanese-Chinese
// dictionary, 2026-09-25). Only phrases Youdao has an entry for are listed.
export const JA_PHRASES: Record<string, string> = {
  // greetings
  初めまして: '初めまして',
  よろしくお願いします: 'よろしくお願いします',
  よろしくお願いいたします: 'よろしくお願いします',
  お願いします: 'お願いします',
  ありがとうございます: 'ありがとうございます',
  ありがとうございました: 'ありがとうございます',
  すみません: 'すみません',
  ごめんなさい: 'ごめんなさい',
  おはようございます: 'おはようございます',
  こんにちは: 'こんにちは',
  こんばんは: 'こんばんは',
  さようなら: 'さようなら',
  お疲れ様です: 'お疲れ様',
  お疲れ様でした: 'お疲れ様でした',
  お疲れさまです: 'お疲れさま',
  お疲れさまでした: 'お疲れ様でした',
  ごちそうさまでした: 'ご馳走様',
  ごちそうさま: 'ご馳走様',
  失礼します: '失礼します',
  失礼しました: '失礼します',
  お邪魔します: 'お邪魔します',
  行ってらっしゃい: '行ってらっしゃい',
  お帰りなさい: 'お帰りなさい',
  おかえりなさい: 'お帰りなさい',
  お久しぶりです: 'お久しぶりです',
  どういたしまして: 'どういたしまして',
  かしこまりました: 'かしこまりました',
  お待たせしました: 'お待たせしました',
  おめでとうございます: 'おめでとうございます',
  お大事に: 'お大事に',
  // expressions and grammar
  かもしれない: 'かも知れない',
  かも知れない: 'かも知れない',
  かもしれません: 'かもしれません',
  かも知れません: 'かもしれません',
  にもかかわらず: 'にもかかわらず',
  にも拘らず: 'にも拘らず',
  わけではない: 'わけではない',
  わけじゃない: 'わけではない',
  とは限らない: 'とは限らない',
  気をつけて: '気をつける',
  気をつける: '気をつける',
  気を付けて: '気を付ける',
  気を付ける: '気を付ける',
  なければならない: 'なければならない',
  なければいけない: 'なければいけない',
  なくてはならない: 'なくてはならない',
  なくてはいけない: 'なくてはならない',
  というのは: 'というのは',
  というより: 'と言うより',
  にとって: 'にとって',
  について: 'について',
  によって: 'によって',
  に対して: 'に対して',
  からといって: 'からといって',
  ずにはいられない: 'ずにはいられない',
  にほかならない: 'にほかならない',
  に他ならない: 'にほかならない',
  に違いない: 'に違いない',
  にちがいない: 'に違いない',
  仕方がない: '仕方がない',
  しょうがない: 'しょうがない',
};

// Phrases that are also a particle plus a verb (席について = sit down, 手にとって
// = pick up): the verb's entries follow the phrase's.
export const JA_ALSO: Record<string, string[]> = { について: ['着く', '付く'], によって: ['寄る'], にとって: ['取る'] };

// Kana words Youdao lacks, or answers with a rarer homophone first (くる「佝偻病」).
export const JA_SPELLING: Record<string, string> = {
  やる: '遣る', おく: '置く', くる: '来る', いう: '言う', こと: '事', いい: '良い', よい: '良い',
};

// Longest first, so よろしくお願いします wins over お願いします.
export const JA_PHRASE_LIST = Object.keys(JA_PHRASES).sort((a, b) => b.length - a.length);
