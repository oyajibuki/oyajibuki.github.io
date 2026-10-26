/**
 * Threads に出すショートのアプリごとの設定と、投稿文（Instagram のキャプション）を Threads 用に直す処理。
 */

export const APPS = {
  danshu: {
    name: '断酒クエスト',
    match: /DanshuQuest/,
    link: 'https://apps.apple.com/app/apple-store/id6764613044?pt=128842925&ct=threads&mt=8',
    tag: '#断酒',
    // 毎日 19:00（日本時間）
    slot: { hour: 19, minute: 0, days: [0, 1, 2, 3, 4, 5, 6] },
  },
  geo: {
    name: 'ジオアラーム',
    match: /GEOAlame/,
    link: 'https://apps.apple.com/app/apple-store/id6781700974?pt=128842925&ct=threads_geo&mt=8',
    tag: '#寝過ごし',
    // 月・水・金の 7:00（日本時間）
    slot: { hour: 7, minute: 0, days: [1, 3, 5] },
  },
};

// 冒頭の問いかけ（コメントしてもらいやすいように）。その回の固定コメントの問いを使い、無いときだけここから日ごとに順番に使う
export const POOL = {
  danshu: [
    'お酒をやめて、いちばん変わったことは何ですか？',
    '「一杯だけ」と言われたとき、どう断っていますか？',
    '断酒中、いちばん飲みたくなるのはどんなときですか？',
    'お酒の代わりに、何を飲んでいますか？',
    'お酒で一番後悔している夜、ありますか？',
  ],
  geo: [
    '電車で寝過ごして、いちばん遠くまで行ったのはどこですか？',
    '通勤電車で寝る派？ 起きてる派？',
    '乗り過ごして、いちばん困った日はいつでしたか？',
    '電車で寝過ごしたこと、何回ありますか？',
  ],
};
// 毎回同じになる問い（断酒の「今日で何日目？」）とリンクの行は使わない
const GENERIC = /今日で.*何日目|http|^▼|^（|^\s*$/;

// 投稿文.md の「## 見出し」の中の「**固定コメント**」のコードブロック
function pinned(md, heading) {
  const sec = md.split(/^## /m).find(s => s.startsWith(heading));
  const m = sec && sec.match(/\*\*固定コメント\*\*[^\n]*\n```\n([\s\S]*?)\n```/);
  return m ? m[1] : null;
}
const lines = text => (text || '').split(/\n|<br>/).map(s => s.trim()).filter(s => !GENERIC.test(s));
// その回の問い。mds: 同じフォルダの投稿文.md の中身 / listMd: 断酒の「固定コメント一覧_YouTube.md」/ ep: 話の番号
// avoid: 直前の回に使った問い（同じ問いが続くと bot っぽいので避ける）
// 固定コメント（Instagram → YouTube → TikTok → 一覧）の行のうち、「？」「か。」で終わる問いを優先し、無ければ「〜ください」
export function questionFor(app, { mds = [], listMd = '', ep = 0, day = 0, avoid = [] }) {
  const cands = [];
  for (const md of mds) for (const h of ['Instagram', 'YouTube', 'TikTok']) cands.push(...lines(pinned(md, h)));
  const row = listMd.split('\n').find(l => l.startsWith(`| ${ep} |`));
  if (row) cands.push(...lines(row.split('|')[4]));
  const ok = cands.filter(s => !avoid.includes(s));
  const q = ok.find(s => /[？?]$|か。?$/.test(s)) || ok.find(s => /教えてください。?$/.test(s));
  if (q) return q;
  const pool = POOL[app];
  for (let k = 0; k < pool.length; k++) if (!avoid.includes(pool[(day + k) % pool.length])) return pool[(day + k) % pool.length];
  return pool[day % pool.length];
}
// 本文の頭に問いを付ける（本文に同じ問いがあれば、そちらは消す）
export function withQuestion(text, q) {
  const norm = s => s.replace(/[？?。、\s]/g, '');
  return `${q}\n\n${text.split('\n').filter(l => !l.trim() || norm(l) !== norm(q)).join('\n')}`.replace(/\n{3,}/g, '\n\n');
}

export const appOf =file => Object.entries(APPS).find(([, a]) => a.match.test(file))?.[0];

// 投稿文.md の「## Instagram」の最初のコードブロック（キャプション）を取り出す
export function igCaption(md) {
  const sec = md.split(/^## /m).find(s => s.startsWith('Instagram'));
  const m = sec && sec.match(/```\n([\s\S]*?)\n```/);
  return m ? m[1] : null;
}

// Instagram のキャプション → Threads の本文
// - ハッシュタグだけの行を消して、トピックタグを1つだけ最後に付ける（Threads はタグが1つしか効かない）
// - 「プロフィールのリンクから」は、本文にリンクを書く形に直す（Threads は本文のURLを押せる）
export function toThreads(caption, app) {
  const a = APPS[app];
  const lines = caption.split('\n').filter(l => !/^\s*(#\S+\s*)+$/.test(l));
  const i = lines.findIndex(l => l.includes('プロフィールのリンクから'));
  if (i >= 0) {
    lines[i] = lines[i].replace(/は?プロフィールのリンクから。?/, '');
    // 「〜は／プロフィールのリンクから。」の2行なら、1行目の「は」を落として2行目をリンクに置き換える
    if (!lines[i].trim() && i > 0) { lines[i - 1] = lines[i - 1].replace(/は$/, ''); lines[i] = a.link; }
    else lines.splice(i + 1, 0, a.link);
  } else {
    lines.push('', `▼「${a.name}」（iPhone）`, a.link);
  }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return `${lines.join('\n')}\n${a.tag}`;
}

// 日本時間の「次の枠」。after（Date）より後で、その曜日・時刻に合う最初の日時
export function nextSlot(app, after) {
  const { hour, minute, days } = APPS[app].slot;
  const jst = new Date(after.getTime() + 9 * 3600e3);
  for (let k = 0; k < 14; k++) {
    const d = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() + k, hour - 9, minute));
    if (d > after && days.includes(new Date(d.getTime() + 9 * 3600e3).getUTCDay())) return d;
  }
  throw new Error('次の枠が見つかりません');
}

export const fmtJst = d => {
  const j = new Date(d.getTime() + 9 * 3600e3);
  const p = n => String(n).padStart(2, '0');
  return `${j.getUTCFullYear()}-${p(j.getUTCMonth() + 1)}-${p(j.getUTCDate())} ${p(j.getUTCHours())}:${p(j.getUTCMinutes())}`;
};
export const parseJst = s => new Date(`${s.trim().replace(' ', 'T')}:00+09:00`);
