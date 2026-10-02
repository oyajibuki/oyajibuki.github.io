#!/usr/bin/env node
/**
 * App Store の URL / ID から、APPS に貼る値を取り出す。
 *
 *   node tools/app-meta.mjs <App Store URL または ID> [...]
 *
 * 取得の段取り（この順で落ちる）:
 *   1. ストアページの HTTP ステータスを見る
 *      404 → まだ配信されていない。exit 1 で止める。
 *           「審査通過」と「配信開始」は別物で、手動リリース待ち／配信日が未来の可能性が高い
 *   2. iTunes Lookup API（最優先。配信日まで取れる）
 *   3. API 未反映なら、ストアページの JSON-LD にフォールバック
 *      公開直後は API の索引が遅れて、ページだけ 200 になることがある。
 *      このとき releaseDate は取れないので、日付は別途確認すること
 */

const GENRE_JA = {
  'Lifestyle': 'ライフスタイル', 'Utilities': 'ユーティリティ', 'Music': 'ミュージック',
  'Health & Fitness': 'ヘルスケア', 'Productivity': '仕事効率化', 'Photo & Video': '写真/ビデオ',
  'Social Networking': 'ソーシャルネットワーキング', 'Games': 'ゲーム', 'Navigation': 'ナビゲーション',
  'Education': '教育', 'Finance': 'ファイナンス', 'Entertainment': 'エンターテインメント',
  'Business': 'ビジネス', 'Travel': '旅行', 'Food & Drink': 'フード/ドリンク',
  'Reference': '辞書/辞典/その他', 'Medical': 'メディカル', 'Weather': '天気',
  'Sports': 'スポーツ', 'News': 'ニュース', 'Books': 'ブック', 'Shopping': 'ショッピング',
  'Developer Tools': 'デベロッパツール', 'Graphics & Design': 'グラフィック/デザイン',
};
const LD_JA = {
  GameApplication: 'ゲーム', UtilitiesApplication: 'ユーティリティ',
  LifestyleApplication: 'ライフスタイル', MusicApplication: 'ミュージック',
  HealthApplication: 'ヘルスケア', BusinessApplication: '仕事効率化',
  MultimediaApplication: '写真/ビデオ', SocialNetworkingApplication: 'ソーシャルネットワーキング',
  TravelApplication: '旅行', EducationalApplication: '教育', FinanceApplication: 'ファイナンス',
};
const ICON_PREFIX = 'https://is1-ssl.mzstatic.com/image/thumb/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

const idOf = arg => (String(arg).match(/id(\d+)/) || String(arg).match(/^(\d+)$/) || [])[1];

async function storeStatus(id) {
  const r = await fetch(`https://apps.apple.com/jp/app/id${id}`, {
    redirect: 'follow', headers: { 'User-Agent': UA },
  });
  return r.status;
}

async function fromApi(id) {
  const r = await fetch(`https://itunes.apple.com/lookup?id=${id}&country=jp`);
  const d = await r.json().catch(() => ({ resultCount: 0 }));
  if (!d.resultCount) return null;
  const a = d.results[0];
  return {
    source: 'api',
    name: a.trackName,
    cat: GENRE_JA[a.primaryGenreName] ?? a.primaryGenreName,
    icon: a.artworkUrl100,
    date: a.releaseDate.slice(0, 10),
    store: a.trackViewUrl.replace(/\?.*$/, ''),
  };
}

async function fromJsonLd(id) {
  const html = await (await fetch(`https://apps.apple.com/jp/app/id${id}`, {
    redirect: 'follow', headers: { 'User-Agent': UA },
  })).text();
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let d; try { d = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')); } catch { continue; }
    if (!['SoftwareApplication', 'MobileApplication'].includes(d['@type'])) continue;
    return {
      source: 'jsonld',
      name: d.name,
      cat: LD_JA[d.applicationCategory] ?? d.applicationCategory,
      // 1200x630wa.png（OGP用）で入っているので、一覧で使う 100x100bb.jpg に直す
      icon: String(d.image || '').replace(/\/[^/]+$/, '/100x100bb.jpg'),
      date: null,
      store: d.url || `https://apps.apple.com/jp/app/id${id}`,
    };
  }
  return null;
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('使い方: node tools/app-meta.mjs <App Store URL または ID> [...]');
  process.exit(2);
}

let failed = false;
for (const arg of args) {
  const id = idOf(arg);
  if (!id) { console.error(`✗ IDを取り出せません: ${arg}`); failed = true; continue; }

  const status = await storeStatus(id);
  if (status === 404) {
    console.error(`\n✗ id${id}: ストアページが 404。まだ配信されていません。`);
    console.error('  「審査通過（eligible for distribution）」は配信開始の通知ではありません。');
    console.error('  App Store Connect で「リリース準備完了」のままになっていないか、');
    console.error('  配信開始日が未来に設定されていないか確認してください。');
    failed = true; continue;
  }
  if (status !== 200) { console.error(`✗ id${id}: ストアページが HTTP ${status}`); failed = true; continue; }

  const meta = (await fromApi(id)) ?? (await fromJsonLd(id));
  if (!meta) { console.error(`✗ id${id}: API・JSON-LD のどちらからも取得できませんでした`); failed = true; continue; }

  const iconExpr = meta.icon.startsWith(ICON_PREFIX)
    ? `ICON+'${meta.icon.slice(ICON_PREFIX.length)}'`
    : `'${meta.icon}'`;

  console.log(`\n── id${id}  [${meta.source === 'api' ? 'iTunes API' : 'ストアページのJSON-LD（API未反映）'}]`);
  console.log(`    name:'${meta.name}', cat:'${meta.cat}', date:'${meta.date ?? '???'}', status:'released',`);
  console.log(`    icon:${iconExpr},`);
  console.log(`    store:'${meta.store}',`);
  if (!meta.date) {
    console.log('  ⚠ API 未反映のため配信日が取れていません。');
    console.log('    ストアページが 404 から 200 に変わったのを確認した日を使い、');
    console.log('    後日 API が反映されたら照合すること。');
  }
}
process.exit(failed ? 1 : 0);
