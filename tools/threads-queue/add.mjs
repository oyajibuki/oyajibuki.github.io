#!/usr/bin/env node
/**
 * できあがったショート動画を、Threads の投稿予約（threads-queue ブランチ）に積む。Mac で動かす。
 *
 *   node tools/threads-queue/add.mjs <動画.mp4>                       # 予約の中身を表示するだけ（積まない）
 *   node tools/threads-queue/add.mjs <動画.mp4> --yes                 # 次の枠に積む
 *   node tools/threads-queue/add.mjs <動画.mp4> --at "2026-10-27 19:00" --yes
 *   node tools/threads-queue/add.mjs <動画.mp4> --text 本文.txt --yes  # 本文を自分で書いたものにする
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

const video = args.find(a => a.endsWith('.mp4') || a.endsWith('.mov'));
if (!video || !fs.existsSync(video)) throw new Error('動画ファイルを指定してください');
const abs = path.resolve(video);
const app = appOf(abs);
if (!app) throw new Error('断酒クエストかジオアラームのフォルダの動画ではありません');
const size = fs.statSync(abs).size;
if (size > 95 * 1024 * 1024) throw new Error(`動画が大きすぎます（${Math.round(size / 1048576)}MB。GitHub に置ける上限は100MB）`);

let text;
if (opt('--text')) text = fs.readFileSync(opt('--text'), 'utf8').trim();
else {
  const md = fs.readdirSync(path.dirname(abs)).find(f => f.endsWith('_投稿文.md'));
  if (!md) throw new Error('同じフォルダに *_投稿文.md がありません（--text で本文を渡すこともできます）');
  const cap = igCaption(fs.readFileSync(path.join(path.dirname(abs), md), 'utf8'));
  if (!cap) throw new Error(`${md} に Instagram のキャプションが見つかりません`);
  text = toThreads(cap, app);
}
if (text.length > 500) throw new Error(`本文が500文字を超えています（${text.length}文字）。--text で短くしたものを渡してください`);

const dir = checkout();
const list = items(dir);
const source = path.relative(path.resolve(abs, '../../../..'), abs); // 例 11.GEOAlame/shortmovie/G02/G02_….mp4
if (list.some(x => x.source === source) && !has('--force')) throw new Error(`この動画はもう予約に入っています（${source}）。もう一度積むなら --force`);
const last = list.filter(x => x.app === app).map(x => new Date(x.at)).sort((a, b) => b - a)[0];
const at = opt('--at') ? parseJst(opt('--at')) : nextSlot(app, last && last > new Date() ? last : new Date());
if (Number.isNaN(at.getTime())) throw new Error('--at は "2026-10-27 19:00" の形で');
const slug = (path.basename(abs).match(/^[A-Za-z]+\d+/) || ['video'])[0];
const id = `${fmtJst(at).replace(/[-: ]/g, '').slice(0, 12)}-${slug}`;

console.log(`${APPS[app].name}  ${fmtJst(at)}（日本時間）に投稿  ID: ${id}`);
console.log(`動画: ${source}（${(size / 1048576).toFixed(1)}MB）`);
console.log(`---\n${text}\n---（${text.length}文字）`);
if (!has('--yes')) { console.log('\nこの内容で予約するなら --yes を付けてもう一度実行'); process.exit(0); }

const d = path.join(dir, 'queue', id);
fs.mkdirSync(d, { recursive: true });
fs.copyFileSync(abs, path.join(d, 'video.mp4'));
fs.writeFileSync(path.join(d, 'post.json'), JSON.stringify({ id, app, at: at.toISOString(), text, source }, null, 2) + '\n');
push(dir, `add ${id}`);
console.log('予約しました');
