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
  const text = [
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
