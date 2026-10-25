#!/usr/bin/env node
/**
 * GitHub Actions から呼ぶ。threads-queue ブランチ（引数のフォルダ）の予約のうち、時間が来たものを Threads に動画で投稿する。
 *
 *   THREADS_TOKEN=... REPO=owner/name SHA=<ブランチのコミット> node tools/threads-queue/run.mjs <ブランチのフォルダ>
 *   DRY_RUN=1 … 動画の取り込み（コンテナの準備）までやって、公開はしない。予約も消さない
 *   ONLY=<ID> … 時間に関係なく、その予約だけを扱う（試すとき用）
 *
 * 投稿したものは queue/ から消して done.json に記録する。投稿したら GITHUB_OUTPUT に posted=true。
 */
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://graph.threads.net/v1.0';
const { THREADS_TOKEN: token, REPO, SHA, DRY_RUN, ONLY, GITHUB_OUTPUT } = process.env;
const dir = process.argv[2];
const EARLY = 15 * 60e3;      // 予約の15分前から出してよい（Actions の起動は30分おきで、遅れることもあるため）
const LATE = 12 * 3600e3;     // 12時間以上過ぎたものは出さない（夜の回が朝に出るのを防ぐ）

async function call(method, p, params = {}) {
  const url = new URL(API + p);
  for (const [k, v] of Object.entries({ ...params, access_token: token })) url.searchParams.set(k, v);
  const res = await fetch(url, { method });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`${method} ${p}: ${JSON.stringify(body.error || body)}`);
  return body;
}

const qdir = path.join(dir, 'queue');
const list = (fs.existsSync(qdir) ? fs.readdirSync(qdir) : []).filter(id => fs.existsSync(path.join(qdir, id, 'post.json')))
  .map(id => JSON.parse(fs.readFileSync(path.join(qdir, id, 'post.json'), 'utf8'))).sort((a, b) => a.at.localeCompare(b.at));
const now = Date.now();
const due = ONLY ? list.filter(x => x.id === ONLY) : list.filter(x => Date.parse(x.at) - EARLY <= now);
if (!due.length) { console.log(`時間が来た予約はありません（予約 ${list.length} 件）`); process.exit(0); }
if (!token) throw new Error('THREADS_TOKEN がありません');

const donePath = path.join(dir, 'done.json');
const done = fs.existsSync(donePath) ? JSON.parse(fs.readFileSync(donePath, 'utf8')) : [];
const me = await call('GET', '/me', { fields: 'id,username' });
let posted = false;
// 途中の1件で失敗しても、それまでに出したものは記録して posted を返す（次の実行で二重に出さないため）
process.on('exit', () => { if (GITHUB_OUTPUT) fs.appendFileSync(GITHUB_OUTPUT, `posted=${posted}\n`); });
for (const x of due) {
  const record = { id: x.id, app: x.app, at: x.at, source: x.source };
  if (!ONLY && now - Date.parse(x.at) > LATE) {
    console.log(`::warning::${x.id} は予約の時間を12時間以上過ぎたので出しません`);
    done.push({ ...record, missed: true });
  } else {
    const videoUrl = `https://raw.githubusercontent.com/${REPO}/${SHA}/queue/${x.id}/video.mp4`;
    const { id: container } = await call('POST', `/${me.id}/threads`, { media_type: 'VIDEO', video_url: videoUrl, text: x.text });
    // 動画の取り込みは画像より時間がかかる（最大5分待つ）
    for (let i = 0; ; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const st = await call('GET', `/${container}`, { fields: 'status,error_message' });
      if (st.status === 'FINISHED') break;
      if (st.status === 'ERROR' || st.status === 'EXPIRED' || i >= 30) throw new Error(`${x.id}: 動画の準備に失敗 ${JSON.stringify(st)}`);
    }
    if (DRY_RUN) { console.log(`[DRY_RUN] ${x.id}: 動画の取り込みまで成功（公開はしていません）`); continue; }
    const { id } = await call('POST', `/${me.id}/threads_publish`, { creation_id: container });
    const { permalink } = await call('GET', `/${id}`, { fields: 'permalink' });
    console.log(`投稿しました ${x.id} @${me.username}: ${permalink}`);
    done.push({ ...record, postedAt: new Date().toISOString(), permalink });
    posted = true;
  }
  fs.rmSync(path.join(qdir, x.id), { recursive: true });
  fs.writeFileSync(donePath, JSON.stringify(done, null, 2) + '\n');
}
