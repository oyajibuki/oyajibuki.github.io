#!/usr/bin/env node
/**
 * SEO 用の静的出力を、index.html の APPS から一括生成する。
 *
 *   node tools/seo-build.mjs                      # ドライラン（何も書かない。変更予定だけ表示）
 *   node tools/seo-build.mjs --write              # 書き込み
 *   node tools/seo-build.mjs --write --backup-dir /path   # 書き換える HTML の原本を先にコピー
 *
 * 生成するもの:
 *   - sitemap.xml / robots.txt
 *   - index.html : canonical・OGP・JSON-LD(ItemList)・description、JS無しでも見える公開済み一覧
 *   - 各アプリの紹介ページ : canonical・OGP・JSON-LD(SoftwareApplication)
 *       対象は APPS の links に「紹介ページ」があるもの（サポートだけのページは触らない）
 *
 * 冪等: <!-- seo:begin --> … <!-- seo:end --> の中身だけを置き換える。何度流しても同じ結果。
 * 既にページ側にある description / og:* は重複させず、無いものだけ補う。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://oyajibuki.github.io';
const WRITE = process.argv.includes('--write');
const bi = process.argv.indexOf('--backup-dir');
const BACKUP_DIR = bi > -1 ? path.resolve(process.argv[bi + 1]) : null;

const CATEGORY = {
  'ヘルスケア': 'HealthApplication', 'フィットネス': 'HealthApplication', '教育': 'EducationalApplication',
  '仕事効率化': 'BusinessApplication', 'ナビゲーション': 'UtilitiesApplication', 'ファイナンス': 'FinanceApplication',
  'ユーティリティ': 'UtilitiesApplication', 'ミュージック': 'MusicApplication', '写真/ビデオ': 'MultimediaApplication',
  'ソーシャルネットワーキング': 'SocialNetworkingApplication', 'ライフスタイル': 'LifestyleApplication', 'ゲーム': 'GameApplication',
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ldJson = o => JSON.stringify(o).replace(/</g, '\\u003c');
const bigIcon = u => (u || '').replace('/100x100bb.jpg', '/512x512bb.jpg');
const cleanName = n => n.replace(/\s+/g, ' ').trim();

const indexPath = path.join(ROOT, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

// APPS を index.html から取り出す（const APPS = [ ... ]; をそのまま評価）
const m = indexHtml.match(/const ICON = [^;]+;[\s\S]*?const APPS = \[[\s\S]*?\n\];/);
if (!m) throw new Error('index.html から APPS を取り出せませんでした');
const ctx = {};
vm.runInNewContext(m[0] + '\nthis.APPS = APPS;', ctx);
const APPS = ctx.APPS;
const released = APPS.filter(a => a.status === 'released');

const intro = a => (a.links || []).find(l => l.t === '紹介ページ' && l.u.startsWith('/'));
const urlOf = p => ORIGIN + p;

/* ---------- 共通: マーカー内を差し替え ---------- */
const BEGIN = '<!-- seo:begin -->', END = '<!-- seo:end -->';
const stripBlock = html => html.replace(new RegExp(`\\n?[ \\t]*${BEGIN}[\\s\\S]*?${END}[ \\t]*`, 'g'), '');
function injectHead(html, block) {
  html = stripBlock(html);
  return html.replace(/<\/head>/i, `${BEGIN}\n${block}\n${END}\n</head>`);
}
const has = (html, re) => re.test(html);

const changes = [];
function save(file, next, prev) {
  if (next === prev) { changes.push([file, '変更なし']); return; }
  changes.push([file, '更新']);
  if (!WRITE) return;
  if (BACKUP_DIR) {
    const dst = path.join(BACKUP_DIR, path.relative(ROOT, file));
    if (fs.existsSync(file) && !fs.existsSync(dst)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(file, dst);
    }
  }
  fs.writeFileSync(file, next);
}

/* ---------- 各アプリの紹介ページ ---------- */
const urls = [];
for (const a of released) {
  const l = intro(a);
  if (!l) continue;
  const file = path.join(ROOT, l.u.replace(/^\//, ''), 'index.html');
  if (!fs.existsSync(file)) { changes.push([file, '【スキップ】ファイル無し']); continue; }
  const prev = fs.readFileSync(file, 'utf8');
  // 自分のブロックを除いた状態で既存タグの有無を判定する
  const bare = stripBlock(prev);
  const title = (bare.match(/<title>([\s\S]*?)<\/title>/i) || [, cleanName(a.name)])[1].trim();
  const descM = bare.match(/<meta\s+name="description"[^>]*content="([^"]*)"/i);
  const desc = descM ? descM[1] : a.desc;
  const canon = urlOf(l.u);
  const img = bigIcon(a.icon);

  const lines = [];
  if (!has(bare, /<link[^>]+rel="canonical"/i)) lines.push(`  <link rel="canonical" href="${canon}">`);
  if (!descM) lines.push(`  <meta name="description" content="${esc(desc)}">`);
  if (!has(bare, /property="og:title"/i)) lines.push(`  <meta property="og:title" content="${esc(title)}">`);
  if (!has(bare, /property="og:description"/i)) lines.push(`  <meta property="og:description" content="${esc(desc)}">`);
  if (!has(bare, /property="og:type"/i)) lines.push(`  <meta property="og:type" content="website">`);
  if (!has(bare, /property="og:url"/i)) lines.push(`  <meta property="og:url" content="${canon}">`);
  if (img && !has(bare, /property="og:image"/i)) lines.push(`  <meta property="og:image" content="${esc(img)}">`);
  if (!has(bare, /name="twitter:card"/i)) lines.push(`  <meta name="twitter:card" content="summary">`);

  const ld = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication',
    name: cleanName(a.name), description: desc, url: canon,
    applicationCategory: CATEGORY[a.cat] || 'UtilitiesApplication', operatingSystem: 'iOS',
    ...(a.date ? { datePublished: a.date } : {}),
    ...(img ? { image: img } : {}),
    ...(a.store ? { downloadUrl: a.store } : {}),
    author: { '@type': 'Person', name: 'Asagiri', url: ORIGIN + '/' },
  };
  lines.push(`  <script type="application/ld+json">${ldJson(ld)}</script>`);
  save(file, injectHead(prev, lines.join('\n')), prev);
  urls.push({ loc: canon, lastmod: a.date, pri: '0.8' });
}

/* ---------- index.html ---------- */
{
  const bare = stripBlock(indexHtml);
  const n = released.length;
  const desc = `個人開発者 Asagiri（oyajibuki）が公開中のiOSアプリ${n}本の一覧。ヘルスケア・ユーティリティ・音楽・ゲームなど、広告控えめ・アカウント不要中心のアプリをリリース順に紹介します。`;
  const lines = [
    `  <link rel="canonical" href="${ORIGIN}/">`,
    `  <meta property="og:url" content="${ORIGIN}/">`,
    `  <meta property="og:locale" content="ja_JP">`,
    `  <meta name="twitter:card" content="summary">`,
  ];
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'oyajibuki — iOSアプリ 100本チャレンジ', url: ORIGIN + '/', inLanguage: 'ja' },
    { '@context': 'https://schema.org', '@type': 'Person', name: 'Asagiri', alternateName: 'oyajibuki', url: ORIGIN + '/',
      jobTitle: 'iOS App Developer',
      sameAs: ['https://x.com/Oyajibuki', 'https://apps.apple.com/jp/developer/motoki-seki/id1895850085'] },
    { '@context': 'https://schema.org', '@type': 'ItemList', name: '公開中のiOSアプリ', numberOfItems: n,
      itemListElement: released.map((a, i) => ({
        '@type': 'ListItem', position: i + 1,
        url: intro(a) ? urlOf(intro(a).u) : a.store, name: cleanName(a.name),
      })) },
  ];
  lines.push(...ld.map(o => `  <script type="application/ld+json">${ldJson(o)}</script>`));

  let next = bare.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/i, `$1${esc(desc)}$2`);
  next = injectHead(next, lines.join('\n'));

  // JS無しでも読める静的一覧（JS が #view を丸ごと置き換える）
  const li = released.map(a => {
    const l = intro(a);
    const href = l ? l.u : a.store;
    return `      <li><a href="${esc(href)}">${esc(cleanName(a.name))}</a> — ${esc(a.cat)}｜${esc(a.desc)}</li>`;
  }).join('\n');
  const list = `<!-- seo:list:begin -->\n    <section>\n      <h2>公開中のiOSアプリ（${n}本）</h2>\n      <ul>\n${li}\n      </ul>\n    </section>\n    <!-- seo:list:end -->`;
  next = next.replace(/<main id="view">[\s\S]*?<\/main>/, `<main id="view">\n    ${list}\n  </main>`);
  save(indexPath, next, indexHtml);
  const latest = released.map(a => a.date).sort().pop();
  urls.unshift({ loc: ORIGIN + '/', lastmod: latest, pri: '1.0' });
}

/* ---------- sitemap.xml / robots.txt ---------- */
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}    <priority>${u.pri}</priority>\n  </url>`).join('\n') +
  `\n</urlset>\n`;
const robots = `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
for (const [name, body] of [['sitemap.xml', sitemap], ['robots.txt', robots]]) {
  const f = path.join(ROOT, name);
  const prev = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  save(f, body, prev);
}

/* ---------- 結果 ---------- */
console.log(WRITE ? '【書き込みモード】' : '【ドライラン】（--write で反映）');
for (const [f, s] of changes) console.log(`${s.padEnd(8)} ${path.relative(ROOT, f)}`);
console.log(`\n公開済み ${released.length} 本 / 紹介ページ ${urls.length - 1} 本 / sitemap ${urls.length} URL`);
const noIntro = released.filter(a => !intro(a)).map(a => `#${a.no} ${cleanName(a.name)}`);
if (noIntro.length) console.log(`紹介ページ無し（sitemap・JSON-LD対象外）: ${noIntro.join(' / ')}`);
