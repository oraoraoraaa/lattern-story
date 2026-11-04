# Dictionary and input data

The Japanese spellings, kana readings, reading restrictions and English meanings in `jmdict-starter.json` are derived from **JMdict**, copyright James William BREEN and the Electronic Dictionary Research and Development Group (EDRDG). They are used under **Creative Commons Attribution-ShareAlike 4.0**. The derived dataset is distributed under that same licence. This does not change the licence of the application code or artwork.

Source and documentation: https://www.edrdg.org/jmdict/j_jmdict.html

Licence statement: https://www.edrdg.org/edrdg/licence.html

Local copies: `EDRDG-LICENCE.html`, `CC-BY-SA-4.0.txt`.

The snapshot includes 1,200 common kanji-containing headwords. The selection starts with a curated list of beginner headwords, then follows JMdict common-word priorities; it is not a JLPT-certified list. Kana-only entries and uncommon orthographic variants are omitted. Writing/reading/sense restrictions are retained; dictionary entries with identical writing are merged, and their original entry IDs are retained. Meaning distractors are other dictionary definitions, screened for overlapping English content words. AI sentences and tutor responses are separate supplementary material and never supply quiz answer keys.

`jmdict-starter.json` records the source URL, retrieval date, source archive SHA-256 and transformation description. Maintain this snapshot at least monthly: run `npm run dictionary:update` (Python 3 standard library is needed for this maintenance command only), review the resulting data change, run `npm test`, and ship the updated snapshot. The game itself never needs Python, a dictionary download or a dictionary service at launch.

Google Mozc's default kana key mappings supplement the romaji matcher. Source: https://github.com/google/mozc/blob/master/src/data/preedit/romanji-hiragana.tsv . Attribution and upstream licence are in `Mozc-LICENSE.txt`. Only kana outputs and ASCII key sequences are imported; contextual small-tsu matching and phonetic aliases are implemented by the app. The transformed table is `public/lib/ime-table.mjs`.
