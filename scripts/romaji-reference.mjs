import {writeFileSync} from 'node:fs';
import {KANA} from '../public/lib/kana.mjs';
import {spellings} from '../public/lib/romaji-options.mjs';
const lines=[
 '# Supported Japanese input spellings',
 '',
 'This is the complete list of direct alternatives currently accepted by the game. The same rules apply to RPG dialogue, translated player replies and vocabulary reading quizzes. Hiragana and the corresponding katakana use identical romanized keys. The quiz also accepts the dictionary reading directly in kana.',
 '',
 'The mapping combines Hepburn / Kunrei / Nihon-shiki forms with the kana-only entries in [Google Mozc’s default romaji table](https://github.com/google/mozc/blob/master/src/data/preedit/romanji-hiragana.tsv), plus explicit small-kana combinations. Mozc attribution and the BSD licence are bundled in [Mozc-LICENSE.txt](../public/data/Mozc-LICENSE.txt). Candidate selection, punctuation shortcuts and IME conversion state are outside this typing game; the known target reading resolves phonetic ambiguities.',
 '',
 '## Direct alternatives',
 '',
 '| Kana | Accepted input |',
 '| --- | --- |'
];
for(const kana of Object.keys(KANA)){const alternatives=spellings(kana);if(alternatives.length>1)lines.push(`| ${kana} | ${alternatives.map(s=>'`'+s+'`').join(', ')} |`);}
lines.push('', '## Contextual rules', '',
 '- **Small っ / ッ:** double the first consonant of a valid following spelling. Thus 一緒 accepts `issho`, `issyo`, `iccho` is rejected, and まっちゃ accepts `maccha`, `matcha`, `mattya`, `maccya`. The consonant and following spelling must agree; `mactya` is rejected. `xtsu`, `ltsu`, `xtu`, `ltu` can be used explicitly, including before another chunk. A final glottal っ may be silent or explicit; punctuation stops consonant bridging.',
 '- **ん / ン:** `n`, `nn`, `n\'`, `xn`. Examples: 本 → `hon`, `honn`, `hon\'`, `hoxn`; 本屋 → `honya`, `honnya`, `hon\'ya`, `hoxnya`. The target reading is known, so this trainer does not require IME-style disambiguation before vowels.',
 '- **Long ー:** repeat the preceding vowel or type `-`: コーヒー → `koohii`, `ko-hi-`, or a mixture. Written おう remains `ou`; written おお remains `oo`. Macron spellings such as `ō` are not ASCII keyboard sequences and are not enabled.',
 '- **Particles:** は accepts `wa` / `ha`, へ accepts `e` / `he`, を accepts `o` / `wo`. Ordinary は and へ inside lexical words keep their normal pronunciation. こんにちは / こんばんは accept a final `wa` or `ha`.',
 '- **Small kana:** `x` / `l` keys work both alone and inside a compound: しょ → `sho`, `syo`, `shixyo`, `shilyo`, `sixyo`, `silyo`, `cixyo`, `cilyo`. A full-size よ cannot replace small ょ: `shiyo` is a different reading and is rejected.',
 '- **Case, width and separators:** case, full-width ASCII, whitespace and ordinary punctuation are normalized. Apostrophe and hyphen remain meaningful for `n\'` and long vowels. Curly apostrophes normalize to the straight apostrophe.',
 '- **Progress:** matching uses a memoized graph, not a Cartesian list of all whole-sentence spellings. It remembers which Japanese chunk owns each accepted letter. Typing `watasi` completes 私 just as `watashi` does; Backspace reverses the same mapping.',
 '', 'The in-game **Typing guide** shows the same generated mapping. To regenerate this document after editing the table, run `node scripts/romaji-reference.mjs`.', '');
writeFileSync(new URL('../docs/romaji.md',import.meta.url),lines.join('\n'));
