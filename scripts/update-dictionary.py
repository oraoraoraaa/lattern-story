#!/usr/bin/env python3
"""Refresh the bundled JMdict English starter deck. Python stdlib, maintenance only."""
import argparse, datetime, gzip, hashlib, json, re, urllib.request
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
URL='https://www.edrdg.org/pub/Nihongo/JMdict_e.gz'
SEEDS='日 月 火 水 木 金 土 人 本 山 川 海 空 雨 雪 花 森 風 光 春 夏 秋 冬 星 猫 犬 茶 寿司 友達 電車 駅 傘 菓子 ご飯 家 靴 服 手紙 時間 学校 私 今日 明日 昨日 朝 昼 夜 午前 午後 毎日 今 年 月曜 火曜 水曜 木曜 金曜 土曜 日曜 先生 学生 大学 勉強 日本 日本語 英語 中国 中国語 読む 書く 話す 聞く 見る 行く 来る 帰る 食べる 飲む 買う 売る 作る 遊ぶ 休む 寝る 起きる 歩く 走る 待つ 分かる 好き 大切 一緒 料理 祭り 図書館 病院 部屋 入口 出口 店 会社 仕事 電話 名前 何 誰 何処 上 下 左 右 中 外 前 後 近く 遠い 大きい 小さい 新しい 古い 良い 悪い 高い 安い 早い 遅い 楽しい 悲しい 嬉しい 暑い 寒い 温かい 冷たい 赤 青 白 黒 色 一 二 三 四 五 六 七 八 九 十 百 千 万 円 目 耳 口 手 足 頭 体 心 父 母 兄 姉 弟 妹 家族 子供 男 女 彼 彼女'.split()
SEED_ORDER={s:i for i,s in enumerate(SEEDS)}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path);parser.add_argument('--count',type=int,default=1200);args=parser.parse_args()
 raw=args.source.read_bytes() if args.source else urllib.request.urlopen(URL,timeout=90).read()
 root=ET.fromstring(gzip.decompress(raw));words=[]
 for entry in root.findall('entry'):
  forms=[k for k in entry.findall('k_ele') if not k.findall('ke_inf')]
  if not forms:continue
  forms=[k for k in forms if re.search(r'[\u3400-\u9fff]',k.findtext('keb',''))]
  if not forms:continue
  forms.sort(key=lambda k:(SEED_ORDER.get(k.findtext('keb'),9999),not bool(k.findall('ke_pri'))))
  surface=forms[0].findtext('keb');readings=[]
  if len(surface)>10:continue
  for r in entry.findall('r_ele'):
   restrictions=[x.text for x in r.findall('re_restr')];reading=r.findtext('reb','')
   if r.find('re_nokanji') is not None or restrictions and surface not in restrictions:continue
   if r.findall('re_inf') or not re.fullmatch('[ぁ-ゖァ-ヶー]+',reading) or len(reading)>24:continue
   readings.append(reading)
  readings=list(dict.fromkeys(readings))
  if not readings or len(readings)>8:continue
  senses=[];last_pos=[]
  for sense in entry.findall('sense'):
   written=[x.text for x in sense.findall('stagk')]
   if written and surface not in written:continue
   restricted=[x.text for x in sense.findall('stagr')];allowed=[r for r in readings if not restricted or r in restricted]
   gloss=[g.text for g in sense.findall('gloss') if g.attrib.get('{http://www.w3.org/XML/1998/namespace}lang','eng')=='eng' and g.text]
   pos=[p.text for p in sense.findall('pos')];last_pos=pos or last_pos
   if allowed and gloss:senses.append({'readings':allowed,'meanings':gloss,'pos':last_pos})
  readings=[r for r in readings if any(r in s['readings'] for s in senses)]
  if not readings or not senses:continue
  priorities=[p.text for k in forms for p in k.findall('ke_pri')]+[p.text for r in entry.findall('r_ele') for p in r.findall('re_pri')]
  freq=min([int(p[2:]) for p in priorities if p.startswith('nf')]+[99])
  if surface not in SEED_ORDER and not any(p in ['ichi1','spec1','news1'] for p in priorities) and freq>15:continue
  words.append({'id':entry.findtext('ent_seq'),'kanji':surface,'readings':readings,'senses':senses,'rank':freq})
 words.sort(key=lambda w:(SEED_ORDER.get(w['kanji'],9999),w['rank'],len(w['kanji']),int(w['id'])))
 # Different JMdict entries may use the same writing for different meanings. One quiz
 # merges their reading-qualified senses so a legitimate reading is never rejected.
 merged={}
 for w in words:
  if w['kanji'] in merged:
   old=merged[w['kanji']];old['readings']=list(dict.fromkeys(old['readings']+w['readings']));old['senses']+=w['senses'];old['sourceIds'].append(w['id'])
  else:merged[w['kanji']]={**w,'sourceIds':[w['id']]}
 words=list(merged.values())[:args.count]
 result={'source':'JMdict (Japanese–English), EDRDG','url':URL,'documentation':'https://www.edrdg.org/jmdict/j_jmdict.html','licence':'CC BY-SA 4.0','licenceURL':'https://www.edrdg.org/edrdg/licence.html','retrieved':datetime.datetime.now(datetime.timezone.utc).date().isoformat(),'archiveSHA256':hashlib.sha256(raw).hexdigest(),'selection':'Common kanji-containing vocabulary; curated beginner ordering, then JMdict priority. Writing and reading restrictions preserved. Entries with identical writing are merged.','entries':words}
 target=ROOT/'public/data/jmdict-starter.json';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
 print(f'Bundled {len(words)} dictionary entries. Source SHA-256: {result["archiveSHA256"]}')
if __name__=='__main__':main()
