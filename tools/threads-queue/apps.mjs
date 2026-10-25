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

export const appOf = file => Object.entries(APPS).find(([, a]) => a.match.test(file))?.[0];

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
