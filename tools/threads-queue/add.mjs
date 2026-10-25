#!/usr/bin/env node
/**
 * できあがったショート動画を、Threads の投稿予約（threads-queue ブランチ）に積む。Mac で動かす。
 *
 *   node tools/threads-queue/add.mjs <動画.mp4>                       # 予約の中身を表示するだけ（積まない）
 *   node tools/threads-queue/add.mjs <動画.mp4> --yes                 # 次の枠に積む
 *   node tools/threads-queue/add.mjs <動画.mp4> --at "2026-10-27 19:00" --yes
 *   node tools/threads-queue/add.mjs <動画.mp4> --text 本文.txt --yes  # 本文を自分で書いたものにする
 *   node tools/threads-queue/add.mjs <EP01.mp4> <EP02.mp4> … --at "2026-10-26 19:00" --yes  # まとめて。2本目からは次の枠に続けて入る
 *   node tools/threads-queue/add.mjs --list                           # 予約の一覧
 *   node tools/threads-queue/add.mjs --remove <ID>                    # 予約を取り消す
 *
 * 本文は、動画と同じフォルダの「*_投稿文.md」の Instagram のキャプションを Threads 用に直したもの。
 * 次の枠：断酒クエストは毎日 19:00、ジオアラームは月・水・金の 7:00（すでに積んである回の次）。
 * 投稿するのは GitHub Actions（.github/workflows/threads-queue.yml）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { APPS, appOf, igCaption, toThreads, nextSlot, fmtJst, parseJst } from './apps.mjs';

const REPO = 'https://github.com/oyajibuki/oyajibuki.github.io.git';
const BRANCH = 'threads-queue';
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const has = k => args.includes(k);
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

// 予約ブランチを一時フォルダに取ってくる（まだ無ければ空のブランチを用意する）
function checkout() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'threads-queue-'));
  try {
    execFileSync('git', ['clone', '-q', '--depth', '1', '--branch', BRANCH, '--single-branch', REPO, dir], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch {
    git(dir, 'init', '-q', '-b', BRANCH);
    git(dir, 'remote', 'add', 'origin', REPO);
  }
  fs.mkdirSync(path.join(dir, 'queue'), { recursive: true });
  return dir;
}
const items = dir => fs.readdirSync(path.join(dir, 'queue')).filter(id => fs.existsSync(path.join(dir, 'queue', id, 'post.json')))
  .map(id => JSON.parse(fs.readFileSync(path.join(dir, 'queue', id, 'post.json'), 'utf8'))).sort((a, b) => a.at.localeCompare(b.at));
function push(dir, msg) {
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=asagiri', '-c', 'user.email=oyajibuki@users.noreply.github.com', 'commit', '-q', '-m', msg);
  git(dir, 'push', '-q', 'origin', BRANCH);
}

if (has('--list') || has('--remove')) {
  const dir = checkout();
  const list = items(dir);
  const rm = opt('--remove');
  if (rm) {
    if (!list.some(x => x.id === rm)) throw new Error(`予約 ${rm} はありません`);
    fs.rmSync(path.join(dir, 'queue', rm), { recursive: true });
    push(dir, `remove ${rm}`);
    console.log(`取り消しました: ${rm}`);
  } else if (!list.length) console.log('予約はありません');
  else for (const x of list) console.log(`${fmtJst(new Date(x.at))}  ${APPS[x.app].name}  ${x.id}  ← ${x.source}`);
  process.exit(0);
}

// 動画は複数まとめて渡せる。--at は1本目の日時で、2本目からは前の回の次の枠に入る
const videos = args.filter(a => /\.(mp4|mov)$/i.test(a));
if (!videos.length) throw new Error('動画ファイルを指定してください');
if (opt('--text') && videos.length > 1) throw new Error('--text は動画1本のときだけ使えます');

// 投稿文：同じフォルダの *_投稿文.md のうち、Instagram のキャプションがあるもの（動画のファイル名が書いてあるものを優先）
function textOf(abs, app) {
  if (opt('--text')) return fs.readFileSync(opt('--text'), 'utf8').trim();
  const folder = path.dirname(abs);
  const mds = fs.readdirSync(folder).filter(f => f.endsWith('_投稿文.md')).map(f => fs.readFileSync(path.join(folder, f), 'utf8'))
    .sort((a, b) => b.includes(path.basename(abs)) - a.includes(path.basename(abs)));
  const cap = mds.map(igCaption).find(Boolean);
  if (!cap) throw new Error(`${path.basename(abs)}: 同じフォルダの *_投稿文.md に Instagram のキャプションがありません（--text で本文を渡せます）`);
  return toThreads(cap, app);
}

const dir = checkout();
const list = items(dir);
const lastOf = app => list.filter(x => x.app === app).map(x => new Date(x.at)).sort((a, b) => b - a)[0];
const plan = [];
for (const [k, video] of videos.entries()) {
  if (!fs.existsSync(video)) throw new Error(`ありません: ${video}`);
  const abs = path.resolve(video);
  const app = appOf(abs);
  if (!app) throw new Error(`${video}: 断酒クエストかジオアラームのフォルダの動画ではありません`);
  const size = fs.statSync(abs).size;
  if (size > 95 * 1024 * 1024) throw new Error(`${video}: 大きすぎます（${Math.round(size / 1048576)}MB。GitHub に置ける上限は100MB）`);
  const text = textOf(abs, app);
  if (text.length > 500) throw new Error(`${video}: 本文が500文字を超えています（${text.length}文字）。--text で短くしたものを渡してください`);
  const source = path.relative(path.resolve(abs, '../../../..'), abs); // 例 11.GEOAlame/shortmovie/G02/G02_….mp4
  if ((list.some(x => x.source === source) || plan.some(x => x.source === source)) && !has('--force')) throw new Error(`この動画はもう予約に入っています（${source}）。もう一度積むなら --force`);
  const prev = [...plan].reverse().find(x => x.app === app)?.at || lastOf(app);
  const at = k === 0 && opt('--at') ? parseJst(opt('--at')) : nextSlot(app, prev && prev > new Date() ? prev : new Date());
  if (Number.isNaN(at.getTime())) throw new Error('--at は "2026-10-27 19:00" の形で');
  const slug = (path.basename(abs).match(/^[A-Za-z]+\d+/) || ['video'])[0];
  const id = `${fmtJst(at).replace(/[-: ]/g, '').slice(0, 12)}-${slug}`;
  plan.push({ id, app, at, text, source, abs, size });
}

for (const x of plan) {
  console.log(`${APPS[x.app].name}  ${fmtJst(x.at)}（日本時間）に投稿  ID: ${x.id}`);
  console.log(`動画: ${x.source}（${(x.size / 1048576).toFixed(1)}MB）`);
  console.log(`---\n${x.text}\n---（${x.text.length}文字）\n`);
}
if (!has('--yes')) { console.log('この内容で予約するなら --yes を付けてもう一度実行'); process.exit(0); }

for (const x of plan) {
  const d = path.join(dir, 'queue', x.id);
  fs.mkdirSync(d, { recursive: true });
  fs.copyFileSync(x.abs, path.join(d, 'video.mp4'));
  fs.writeFileSync(path.join(d, 'post.json'), JSON.stringify({ id: x.id, app: x.app, at: x.at.toISOString(), text: x.text, source: x.source }, null, 2) + '\n');
}
push(dir, `add ${plan.map(x => x.id).join(' ')}`);
console.log(`予約しました（${plan.length}本）`);
