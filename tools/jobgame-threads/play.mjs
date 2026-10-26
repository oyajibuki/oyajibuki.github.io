#!/usr/bin/env node
/**
 * 「7千万分の1」を1回おまかせで遊んで、シェア用カードと Threads の投稿文をつくる。
 *
 *   node tools/jobgame-threads/play.mjs            # → tools/jobgame-threads/out/card.png・post.txt
 *
 * リポジトリの中身をローカルで配信して jobgame/?bot=1 を開き、window.JGBot.run() の結果を保存する。
 * （公開版の反映を待たずに、いまのコードで遊ぶ）
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(HERE, 'out');
const SITE = 'https://oyajibuki.github.io/jobgame/';

// 投稿のいちばん上に置く問いかけ（コメントしてもらいやすいように）。毎回同じだと bot っぽいので、
// その日の人生の数字を入れて、日ごとに順番に替える。ok があるものは、その人生に合うときだけ使う
const QUESTIONS = [
  { q: f => `「${f.job}」を引いたら、あなたならそのまま続けますか？` },
  { q: f => `生涯収入${f.money}。あなたの予想より多い？少ない？` },
  { q: () => 'あなたが社会に出て、最初に就いた仕事は何でしたか？' },
  { q: f => `転職${f.changes}回の人生。あなたはこれまで何回、仕事を変えましたか？`, ok: f => f.changes > 0 },
  { q: () => '一度も仕事を変えなかった人生。あなたは「ひとつの会社」派？「転職」派？', ok: f => f.changes === 0 },
  { q: () => 'この仕事人生、100点満点で何点をつけますか？' },
  { q: f => `「${f.job}」は働く人の${f.rare}人に1人。身近にいますか？` },
  { q: f => `${f.endAge}歳で引退。あなたは何歳まで働きたいですか？` },
  { q: f => `称号は「${f.honor}」。あなたの仕事人生に称号をつけるなら？` },
  { q: () => '子どもの頃になりたかった仕事、覚えていますか？' },
  { q: f => `同期5人中${f.rank}位。あなたは同期の中で何位くらいだと思いますか？` },
  { q: f => `${f.startAge}歳で働きはじめた人生。あなたは何歳から働きましたか？` },
  { q: f => `同じ年に働きはじめた人の中で${f.top}。この人生、うらやましいですか？`, ok: f => f.top.startsWith('上位') },
  { q: f => `同じ年に働きはじめた人の中で${f.top}。それでも、いい人生だったと思いますか？`, ok: f => f.top.startsWith('下位') },
  { q: () => 'もう一度やり直せるとしたら、あなたは同じ仕事を選びますか？' },
];
// 日（日本時間）ごとに1つずつずらして、その人生に合う最初の問いを使う
function question(f, day) {
  for (let k = 0; k < QUESTIONS.length; k++) {
    const x = QUESTIONS[(day + k) % QUESTIONS.length];
    if (!x.ok || x.ok(f)) return x.q(f);
  }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = p.endsWith('/') ? path.join(p, 'index.html') : p;
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ locale: 'ja-JP', viewport: { width: 1200, height: 900 } });
  page.on('pageerror', e => console.error('[page]', e.message));
  await page.goto(`http://127.0.0.1:${port}/jobgame/?lang=ja&bot=1`);
  await page.waitForFunction(() => window.JGBot, null, { timeout: 30000 });
  const r = await page.evaluate(() => window.JGBot.run());

  // 日本時間の日付（例 10/26）
  const d = new Date(Date.now() + 9 * 3600e3);
  const date = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  // シェア文の最後のハッシュタグは、投稿の最後に回す
  const lines = r.text.split('\n');
  const tag = lines[lines.length - 1].startsWith('#') ? lines.pop() : '#7千万分の1';
  const day = Math.floor((Date.now() + 9 * 3600e3) / 86400e3) + Number(process.env.DAY_OFFSET || 0); // DAY_OFFSET は試すとき用
  const text = [
    question(r.facts, day),
    '',
    `今日の仕事人生（${date}）`,
    '',
    `${r.name}さん。${r.summary}`,
    ...lines,
    '',
    `“${r.epitaph}”`,
    '',
    `あなたは何を引く？ ${SITE}`,
    tag,
  ].join('\n');

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'card.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'post.txt'), text);
  console.log(text);
  console.log(`\n→ ${path.join(OUT, 'card.png')}（${text.length}文字）`);
} finally {
  await browser.close();
  server.close();
}
