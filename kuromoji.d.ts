// kuromoji ships no types; utils/japanese.ts uses these two internals directly.
declare module 'kuromoji/src/dict/DynamicDictionaries' {
  const DynamicDictionaries: new () => any;
  export default DynamicDictionaries;
}
declare module 'kuromoji/src/Tokenizer' {
  const Tokenizer: new (dic: any) => { tokenize(text: string): any[] };
  export default Tokenizer;
}
