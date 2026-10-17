// 日本のデータパック：国の設定・ゲームパラメーター
// 統計の実数は stats.js（国勢調査・賃金構造基本統計調査ほか）。ここは制度・推定値・文言。
// 根拠と出典は docs/research.md を参照。

window.COUNTRY = {
  code: 'jp', lang: 'ja', name: '日本',
  startYear: 2026, aiYear: 2031,
  // お金の単位は万円（ほかの国はこの単位を基準に money.scale で換算）
  money: {
    scale: 1, unit: '万円', ticks: [500, 1000, 1500, 2000],
    fmt: v => v >= 10000 ? `${(v / 10000).toFixed(2)}億円` : `${Math.round(v).toLocaleString()}万円`,
  },
  fmtPeople: (n, split) => {
    const s = n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万人` : `${(Math.round(n / 10) * 10).toLocaleString()}人`
    return split ? `約${s}` : s
  },
  names: {
    family: '佐藤 鈴木 高橋 田中 伊藤 渡辺 山本 中村 小林 加藤 吉田 山田 佐々木 山口 松本 井上 木村 林 斎藤 清水 山崎 森 池田 橋本 阿部 石川 山下 中島 石井 小川 前田 岡田 長谷川 藤田 後藤 近藤 村上 遠藤 青木 坂本'.split(' '),
    given: {
      m: '翔太 蓮 大翔 悠真 湊 陽翔 健太 拓海 大輔 誠 浩二 隆 直樹 亮 和也 達也 悠斗 樹 颯太 恵介'.split(' '),
      f: '陽菜 結衣 葵 美咲 さくら 凛 芽依 恵子 由美 真由美 彩 優子 愛 千尋 美穂 遥 結菜 莉子 紬 杏'.split(' '),
    },
    full: (sex, family, given) => `${family} ${given}`,
  },
  // 管理職（大分類A）は昇進でのみ到達。課長で会社管理職員（公務員は管理的地方公務員）、役員で会社役員へ
  managerMajor: 'A',
  promo: { manager: '031', publicManager: '013', exec: '021' },
  isPublic: j => ['01', '19', '43', '44'].includes(j.mid) || ['451', '452'].includes(j.code),
  publicSize: { key: 'gov', name: '官公庁', mult: 1.05, retire: 2100 },
  seniorSize: { key: 'm', name: '地域の事業所', mult: 1, retire: 0 },
  ageLimitMids: { '43': 32 }, // 自衛官
  itMids: ['10'], farmMids: ['46'],
  // 医師・歯科医師・獣医師・薬剤師は6年制
  longSchool: { match: j => ['ishi', 'shika', 'jui', 'yakuzai'].includes(j.lic), edu: { lv: 2, name: '6年制大学卒業', age: 24, wage: 1.05 } },
  familyBiz: { job: '201', rate: 0.012, name: '実家の寺社' },
  retireAge: 60, seniorAge: 65,
  // 65〜69歳の就業率 約52%、70〜74歳 約34%、75歳以上 約11%（労働力調査）に近づける継続率
  seniorKeep: age => age <= 65 ? 0.52 : age <= 70 ? 0.45 : age <= 75 ? 0.2 : 0.12,
  irrDefault: { m: 0.22, f: 0.53 }, // 非正規率（労働力調査）
  sickPay: 0.66, parentalPay: 0.67, // 傷病手当金・育児休業給付（標準報酬の約2/3）
  classLabel: j => `${j.major}-${j.mid}-${j.code}`,
  icons: {
    major: { A: '🏛️', B: '🔬', C: '🗂️', D: '🛍️', E: '🍽️', F: '🛡️', G: '🌾', H: '🏭', I: '🚚', J: '🏗️', K: '📦', L: '❔' },
    mid: { '10': '💻', '12': '🩺', '13': '💉', '16': '🧸', '17': '⚖️', '18': '📊', '19': '📚', '21': '✍️', '22': '🎨', '23': '🎻', '36': '🤝', '38': '✂️', '39': '🍳', '44': '🚓', '46': '🌾', '48': '🎣', '61': '🚚', '62': '✈️', '71': '🧹' },
  },
  majorLabel: name => name.replace('従事者', ''),
  text: {
    'brand': '6,781万分の1',
    'brandHtml': '6,781万分の<span class="accent">1</span>',
    'home.title': '6,781万<br>分の<span class="accent">1</span>',
    'home.topline': 'v0.2 POC · 職業版 · 日本標準職業分類 329職業 · 公的統計にもとづく',
    'home.lead': 'いまこの国で、6,781万人が働いています。そのひとりになって、たった一度の仕事人生を最後まで働いてみます。最初にどんな仕事に就くかは選べません。あなたがそうだったように。',
    'home.distNote': '労働力調査 2024年平均 · 就業者 6,781万人の職業大分類',
    'home.distFoot': '大分類A（管理的職業）は昇進によってのみ到達します。',
    'home.c3': '職業別の就業者数（国勢調査）、職種別の年収・残業（賃金構造基本統計調査）、企業規模による賃金差、役職手当、資格の合格率と学習時間、離職・メンタル不調、起業の生存率。詳しくは <a href="docs/research.md" target="_blank">調査メモ</a>。',
    'c.rare': '国勢調査（2020年）で、この仕事に就いていたのは<b>{people}</b>。働く人の<b>およそ{n}人に1人</b>です。',
    'kv.peakInc': '40〜50代の年収', 'z.h.inc': '40〜50代の年収',
    'z.desc': '日本標準職業分類（総務省）の 大分類12・中分類74・小分類329 をそのままジョブツリーにしています。色のついた職業は、これまでの人生で就いたことがあるものです。中分類の右の番号は国際標準職業分類（ISCO-08）の対応です。',
    'z.src': '人数・女性の割合は<a href="https://www.e-stat.go.jp/stat-search/file-download?statInfId=000032266822&fileKind=0" target="_blank" rel="noopener">令和2年国勢調査（抽出詳細集計 第10表）</a>、年収・月の残業は<a href="https://www.e-stat.go.jp/stat-search/files?toukei=00450091&tstat=000001011429&tclass1=000001229845" target="_blank" rel="noopener">令和7年賃金構造基本統計調査（一般労働者・職種別）</a>。年収は40〜59歳の年齢階級で最も高い年収（役職者を除く水準に補正）。国勢調査がほかの職業とまとめて数えている職業は「約」をつけて按分しています。公務員は地方公務員給与実態調査・国家公務員給与等実態調査、船員は船員労働統計調査。それでも統計がない飲食店主・旅館主などは「推定」です。小分類の下のタグは、いま使われている職種名です（年収の倍率はゲーム上の目安）。',
    'z.search': '職業名で探す（例：弁護士、介護、運転）',
    'ev.senior': '{age}歳になりました。65〜69歳の約半数がなにかしらの仕事を続けています。年金を受け取りながら、地域の仕事をする道もあります。',
    'ev.seniorCheck': '{age}歳になりました。体力は{health}。70〜74歳で働いている人は約3人に1人、75歳以上では約1割です。',
    'ev.burnM': '眠っても疲れがとれず、朝が来るのがつらくなりました。働く人の8割以上が強いストレスを抱えていますが、ひとりで抱え込まなくてかまいません。',
    'log.promo.toMgr': '職業分類上は「大分類A 管理的職業従事者」になりました。',
    'ev.birth': '働き方をどうしますか。男性の育休取得率は約3割、女性は8割を超えます。長く休むほど家族との時間は増えますが、昇進やスキルには遅れが出ます。',
    'ev.care': '{who}は{age}歳。介護の期間は平均で5年ほど続きます。介護を理由に仕事を辞める人は年に約10万人います。どう向き合いますか。',
    'care.leave.s': '93日の休業で体制づくり。両立しやすい',
    'pass.pdf.note': 'この職歴は、令和2年国勢調査・令和7年賃金構造基本統計調査などの公的統計にもとづくシミュレーションです。実在の人物とは関係ありません。',
    'pass.card.foot': '国勢調査・賃金構造基本統計調査にもとづく職業シミュレーション',
  },
}

// 日本標準職業分類の中分類 → 国際標準職業分類（ISCO-08）の中分類
// 総務省の「日本標準職業分類及び国際標準職業分類の分類項目比較表」を参考に、中分類単位でいちばん近いものを当てた。
window.ISCO_MAP = {
  '01': '11', '02': '11', '03': '12', '04': '13', '05': '21', '06': '21', '07': '21', '08': '21', '09': '21', '10': '25',
  '11': '31', '12': '22', '13': '22', '14': '32', '15': '32', '16': '26', '17': '26', '18': '24', '19': '23', '20': '26',
  '21': '26', '22': '26', '23': '26', '24': '34', '25': '41', '26': '43', '27': '43', '28': '41', '29': '44', '30': '43',
  '31': '41', '32': '52', '33': '33', '34': '33', '35': '91', '36': '53', '37': '53', '38': '51', '39': '51', '40': '51',
  '41': '51', '42': '51', '43': '02', '44': '54', '45': '54', '46': '61', '47': '62', '48': '62', '49': '81', '50': '81',
  '51': '82', '52': '72', '53': '75', '54': '82', '55': '72', '56': '75', '57': '75', '58': '75', '59': '93', '60': '83',
  '61': '83', '62': '31', '63': '83', '64': '81', '65': '71', '66': '71', '67': '74', '68': '93', '69': '81', '70': '93',
  '71': '91', '72': '93', '73': '96', '99': '96',
}

// 大分類ごとの就業者数（万人）— 労働力調査 2024年平均の概数
// 専門・事務・合計（6,781万人）は JILPT 掲載値、それ以外は近年値からの概数
window.MAJOR_WORKERS = {
  A: 127, B: 1324, C: 1419, D: 840, E: 840, F: 130,
  G: 186, H: 880, I: 213, J: 276, K: 497, L: 49,
}
window.TOTAL_WORKERS = 6781

// 中分類パラメーター
// w: 大分類内での相対ウェイト / inc: 正社員・40〜50代の目安年収(万円) / ot: 月平均残業(h)
// phys: 体力負荷 0-100 / st: ストレス 0-100 / ai: AI代替リスク 0-1 / self: 自営率 0-1
// edu: 最低学歴 0=高卒 1=専門・短大 2=大卒 3=院卒 / route: 'school' なら養成課程を出ないと就けない
window.MID_PARAMS = {
  '01': { w: 3,  inc: 950,  ot: 40, phys: 15, st: 65, ai: .15, self: 0,   edu: 2, gate: 'rank' },
  '02': { w: 5,  inc: 1300, ot: 30, phys: 10, st: 70, ai: .10, self: 0,   edu: 0, gate: 'rank' },
  '03': { w: 12, inc: 900,  ot: 35, phys: 10, st: 65, ai: .20, self: 0,   edu: 0, gate: 'rank' },
  '04': { w: 1,  inc: 700,  ot: 30, phys: 15, st: 55, ai: .20, self: .2,  edu: 0, gate: 'rank' },

  '05': { w: 60,  inc: 750,  ot: 25, phys: 15, st: 55, ai: .30, self: .02, edu: 3 },
  '06': { w: 12,  inc: 560,  ot: 15, phys: 40, st: 40, ai: .30, self: .05, edu: 2 },
  '07': { w: 140, inc: 700,  ot: 25, phys: 20, st: 50, ai: .35, self: 0,   edu: 2 },
  '08': { w: 90,  inc: 600,  ot: 22, phys: 30, st: 45, ai: .40, self: 0,   edu: 1 },
  '09': { w: 95,  inc: 640,  ot: 38, phys: 45, st: 60, ai: .30, self: .1,  edu: 1 },
  '10': { w: 150, inc: 620,  ot: 25, phys: 10, st: 62, ai: .60, self: .08, edu: 1 },
  '11': { w: 15,  inc: 580,  ot: 20, phys: 30, st: 45, ai: .40, self: .05, edu: 1 },
  '12': { w: 80,  inc: 1200, ot: 60, phys: 55, st: 75, ai: .15, self: .15, edu: 2, route: 'school' },
  '13': { w: 170, inc: 510,  ot: 12, phys: 70, st: 75, ai: .08, self: 0,   edu: 1, route: 'school' },
  '14': { w: 70,  inc: 480,  ot: 12, phys: 45, st: 50, ai: .25, self: .02, edu: 1, route: 'school' },
  '15': { w: 25,  inc: 380,  ot: 8,  phys: 55, st: 40, ai: .15, self: .4,  edu: 1, route: 'school' },
  '16': { w: 110, inc: 380,  ot: 8,  phys: 50, st: 60, ai: .10, self: 0,   edu: 1 },
  '17': { w: 9.5, inc: 900,  ot: 35, phys: 10, st: 70, ai: .35, self: .5,  edu: 2 },
  '18': { w: 25,  inc: 750,  ot: 30, phys: 10, st: 60, ai: .50, self: .3,  edu: 2 },
  '19': { w: 140, inc: 650,  ot: 55, phys: 40, st: 70, ai: .15, self: 0,   edu: 2, route: 'school' },
  '20': { w: 5,   inc: 350,  ot: 10, phys: 20, st: 30, ai: .05, self: .6,  edu: 0 },
  '21': { w: 12,  inc: 600,  ot: 45, phys: 20, st: 65, ai: .70, self: .3,  edu: 2 },
  '22': { w: 30,  inc: 430,  ot: 30, phys: 20, st: 55, ai: .65, self: .4,  edu: 1 },
  '23': { w: 7,   inc: 300,  ot: 20, phys: 50, st: 60, ai: .30, self: .6,  edu: 0 },
  '24': { w: 30,  inc: 400,  ot: 15, phys: 30, st: 45, ai: .40, self: .3,  edu: 1 },

  '25': { w: 800, inc: 450, ot: 12, phys: 10, st: 45, ai: .65, self: 0,   edu: 0 },
  '26': { w: 180, inc: 430, ot: 12, phys: 10, st: 45, ai: .75, self: 0,   edu: 0 },
  '27': { w: 90,  inc: 420, ot: 12, phys: 25, st: 40, ai: .60, self: 0,   edu: 0 },
  '28': { w: 200, inc: 440, ot: 14, phys: 10, st: 45, ai: .65, self: 0,   edu: 0 },
  '29': { w: 15,  inc: 380, ot: 8,  phys: 40, st: 45, ai: .50, self: .1,  edu: 0 },
  '30': { w: 50,  inc: 460, ot: 15, phys: 20, st: 45, ai: .55, self: 0,   edu: 0 },
  '31': { w: 25,  inc: 350, ot: 8,  phys: 10, st: 35, ai: .85, self: 0,   edu: 0 },

  '32': { w: 520, inc: 380, ot: 15, phys: 45, st: 55, ai: .45, self: .12, edu: 0 },
  '33': { w: 50,  inc: 520, ot: 25, phys: 20, st: 65, ai: .45, self: .3,  edu: 0 },
  '34': { w: 270, inc: 560, ot: 25, phys: 25, st: 65, ai: .35, self: .02, edu: 0 },

  '35': { w: 5,   inc: 250, ot: 0,  phys: 55, st: 40, ai: .10, self: .3,  edu: 0 },
  '36': { w: 210, inc: 360, ot: 6,  phys: 75, st: 65, ai: .08, self: 0,   edu: 0 },
  '37': { w: 50,  inc: 300, ot: 5,  phys: 55, st: 45, ai: .20, self: 0,   edu: 0 },
  '38': { w: 110, inc: 330, ot: 10, phys: 50, st: 45, ai: .10, self: .35, edu: 1 },
  '39': { w: 230, inc: 340, ot: 20, phys: 65, st: 55, ai: .15, self: .15, edu: 0 },
  '40': { w: 150, inc: 400, ot: 22, phys: 60, st: 65, ai: .15, self: .25, edu: 0 },
  '41': { w: 40,  inc: 280, ot: 3,  phys: 30, st: 25, ai: .30, self: .05, edu: 0 },
  '42': { w: 45,  inc: 330, ot: 10, phys: 40, st: 45, ai: .35, self: .15, edu: 0 },

  '43': { w: 23,  inc: 560, ot: 25, phys: 85, st: 60, ai: .10, self: 0,   edu: 0 },
  '44': { w: 30,  inc: 700, ot: 35, phys: 75, st: 70, ai: .10, self: 0,   edu: 0 },
  '45': { w: 77,  inc: 330, ot: 12, phys: 55, st: 45, ai: .40, self: .01, edu: 0 },

  '46': { w: 150, inc: 280, ot: 5,  phys: 80, st: 40, ai: .25, self: .7,  edu: 0 },
  '47': { w: 5,   inc: 350, ot: 5,  phys: 90, st: 40, ai: .20, self: .2,  edu: 0 },
  '48': { w: 15,  inc: 380, ot: 10, phys: 90, st: 50, ai: .20, self: .5,  edu: 0 },

  '49': { w: 25,  inc: 520, ot: 22, phys: 55, st: 45, ai: .50, self: 0,   edu: 0 },
  '50': { w: 55,  inc: 480, ot: 20, phys: 50, st: 45, ai: .55, self: 0,   edu: 0 },
  '51': { w: 20,  inc: 500, ot: 22, phys: 50, st: 45, ai: .60, self: 0,   edu: 0 },
  '52': { w: 90,  inc: 450, ot: 20, phys: 70, st: 45, ai: .45, self: .05, edu: 0 },
  '53': { w: 230, inc: 380, ot: 15, phys: 60, st: 45, ai: .50, self: .05, edu: 0 },
  '54': { w: 90,  inc: 450, ot: 18, phys: 55, st: 45, ai: .55, self: 0,   edu: 0 },
  '55': { w: 90,  inc: 470, ot: 18, phys: 60, st: 45, ai: .25, self: .1,  edu: 0 },
  '56': { w: 8,   inc: 450, ot: 15, phys: 45, st: 40, ai: .60, self: 0,   edu: 0 },
  '57': { w: 50,  inc: 380, ot: 12, phys: 40, st: 40, ai: .65, self: 0,   edu: 0 },
  '58': { w: 25,  inc: 450, ot: 15, phys: 40, st: 40, ai: .60, self: 0,   edu: 0 },
  '59': { w: 120, inc: 350, ot: 10, phys: 65, st: 40, ai: .50, self: .02, edu: 0 },

  '60': { w: 10,  inc: 620, ot: 15, phys: 40, st: 60, ai: .30, self: 0,   edu: 0 },
  '61': { w: 120, inc: 470, ot: 45, phys: 65, st: 60, ai: .45, self: .1,  edu: 0 },
  '62': { w: 6,   inc: 900, ot: 20, phys: 50, st: 65, ai: .20, self: 0,   edu: 1 },
  '63': { w: 15,  inc: 450, ot: 15, phys: 55, st: 45, ai: .35, self: 0,   edu: 0 },
  '64': { w: 60,  inc: 480, ot: 20, phys: 55, st: 45, ai: .40, self: .03, edu: 0 },

  '65': { w: 30,  inc: 480, ot: 20, phys: 90, st: 50, ai: .10, self: .3,  edu: 0 },
  '66': { w: 120, inc: 450, ot: 18, phys: 85, st: 45, ai: .10, self: .4,  edu: 0 },
  '67': { w: 60,  inc: 520, ot: 22, phys: 70, st: 50, ai: .15, self: .15, edu: 0 },
  '68': { w: 75,  inc: 430, ot: 20, phys: 90, st: 45, ai: .15, self: .1,  edu: 0 },
  '69': { w: 3,   inc: 450, ot: 15, phys: 95, st: 50, ai: .20, self: .05, edu: 0 },

  '70': { w: 230, inc: 380, ot: 18, phys: 75, st: 45, ai: .45, self: .03, edu: 0 },
  '71': { w: 160, inc: 260, ot: 3,  phys: 65, st: 30, ai: .25, self: .05, edu: 0 },
  '72': { w: 50,  inc: 280, ot: 5,  phys: 50, st: 30, ai: .65, self: 0,   edu: 0 },
  '73': { w: 40,  inc: 280, ot: 5,  phys: 60, st: 30, ai: .40, self: 0,   edu: 0 },

  '99': { w: 1,   inc: 350, ot: 10, phys: 40, st: 40, ai: .40, self: .1,  edu: 0, gate: 'none' },
}

// 小分類ごとの上書き（w は中分類内の相対ウェイト、未指定は 10）
window.JOB_OVERRIDES = {
  '011': { inc: 900, w: 5 }, '012': { inc: 1100, lic: 'kokuso', w: 3 }, '013': { inc: 900, lic: 'chiho', w: 8 },
  '021': { inc: 1500, w: 30 }, '031': { inc: 900, w: 40 },
  '101': { inc: 750 }, '102': { inc: 700 }, '103': { inc: 850, w: 6 }, '104': { w: 40 }, '105': { w: 12 },
  '121': { inc: 1450, w: 34, lic: 'ishi', otFixed: 60 }, '122': { inc: 900, w: 10, lic: 'shika' },
  '123': { inc: 700, w: 4, lic: 'jui' }, '124': { inc: 600, w: 32, lic: 'yakuzai', ot: 15 },
  '131': { w: 6, lic: 'kango' }, '132': { w: 4, lic: 'kango' }, '133': { w: 160, lic: 'kango' },
  '141': { lic: 'iryogishi', inc: 560 }, '144': { w: 25, lic: 'iryogishi' }, '146': { w: 15, lic: 'iryogishi' },
  '161': { w: 15, lic: 'shakaifukushi' }, '162': { w: 25 }, '163': { w: 60, lic: 'hoiku', inc: 390 },
  '171': { inc: 1200, w: 0.3, lic: 'shiho' }, '172': { inc: 1100, w: 0.2, lic: 'shiho' },
  '173': { inc: 1022, w: 4.5, lic: 'shiho', self: .7 }, '174': { inc: 900, w: 1.2, lic: 'benri' },
  '175': { inc: 750, w: 2.3, lic: 'shoshi', self: .7 }, '179': { w: 1 },
  '181': { inc: 1000, w: 3.5, lic: 'cpa' }, '182': { inc: 800, w: 8, lic: 'zeirishi', self: .5 },
  '183': { inc: 650, w: 4.5, lic: 'sharoshi', self: .5 }, '184': { w: 10, lic: 'fp' },
  '191': { inc: 400, lic: 'kyoin' }, '192': { w: 45, lic: 'kyoin' }, '193': { w: 25, lic: 'kyoin' }, '194': { w: 23, lic: 'kyoin' },
  '196': { w: 8, lic: 'kyoin' }, '198': { inc: 900, w: 19, edu: 3 },
  '211': { self: .8, inc: 450 }, '224': { w: 25 }, '245': { inc: 700, self: .6 },
  '091': { lic: 'kenchikushi', inc: 680 },
  '257': { w: 50 }, '251': { w: 25 },
  // 国勢調査は「企画事務員・秘書・その他の一般事務」を1区分で数えている。秘書は少数で、ほとんどが女性（女性比率は推計）
  '253': { w: 30 }, '255': { w: 4, female: 0.9 }, '259': { w: 66 },
  '321': { inc: 450, self: .5, w: 12 }, '323': { w: 70, inc: 340 },
  '331': { lic: 'takken', inc: 600 }, '347': { lic: 'takken', inc: 620 }, '346': { w: 20 },
  '361': { w: 160, lic: null }, '362': { w: 50, lic: 'shonin' },
  '381': { lic: 'biyou' }, '382': { w: 40, lic: 'biyou' },
  '391': { w: 60 }, '401': { inc: 420, self: .6, w: 15 }, '403': { w: 40, inc: 280 },
  '441': { w: 26, inc: 720, lic: 'keisatsu' }, '442': { w: 1.5, inc: 650 },
  '452': { w: 17, inc: 650, ot: 30, lic: 'shobo' }, '453': { w: 55, inc: 320, ot: 25 },
  '611': { lic: 'nishu', w: 12 }, '612': { lic: 'nishu', w: 25 }, '613': { lic: 'ogata', w: 85, ot: 55 },
  '621': { inc: 900, w: 2 }, '624': { inc: 1700, w: 1, lic: 'pilot' },
  '661': { w: 30 }, '666': { w: 15 },
  '671': { lic: 'denki' }, '672': { lic: 'denki' }, '674': { lic: 'denki' }, '679': { lic: 'denki', w: 25 },
  '703': { w: 25 }, '704': { w: 25 }, '705': { w: 20 },
  '711': { w: 40 }, '714': { w: 15 },
}

// 資格・アンロック条件
// study: 社会人が余暇で学習して取れる / school: 養成課程（POCでは初期配属でのみ到達）
// hours: 目安学習時間 / pass: 受験者全体の合格率 / desc: 説明
window.LICENSES = {
  shiho:    { name: '司法試験（予備試験ルート）', kind: 'study', hours: 5000, pass: 0.036, desc: '予備試験 約3.6%。3,000〜8,000時間。弁護士・裁判官・検察官の門' },
  cpa:      { name: '公認会計士試験', kind: 'study', hours: 4000, pass: 0.074, desc: '3,000〜5,000時間・合格率約7.4%。監査法人ルート' },
  zeirishi: { name: '税理士試験（5科目）', kind: 'study', hours: 3000, pass: 0.15, desc: '科目合格制。数年がかりの長期戦' },
  shoshi:   { name: '司法書士試験', kind: 'study', hours: 3000, pass: 0.05, desc: '合格率約5%。登記の独占業務' },
  benri:    { name: '弁理士試験', kind: 'study', hours: 3000, pass: 0.06, desc: '特許の独占業務。理系出身が有利' },
  sharoshi: { name: '社会保険労務士試験', kind: 'study', hours: 1000, pass: 0.065, desc: '労務の独占業務。独立も視野' },
  takken:   { name: '宅地建物取引士', kind: 'study', hours: 350, pass: 0.17, desc: '300〜400時間・合格率15〜18%。不動産営業の資格手当' },
  fp:       { name: 'FP技能士2級', kind: 'study', hours: 150, pass: 0.4, desc: '金融・保険の専門職への足がかり' },
  kokuso:   { name: '国家公務員総合職試験', kind: 'study', hours: 1500, pass: 0.34, desc: '1,500時間以上。本府省の過酷な残業が待つ', maxAge: 30 },
  chiho:    { name: '地方公務員試験', kind: 'study', hours: 800, pass: 0.3, desc: '年齢上限あり', maxAge: 35 },
  keisatsu: { name: '警察官採用試験', kind: 'study', hours: 400, pass: 0.25, desc: '体力試験あり', maxAge: 35, minHealth: 50 },
  shobo:    { name: '消防官採用試験', kind: 'study', hours: 400, pass: 0.15, desc: '体力試験あり', maxAge: 30, minHealth: 55 },
  hoiku:    { name: '保育士試験', kind: 'study', hours: 500, pass: 0.25, desc: '独学でも取れる福祉の国家資格' },
  shakaifukushi: { name: '社会福祉士', kind: 'study', hours: 600, pass: 0.5, desc: '実務経験＋養成課程' },
  shonin:   { name: '介護職員初任者研修', kind: 'study', hours: 130, pass: 0.95, desc: '訪問介護に必要な入門資格' },
  kenchikushi: { name: '一級建築士', kind: 'study', hours: 1000, pass: 0.1, desc: '実務経験を積んだ上での難関' },
  denki:    { name: '第二種電気工事士', kind: 'study', hours: 100, pass: 0.6, desc: '電気工事に必須' },
  nishu:    { name: '普通二種免許', kind: 'study', hours: 60, pass: 0.85, desc: 'タクシー・バス運転に必要' },
  ogata:    { name: '大型自動車免許', kind: 'study', hours: 60, pass: 0.85, desc: '長距離トラックの入口。年間2,500時間超の拘束' },
  ishi:     { name: '医学部6年＋医師国家試験', kind: 'school', hours: 0, pass: 0.92, desc: '養成課程が必須' },
  shika:    { name: '歯学部6年＋歯科医師国家試験', kind: 'school', hours: 0, pass: 0.65, desc: '養成課程が必須' },
  jui:      { name: '獣医学部6年＋獣医師国家試験', kind: 'school', hours: 0, pass: 0.8, desc: '養成課程が必須' },
  yakuzai:  { name: '薬学部6年＋薬剤師国家試験', kind: 'school', hours: 0, pass: 0.7, desc: '養成課程が必須' },
  kango:    { name: '看護師国家試験', kind: 'school', hours: 0, pass: 0.9, desc: '看護学校・看護大学が必須' },
  iryogishi:{ name: '医療技術系国家試験', kind: 'school', hours: 0, pass: 0.8, desc: '養成校が必須' },
  kyoin:    { name: '教員免許', kind: 'school', hours: 0, pass: 1, desc: '大学の教職課程が必須' },
  biyou:    { name: '理容師・美容師免許', kind: 'school', hours: 0, pass: 0.85, desc: '養成施設2年が必須' },
  pilot:    { name: '事業用操縦士', kind: 'school', hours: 0, pass: 0.9, desc: '航空大学校・自社養成' },
}

// 役職（会社員のみ）— 中間管理職の平均年収 係長639/課長847/部長1,017万円
window.RANKS = [
  { name: '一般', mult: 1.0 },
  { name: '主任', mult: 1.05 },
  { name: '係長', mult: 1.12, salary: 639 },
  { name: '課長', mult: 1.35, salary: 847 },
  { name: '部長', mult: 1.6, salary: 1017 },
  { name: '役員', mult: 2.2 },
]

// 企業規模（生涯賃金で大企業と小企業に約1.4倍差）
window.COMPANY_SIZES = [
  { key: 'xl', name: '従業員1,000人以上', w: 30, mult: 1.15, retire: 2000 },
  { key: 'l',  name: '従業員100〜999人',  w: 27, mult: 1.0,  retire: 1300 },
  { key: 'm',  name: '従業員10〜99人',   w: 28, mult: 0.85, retire: 800 },
  { key: 's',  name: '従業員9人以下',    w: 15, mult: 0.75, retire: 300 },
]

// 学歴（入職時の年齢）
// wage: 同じ職業の中での学歴による賃金差。職種別の年収は全学歴の平均なので、その上下を掛ける
//（賃金構造基本統計調査の学歴別賃金で、同一職種内の差が全体差より小さいことをふまえた目安）
window.EDUCATION = [
  { lv: 0, name: '高校卒業', age: 18, w: 22, wage: 0.85 },
  { lv: 1, name: '専門学校・短大卒業', age: 20, w: 22, wage: 0.92 },
  { lv: 2, name: '大学卒業', age: 22, w: 48, wage: 1.05 },
  { lv: 3, name: '大学院修了', age: 24, w: 8, wage: 1.12 },
]

// ---------- ライフイベント（結婚・出産・介護・転勤） ----------
window.LIFE_PARAMS = {
  // 住む場所（人口のおおよその比重）
  places: [
    { name: '東京', w: 14 }, { name: '神奈川', w: 9 }, { name: '大阪', w: 9 }, { name: '愛知', w: 7 },
    { name: '埼玉', w: 6 }, { name: '千葉', w: 5 }, { name: '兵庫', w: 4 }, { name: '北海道', w: 4 },
    { name: '福岡', w: 4 }, { name: '静岡', w: 3 }, { name: '広島', w: 2 }, { name: '宮城', w: 2 },
    { name: '京都', w: 2 }, { name: '新潟', w: 2 }, { name: '長野', w: 1.6 }, { name: '岡山', w: 1.5 },
    { name: '熊本', w: 1.4 }, { name: '沖縄', w: 1.2 }, { name: '石川', w: 0.9 }, { name: '鳥取', w: 0.4 },
  ],
  // 結婚の年あたり確率（〜歳まで）。50歳時未婚率 男性約28%・女性約18% に近づくよう調整
  marriageRate: [
    { to: 24, p: 0.04 }, { to: 29, p: 0.11 }, { to: 34, p: 0.09 }, { to: 39, p: 0.05 },
    { to: 49, p: 0.02 }, { to: 64, p: 0.006 },
  ],
  // 子どもの人数ごとの年あたり出生確率（夫婦の完結出生児数 約1.9人）
  birthRate: [0.38, 0.28, 0.09, 0.02],
  // 大企業・官公庁の正社員が転勤の内示を受ける年あたり確率
  transferRate: 0.035,
  // 第一子出産を機に仕事を辞める女性の割合（約3割）
  quitAfterBirth: 0.3,
  // おまかせのときの育休の取り方（男性の取得率 約3割、女性 8割超）
  autoBirth: (sex, r) => sex === 'f' ? (r < 0.55 ? 'long_short' : r < 0.85 ? 'long' : 'short') : (r < 0.3 ? 'short' : r < 0.33 ? 'long' : 'none'),
  // 介護の向き合い方（load: 時間の圧迫 / mental・health: 年あたりの消耗 / cost: 年あたりの自己負担 万円）
  careModes: {
    self:     { load: 1.0, mental: 7, health: 3, cost: 15 },
    leave:    { load: 0.55, mental: 3.5, health: 1.5, cost: 30 },
    facility: { load: 0.2, mental: 2, health: 0.5, cost: 150 },
    quit:     { load: 1.2, mental: 5, health: 3, cost: 10 },
  },
}

// ---------- 65歳からの仕事（シニア就労） ----------
// 65〜69歳の就業率 約52%、70〜74歳 約34%、75歳以上 約11%（労働力調査）
// w: シニアの求人での出やすさ / need: 条件（familyBiz = 実家が寺社）
window.SENIOR_JOBS = [
  { code: '453', w: 14, note: '工事現場や駐車場の交通誘導' },
  { code: '414', w: 8,  note: '駐車場の整理・管理' },
  { code: '711', w: 14, note: 'ビルや施設の清掃' },
  { code: '713', w: 5,  note: '道路・公園の清掃' },
  { code: '714', w: 5,  note: 'ごみ収集・処理' },
  { code: '411', w: 8,  note: 'マンションの管理人' },
  { code: '413', w: 4,  note: 'ビルの管理人' },
  { code: '461', w: 9,  note: '畑や田んぼ' },
  { code: '463', w: 3,  note: '植木・造園' },
  { code: '612', w: 4,  note: 'タクシー・送迎ドライバー', lic: 'nishu' },
  { code: '705', w: 4,  note: '新聞・荷物の配達' },
  { code: '323', w: 6,  note: 'スーパーや商店の売り場' },
  { code: '361', w: 5,  note: '介護施設の補助' },
  { code: '403', w: 3,  note: '飲食店のホール' },
  { code: '244', w: 2,  note: '塾や習い事の講師', edu: 2 },
  { code: '201', w: 30, note: '実家の寺社を継ぐ', need: 'familyBiz' },
]

// ---------- 職種名（日本標準職業分類の小分類の中の、いま実際に使われている呼び名） ----------
// 統計は小分類単位までしかないため、職種名ごとの差はゲーム上の目安。
// w: 小分類の中での出やすさ / mult: 小分類の年収（統計）に対する倍率 / ai: AI代替リスク（低いほどAIの普及で得をする）
// meta: true の職種は、メタスキルが高いほど求人が来やすい
window.JOB_VARIANTS = {
  '101': [
    { name: 'ITコンサルタント', w: 5, mult: 1.0, ai: 0.35 },
    { name: 'DXコンサルタント', w: 3, mult: 1.0, ai: 0.3 },
    { name: 'AXコンサルタント', w: 2, mult: 1.1, ai: 0.1, meta: true, note: 'AIで業務を作り変える（AI Transformation）支援' },
  ],
  '102': [
    { name: 'システムアーキテクト', w: 4, mult: 1.0, ai: 0.35 },
    { name: 'クラウドアーキテクト', w: 3, mult: 1.05, ai: 0.25 },
    { name: 'ソリューションアーキテクト', w: 2, mult: 1.05, ai: 0.25 },
  ],
  '103': [
    { name: 'プロジェクトマネージャー（PM）', w: 6, mult: 1.0, ai: 0.2 },
    { name: 'PMO', w: 2, mult: 0.9, ai: 0.45 },
    { name: 'スクラムマスター', w: 1, mult: 0.95, ai: 0.3 },
  ],
  '104': [
    { name: '業務系SE・プログラマー', w: 20, mult: 0.95, ai: 0.65 },
    { name: 'バックエンドエンジニア', w: 14, mult: 1.0, ai: 0.55 },
    { name: 'フロントエンドエンジニア', w: 8, mult: 0.97, ai: 0.6 },
    { name: 'フルスタックエンジニア', w: 5, mult: 1.05, ai: 0.45 },
    { name: 'スマホアプリエンジニア', w: 5, mult: 1.0, ai: 0.55 },
    { name: '組込みエンジニア', w: 8, mult: 1.0, ai: 0.45 },
    { name: 'ゲームプログラマー', w: 3, mult: 0.95, ai: 0.5 },
    { name: 'QA・テストエンジニア', w: 5, mult: 0.9, ai: 0.75 },
    { name: 'データエンジニア', w: 3, mult: 1.1, ai: 0.35 },
    { name: '機械学習エンジニア', w: 4, mult: 1.2, ai: 0.2, meta: true },
    { name: 'AXエンジニア', w: 3, mult: 1.2, ai: 0.05, meta: true, note: '生成AIを業務やプロダクトに組み込み、仕事のやり方そのものを変える' },
    { name: 'FDE（Forward Deployed Engineer）', w: 3, mult: 1.25, ai: 0.1, meta: true, note: '顧客の現場に入り込み、自社のAI・ソフトウェアを実装して成果まで持っていく' },
  ],
  '105': [
    { name: '社内SE・情報システム担当', w: 8, mult: 0.95, ai: 0.5 },
    { name: 'インフラエンジニア', w: 6, mult: 1.0, ai: 0.5 },
    { name: 'クラウドエンジニア', w: 5, mult: 1.1, ai: 0.35 },
    { name: 'データベースエンジニア', w: 3, mult: 1.05, ai: 0.45 },
    { name: 'SRE', w: 2, mult: 1.15, ai: 0.3 },
    { name: '運用・監視オペレーター', w: 4, mult: 0.8, ai: 0.8 },
  ],
  '106': [
    { name: 'ネットワークエンジニア', w: 5, mult: 1.0, ai: 0.45 },
    { name: '通信インフラエンジニア', w: 2, mult: 1.0, ai: 0.4 },
  ],
  '109': [
    { name: 'セキュリティエンジニア', w: 3, mult: 1.1, ai: 0.25 },
    { name: 'データサイエンティスト', w: 2, mult: 1.15, ai: 0.3, meta: true },
    { name: 'プロダクトマネージャー', w: 2, mult: 1.15, ai: 0.15, meta: true, note: '何を作るかを決める人。日本標準職業分類では「その他の情報処理・通信技術者」などに入る' },
    { name: 'ヘルプデスク・テクニカルサポート', w: 4, mult: 0.8, ai: 0.8 },
  ],
  '224': [
    { name: 'グラフィックデザイナー', w: 5, mult: 1.0, ai: 0.7 },
    { name: 'Webデザイナー', w: 4, mult: 0.95, ai: 0.7 },
    { name: 'UI/UXデザイナー', w: 2, mult: 1.1, ai: 0.4 },
    { name: 'プロダクトデザイナー', w: 2, mult: 1.05, ai: 0.35 },
    { name: 'インテリア・空間デザイナー', w: 2, mult: 1.0, ai: 0.45 },
    { name: 'ファッションデザイナー', w: 1, mult: 1.0, ai: 0.5 },
  ],
}
