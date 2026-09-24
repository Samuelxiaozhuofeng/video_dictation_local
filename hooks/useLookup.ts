import { useRef, useState } from 'react';
import * as AI from '../utils/ai';
import { DefinitionState, emptyDefinition } from '../components/DefinitionPanel';
import { useT, getLang } from '../utils/i18n';
import { DictLang, lookupWord, senseList, DictEntry } from '../utils/dictionary';

// Word lookup behind the definition popup, shared by the practice page and review.
// Dictionary first. AI answers instead when the dictionary has nothing (or no
// dictionary covers the language), and first when the UI is English, since
// the dictionaries only give Chinese.
export const useLookup = (dictLang: DictLang | null, context: string) => {
  const t = useT();
  const [def, setDef] = useState<DefinitionState>(emptyDefinition);
  const seqRef = useRef(0);

  const lookup = async (word: string) => {
    const seq = ++seqRef.current;
    const mine = () => seq === seqRef.current;
    const ai = AI.aiReady();
    setDef({ ...emptyDefinition, word, loading: true });
    let dict: DictEntry[] | null = null;
    let offline = false;
    if (dictLang && !(ai && getLang() === 'en')) {
      try { dict = await lookupWord(word, dictLang); } catch (e) { offline = true; console.error('Dictionary lookup failed:', e); }
    }
    if (!mine()) return;
    if (dict) return setDef({ ...emptyDefinition, word, dict, context });
    if (!ai) {
      const error = t(offline ? 'definition.dictOffline' : dictLang ? 'definition.notFound' : 'definition.noDictLang');
      return setDef({ ...emptyDefinition, word, failed: true, error });
    }
    try {
      const data = await AI.getWordDefinition(word, context);
      if (mine()) setDef({ ...emptyDefinition, word, data });
    } catch (e) {
      if (mine()) setDef({ ...emptyDefinition, word, failed: true, error: (e as Error).message });
    }
  };

  // AI points at the dictionary meaning this sentence uses.
  const explain = async () => {
    const seq = seqRef.current;
    const { word, context: ctx, dict } = def;
    if (!word || !dict) return;
    setDef(d => ({ ...d, aiLoading: true, aiError: undefined }));
    try {
      const pick = await AI.pickSense(word, ctx ?? '', senseList(dict).map(s => s.line));
      if (seq === seqRef.current) setDef(d => ({ ...d, pick, aiLoading: false }));
    } catch (e) {
      if (seq === seqRef.current) setDef(d => ({ ...d, aiLoading: false, aiError: (e as Error).message }));
    }
  };

  const closeDef = () => { seqRef.current++; setDef(emptyDefinition); };

  return { def, lookup, explain: AI.aiReady() ? explain : undefined, closeDef };
};
