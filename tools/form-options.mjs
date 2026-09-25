#!/usr/bin/env node
/**
 * サイトの index.html にある APPS 配列から、
 * お問い合わせフォーム（oyajibuki/form）の <option> を生成する。
 *
 *   node tools/form-options.mjs                     # 生成結果を標準出力に出すだけ
 *   node tools/form-options.mjs --check <form.html> # ズレていたら exit 1
 *   node tools/form-options.mjs --write <form.html> # 差し込む（CRLFは維持）
 *
 * フォーム側は下のマーカーで囲まれた範囲だけを書き換える。
 * WEBアプリ・ツールの optgroup は手書きのままなので触らない。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BEGIN = '<!-- BEGIN ios-apps (generated: oyajibuki.github.io/tools/form-options.mjs) -->';
const END   = '<!-- END ios-apps -->';
const INDENT = '          ';

/** 表示名の導出が実際のラベルと違うものだけ、ここで上書きする。 */
const NAME_OVERRIDES = {
  4:  'HOLD — PlunkTimer',              // 「HOLD」だけだと何のアプリか分からない
  6:  'GEOAlame',                       // 一覧は「ジオアラーム（GEOAlame）」表記
  17: 'TuneDrop Focus — 集中タイマー',   // 「TuneDrop」と紛らわしいので副題ごと残す
  18: 'CodiceNatura ダ・ヴィンチノート', // 全角スペースを半角にしたもの
  22: 'RemixMusic — DJミキサー',
};

/** 一覧の name から、フォームで使う短い名前を作る。 */
function shortName(name) {
  return name.split(/｜| — |　|  /)[0].trim();
}

function loadApps(siteIndexPath) {
  const html = readFileSync(siteIndexPath, 'utf8');
  const iconMatch = html.match(/const ICON\s*=\s*'([^']*)'/);
  const appsMatch = html.match(/const APPS\s*=\s*(\[[\s\S]*?\n\];)/);
  if (!iconMatch || !appsMatch) throw new Error('index.html から ICON / APPS を取り出せませんでした');
  // 実ソースをそのまま評価するので、書式が多少変わっても追随する
  return new Function('ICON', `return ${appsMatch[1].replace(/;$/, '')}`)(iconMatch[1]);
}

function buildOptions(apps) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return apps
    .filter(a => a.status === 'released')
    .sort((a, b) => b.no - a.no)          // 新しい順。問い合わせは直近のリリースに集中するため
    .map(a => {
      const v = esc(NAME_OVERRIDES[a.no] ?? shortName(a.name));
      return `${INDENT}<option value="${v}">${v}</option>`;
    })
    .join('\r\n');
}

function splice(formHtml, block) {
  const b = formHtml.indexOf(BEGIN);
  const e = formHtml.indexOf(END);
  if (b === -1 || e === -1) {
    throw new Error(`フォーム側にマーカーがありません。<optgroup label="iOSアプリ"> の中を\n${BEGIN}\n…\n${END}\nで囲んでください。`);
  }
  return formHtml.slice(0, b + BEGIN.length) + '\r\n' + block + '\r\n' + INDENT + formHtml.slice(e);
}

const here = dirname(fileURLToPath(import.meta.url));
const apps = loadApps(join(here, '..', 'index.html'));
const block = buildOptions(apps);

const mode = process.argv[2];
const formPath = process.argv[3];

if (!mode) {
  console.log(block.replace(/\r\n/g, '\n'));
  process.exit(0);
}
if (!formPath) {
  console.error('使い方: node tools/form-options.mjs --check|--write <form/index.html>');
  process.exit(2);
}

const before = readFileSync(formPath, 'utf8');
const after = splice(before, block);

if (mode === '--check') {
  if (before === after) {
    console.log(`OK: フォームは最新です（iOSアプリ ${block.split('\r\n').length} 件）`);
    process.exit(0);
  }
  console.error('NG: サイトの APPS とフォームの <option> がズレています。--write で更新してください。');
  process.exit(1);
}
if (mode === '--write') {
  if (before === after) { console.log('変更なし'); process.exit(0); }
  writeFileSync(formPath, after);
  console.log(`更新しました（iOSアプリ ${block.split('\r\n').length} 件）`);
  process.exit(0);
}
console.error(`不明なオプション: ${mode}`);
process.exit(2);
