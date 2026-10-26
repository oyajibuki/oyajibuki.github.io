#!/usr/bin/env node
/**
 * play.mjs がつくった投稿文と、公開URLに置いたカード画像を Threads に投稿する。
 *
 *   THREADS_TOKEN=... IMAGE_URL=https://... node tools/jobgame-threads/post.mjs
 *   DRY_RUN=1 をつけると、投稿せずに中身だけ表示する。
 *   CHECK_ONLY=1 … 今日（日本時間）の「今日の仕事人生」をもう出したかだけ調べて、GITHUB_OUTPUT に done=true|false
 *
 * Threads API: 画像つきのコンテナをつくる → 準備できるまで待つ → 公開する。
 * GitHub の予定実行は遅れたり飛ばされたりするので、ワークフローは1日に何度か動かし、もう出した日は何もしない。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = 'https://graph.threads.net/v1.0';
const { THREADS_TOKEN: token, IMAGE_URL: imageUrl, DRY_RUN, CHECK_ONLY, GITHUB_OUTPUT } = process.env;

async function call(method, p, params = {}) {
  const url = new URL(API + p);
  for (const [k, v] of Object.entries({ ...params, access_token: token })) url.searchParams.set(k, v);
  const res = await fetch(url, { method });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`${method} ${p}: ${JSON.stringify(body.error || body)}`);
  return body;
}

// 今日（日本時間）の「今日の仕事人生（M/D）」の投稿がもうあるか
async function postedToday() {
  const j = new Date(Date.now() + 9 * 3600e3);
  const head = `今日の仕事人生（${j.getUTCMonth() + 1}/${j.getUTCDate()}）`;
  const { data = [] } = await call('GET', '/me/threads', { fields: 'text,permalink,timestamp', limit: 25 });
  return data.find(t => (t.text || '').includes(head));
}

if (CHECK_ONLY) {
  if (!token) throw new Error('THREADS_TOKEN がありません');
  const done = await postedToday();
  console.log(done ? `今日の分はもう出ています: ${done.permalink}` : '今日の分はまだです');
  if (GITHUB_OUTPUT) fs.appendFileSync(GITHUB_OUTPUT, `done=${!!done}\n`);
  process.exit(0);
}

const text = fs.readFileSync(path.join(HERE, 'out', 'post.txt'), 'utf8');
if (!imageUrl) throw new Error('IMAGE_URL がありません');
if (text.length > 500) throw new Error(`投稿文が500文字を超えています（${text.length}文字）`);
if (DRY_RUN) { console.log(`[DRY_RUN] ${imageUrl}\n${text}`); process.exit(0); }
if (!token) throw new Error('THREADS_TOKEN がありません');

const me = await call('GET', '/me', { fields: 'id,username' });
const { id: container } = await call('POST', `/${me.id}/threads`, { media_type: 'IMAGE', image_url: imageUrl, text });
// 画像の取り込みが終わるまで待つ（公式の目安は30秒）
for (let i = 0; ; i++) {
  await new Promise(r => setTimeout(r, i ? 10000 : 30000));
  const st = await call('GET', `/${container}`, { fields: 'status,error_message' });
  if (st.status === 'FINISHED') break;
  if (st.status === 'ERROR' || st.status === 'EXPIRED' || i >= 12) throw new Error(`コンテナの準備に失敗: ${JSON.stringify(st)}`);
}
// 待っているあいだに別の実行が出していたら、二重に出さない
const already = await postedToday();
if (already) { console.log(`今日の分はもう出ています: ${already.permalink}`); process.exit(0); }
const { id } = await call('POST', `/${me.id}/threads_publish`, { creation_id: container });
const { permalink } = await call('GET', `/${id}`, { fields: 'permalink' });
console.log(`投稿しました @${me.username}: ${permalink}`);
