// キャリアシミュレーションのエンジン（UIに依存しない）
// プレイヤーと「同期」の両方をこのエンジンで1年ずつ進める。
// 国ごとの違い（職業ツリー・統計・制度）は data/countries/<国>/ の COUNTRY などから受け取る。
(function () {
  const C = window.COUNTRY
  const J = window.OCC, MP = window.MID_PARAMS || {}, OV = window.JOB_OVERRIDES || {}, LIC = window.LICENSES
  const START_YEAR = C.startYear, AI_YEAR = C.aiYear
  // お金の定数は日本（万円）を基準に書き、国ごとの倍率を掛ける
  const M = v => v * C.money.scale
  const money = v => C.money.fmt(v)

  // ---------- 乱数ユーティリティ ----------
  const rnd = Math.random
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v))
  const pick = arr => arr[Math.floor(rnd() * arr.length)]
  function weighted(items, wf) {
    const ws = items.map(wf), sum = ws.reduce((a, b) => a + b, 0)
    let r = rnd() * sum
    for (let i = 0; i < items.length; i++) { if ((r -= ws[i]) < 0) return items[i] }
    return items[items.length - 1]
  }
  function gauss() { return Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd()) }

  // ---------- 職業テーブル ----------
  // 人数・女性比率・非正規率・自営率・年収などは国別の統計（JOB_STATS）。
  // 体力負荷・ストレス・AIリスクは、中分類ごとの値（MID_PARAMS）か、なければ ISCO の中分類の値を使う。
  const ST = (window.JOB_STATS && window.JOB_STATS.jobs) || {}
  const ST_TOTAL = (window.JOB_STATS && window.JOB_STATS.meta.total_workers) || 0
  function midParams(code) {
    const isco = (window.ISCO_MAP || {})[code]
    return { w: 10, inc: 0, self: 0.05, edu: 0, ...(window.ISCO_PARAMS[isco] || {}), ...(MP[code] || {}), isco }
  }
  // 生まれつきの気質（メンタル）と体質（体力）。ゲーム上のばらつきで、統計の数字ではない
  // stress / drain は消耗の倍率、rec は毎年の回復の上乗せ、start は最初の値の上乗せ
  const TRAITS = {
    mind: [
      { key: 'steel', w: 8, stress: 0.45, rec: 3, start: 15 },
      { key: 'tough', w: 17, stress: 0.75, rec: 1, start: 8 },
      { key: 'normal', w: 55, stress: 1, rec: 0, start: 0 },
      { key: 'sensitive', w: 20, stress: 1.2, rec: 0, start: -5 },
    ],
    body: [
      { key: 'robust', w: 12, drain: 0.6, start: 8, sick: 0 },
      { key: 'normal', w: 73, drain: 1, start: 0, sick: 0 },
      { key: 'frail', w: 15, drain: 1.3, start: -8, sick: 0.05 },
    ],
    // 仕事への向き合い方。真面目な人は腕が上がり昇進しやすいが抱え込みやすい。不真面目な人はその逆
    work: [
      { key: 'diligent', w: 20, skill: 1.25, promo: 1.35, stress: 1.1, rel: 1, pay: 1.03 },
      { key: 'normal', w: 60, skill: 1, promo: 1, stress: 1, rel: 0, pay: 1 },
      { key: 'lax', w: 20, skill: 0.7, promo: 0.45, stress: 0.8, rel: -1, pay: 0.93 },
    ],
  }
  const traitFx = (p, k) => TRAITS[k].find(x => x.key === ((p.trait || {})[k] || 'normal'))

  const JOBS = {}
  for (const Mj of J.majors) {
    const mids = Mj.mids.map(c => J.mids[c])
    const midW = mids.reduce((a, m) => a + midParams(m.code).w, 0)
    for (const mid of mids) {
      const mp = midParams(mid.code)
      const jobW = mid.jobs.reduce((a, j) => a + ((OV[j.code] && OV[j.code].w) ?? 10), 0)
      for (const j of mid.jobs) {
        const o = OV[j.code] || {}
        const w = o.w ?? 10
        const s = ST[j.code] || {}
        const estShare = window.MAJOR_WORKERS ? (window.MAJOR_WORKERS[Mj.code] / window.TOTAL_WORKERS) * (mp.w / midW) * (w / jobW) : 0
        JOBS[j.code] = {
          code: j.code, name: j.name, label: s.short || j.name, mid: mid.code, midName: mid.name, major: Mj.code, majorName: Mj.name, isco: o.isco || mp.isco,
          share: s.workers != null && ST_TOTAL ? s.workers / ST_TOTAL : estShare,
          workers: s.workers ?? null, split: !!s.split,
          inc: s.inc ?? o.inc ?? mp.inc, incAvg: s.avg ?? null, y0: s.y0 ?? null,
          ot: o.otFixed ?? s.ot ?? o.ot ?? Math.round(mp.ot * (MP[mid.code] && MP[mid.code].ot != null ? 1 : (C.otScale ?? 1))),
          phys: o.phys ?? mp.phys, st: o.st ?? mp.st, ai: o.ai ?? mp.ai,
          self: s.self ?? o.self ?? mp.self, female: o.female ?? s.female ?? 0.45,
          irr: s.irr_m != null ? { m: s.irr_m, f: s.irr_f } : null,
          sexW: { m: s.sex_m ?? (C.sexWage || {}).m ?? 1, f: s.sex_f ?? (C.sexWage || {}).f ?? 1 },
          eduDist: s.eduDist || null,
          incSrc: s.inc == null ? 'est' : (s.src || 'stat'), wageName: s.wage || null,
          edu: o.edu ?? s.eduMin ?? mp.edu, route: o.route ?? mp.route, gate: o.gate ?? mp.gate,
          lic: o.lic === undefined ? null : o.lic,
        }
      }
    }
  }
  const JOB_LIST = Object.values(JOBS)
  // 入職時に引ける職業（管理職は昇進でのみ到達、分類不能は除外）
  const ENTRY_JOBS = JOB_LIST.filter(j => !j.gate && j.inc > 0)
  // 自営業の所得で職業差をつけるときの基準（年収の中央値）
  const MEDIAN_INC = (() => { const a = JOB_LIST.map(j => j.inc).filter(v => v > 0).sort((x, y) => x - y); return a[Math.floor(a.length / 2)] || 1 })()

  // ---------- 職種名（JOB_VARIANTS） ----------
  const VAR = window.JOB_VARIANTS || {}
  for (const code in VAR) if (JOBS[code]) JOBS[code].variants = VAR[code]
  const isMgr = code => JOBS[code].major === C.managerMajor && JOBS[code].gate === 'rank'
  // 管理職になっても職種名と年収のベースは出身職種
  const baseCode = p => (isMgr(p.job) && p.flags.preManager ? p.flags.preManager : p.job)
  const variantOf = (code, name) => (VAR[code] || []).find(v => v.name === name) || null
  // メタスキルが高いほど、AX・FDE・機械学習などの職種に就きやすい
  function pickVariant(code, meta = 40) {
    const vs = VAR[code]
    if (!vs) return null
    return weighted(vs, v => v.w * (v.meta ? Math.pow(Math.max(0.3, meta / 50), 2) : 1)).name
  }
  const vInfo = p => variantOf(baseCode(p), p.variant)
  // 画面に出す職業名（職種名があればそちら）
  // 文章で使う職業名（label: 単数形の短い名前。日本は正式名と同じ）
  function title(p) {
    if (isMgr(p.job)) return JOBS[p.job].label
    return p.variant || JOBS[p.job].label
  }
  // ---------- 働き方の細かい区分 ----------
  // 非正規の内訳（総務省「労働力調査」2022年：パート48.6%＋アルバイト21.6%、派遣社員7.1%、契約社員・嘱託・その他が残り）
  // pay は非正規の年収に掛ける倍率（ゲームの推定）
  const IRR = [
    { key: 'part', w: 70.2, pay: 0.92 },
    { key: 'keiyaku', w: 22.7, pay: 1.12 },
    { key: 'haken', w: 7.1, pay: 1.15 },
  ]
  const irrPay = p => (IRR.find(x => x.key === (p.irr || 'part')) || IRR[0]).pay
  const pickIrr = () => weighted(IRR, x => x.w).key
  // 働き方の名前。人（または求人）を渡すと、フリーター・派遣・社長などまで出し分ける
  function empName(x, age) {
    if (typeof x === 'string') return t('emp.' + x)
    const a = age != null ? age : x.age
    if (x.emp === 'irregular') {
      const k = x.irr || 'part'
      return t(k === 'part' && a <= 34 ? 'emp.freeter' : 'emp.' + k)
    }
    if (x.emp === 'self' && x.corp) return t('emp.corp')
    if (x.emp === 'self' && x.netCareer) return t('emp.net')
    return t('emp.' + x.emp)
  }
  // 役職の名前（バイトリーダー・社長も出す）
  function rankName(p) {
    if (p.emp === 'self' && p.corp) return t('rank.ceo')
    if (p.emp === 'irregular' && p.flags && p.flags.leader) return t('rank.leader')
    return window.RANKS[p.rank].name
  }

  // ---------- ネットの副業・ギグワーク ----------
  // creator（YouTuber・ブロガー・アフィリエイター）は「レベル」が上下する。ほとんどの人は月数千円のまま、ごく一部だけが大きく稼ぐ
  // （アフィリエイト市場調査では、収入が月1,000円未満の人が多数派）。gig（フードデリバリー）はやった分だけの安定した収入
  // ---------- 夢の仕事（職業を選んで働くモード） ----------
  // 役者・歌手・プロスポーツ選手は、アルバイトをしながら挑戦し、まれにチャンスをつかむ。
  // 「それで食べている人」の数は国勢調査（俳優・音楽家・職業スポーツ従事者）。かなう確率と年収の段階はゲームの推定
  const DREAMS = {
    actor: { job: '233', until: 35, chance: 0.006, lv: [[50, 150], [300, 300], [800, 1200], [5000, 25000]], up: [0.08, 0.04, 0.015], drop: 0.07 },
    singer: { job: '231', until: 35, chance: 0.005, lv: [[50, 150], [300, 300], [800, 1200], [5000, 25000]], up: [0.08, 0.04, 0.015], drop: 0.07 },
    // サッカー：J3 → J2 → J1 → 海外・日本代表。多くは20代で引退する
    athlete: { job: '245', until: 24, chance: 0.015, lv: [[200, 200], [400, 500], [1000, 3000], [5000, 25000]], up: [0.15, 0.1, 0.03], drop: 0, retire: [24, 34] },
    youtuber: { net: true, until: 40 },
    founder: { self: true },
  }
  const DREAM_KEYS = Object.keys(DREAMS)
  const dreamIncome = p => { const d = DREAMS[p.dreamCareer], [lo, w] = d.lv[p.dreamLv || 0]; return M(lo + rnd() * w) }
  // 夢を追うあいだのアルバイト先（学歴を問わず、非正規の多い仕事から）
  const BASE_JOBS = () => ENTRY_JOBS.filter(j => !j.lic && !(j.edu > 0) && j.route !== 'school' && (j.irr ? (j.irr.m + j.irr.f) / 2 : 0) >= 0.4)
 const SAVE_RATE = C.saveRate ?? 0.045, SAVE_GROWTH = C.saveGrowth ?? 0.003, INVEST_GROWTH = C.investGrowth ?? 0.045, INVESTOR_SHARE = C.investorShare ?? 0.3
 // FIRE を考えられる貯金の目安（ゲームの推定。質素に暮らす年間の生活費の約25年分）
  const FIRE_SAVE = M(C.fireSave || 5500)
  const NET_KINDS = [['youtuber', 3], ['blogger', 2], ['affiliate', 2], ['gig', 4]]
  const NET_LV = [[0, 10], [10, 90], [100, 400], [800, 2500], [10000, 90000]] // [最低, 幅]（万円/年）。最上段はトップ層（年収1億円〜）
  const netYear = p => {
    if (p.netKind === 'gig') return M(30 + rnd() * 90)
    const [lo, w] = NET_LV[p.netLv || 0]
    return M(lo + rnd() * w)
  }
  function netLevelStep(p) {
    if (p.netKind === 'gig') return
    const lv = p.netLv || 0, boost = 0.5 + p.meta / 100
    const up = [0.12, 0.05, 0.04, 0.05][lv] || 0
    if (lv < 4 && rnd() < up * boost) { p.netLv = lv + 1; addLog(p, t('log.netUp' + (lv + 1), { kind: t('net.' + p.netKind) }), 'up') }
    else if (lv > 0 && rnd() < 0.1) { p.netLv = lv - 1; addLog(p, t('log.netDown', { kind: t('net.' + p.netKind) }), 'bad') }
  }

  // ---------- 誕生（入職） ----------
  function create(opts = {}) {
    // 性別を選んだときは、その性別で働く人の数に比例して職業を引く。選ばないときは職業を引いてから、その職業の女性比率で性別を決める
    const pickSex = opts.sex === 'm' || opts.sex === 'f' ? opts.sex : null
    const dream = DREAMS[opts.dream] ? opts.dream : null
    if (dream && !DREAMS[dream].self) opts = { ...opts, job: weighted(BASE_JOBS(), j => j.share).code }
    const job = opts.job ? JOBS[opts.job] : weighted(ENTRY_JOBS, j => j.share * (pickSex ? (pickSex === 'f' ? j.female : 1 - j.female) : 1))
    const sex = pickSex || (rnd() < job.female ? 'f' : 'm')
    let edu
    if (C.longSchool && C.longSchool.match(job)) edu = C.longSchool.edu
    else if (job.eduDist) edu = weighted(window.EDUCATION, e => job.eduDist[e.lv] || 0.0001) // 職業ごとの学歴の分布（実数）
    else edu = weighted(window.EDUCATION.filter(e => e.lv >= job.edu), e => e.w)
    const isPublic = C.isPublic(job)
    // 自営率・非正規率は職業×性別の実数。高齢者を含む数字なので、入職時は少し割り引く
    const isSelf = dream ? !!DREAMS[dream].self : !isPublic && rnd() < job.self * 0.4
    const irrRate = job.irr ? job.irr[sex] : C.irrDefault[sex]
    const irregular = dream ? !DREAMS[dream].self : !isPublic && !isSelf && rnd() < irrRate * (edu.lv >= 2 ? 0.6 : 0.9)
    const size = isPublic ? C.publicSize : weighted(window.COMPANY_SIZES, s => s.w)
    const p = {
      id: Math.random().toString(36).slice(2, 8),
      name: opts.name || C.names.full(sex, pick(C.names.family), pick(C.names.given[sex])), sex, edu,
      age: edu.age, year: START_YEAR, startAge: edu.age,
      job: job.code, origin: job.code, size,
      emp: isPublic ? 'public' : isSelf ? 'self' : irregular ? 'irregular' : 'regular',
      rank: 0, yearsInJob: 0, yearsInMid: 0, workYears: 0,
      health: 80 + Math.round(rnd() * 15), mental: 70 + Math.round(rnd() * 20),
      skill: 10, meta: 20 + Math.round(rnd() * 20), rel: 50,
      savings: Math.round(M(30)), income: 0, lifetime: 0, aiMult: 1,
      licenses: job.lic ? [job.lic] : [], study: { target: null, hours: 0 },
      focus: 'rest', jobsHeld: [job.code], history: [], log: [],
      ended: false, endReason: null, flags: {}, peakRank: 0, auto: !!opts.auto,
      sideJob: null, leave: 0, unemployed: false, selfYears: 0,
    }
    if (p.emp === 'irregular') p.irr = dream ? 'part' : pickIrr()
    if (dream) { p.dream = dream; p.dreamYears = 0; p.chosen = true; if (DREAMS[dream].net) { p.netKind = 'youtuber'; p.netLv = 0; p.netYears = 0 } }
    p.startDream = dream
    p.saveRate = SAVE_RATE * Math.exp(gauss() * 0.7 - 0.2); p.investor = rnd() < INVESTOR_SHARE
    p.trait = { mind: weighted(TRAITS.mind, x => x.w).key, body: weighted(TRAITS.body, x => x.w).key, work: weighted(TRAITS.work, x => x.w).key }
    p.mental = clamp(p.mental + traitFx(p, 'mind').start); p.health = clamp(p.health + traitFx(p, 'body').start)
    p.flags.familyBiz = (C.familyBiz && (job.code === C.familyBiz.job || rnd() < C.familyBiz.rate)) || false
    p.variant = pickVariant(job.code, p.meta)
    p.titles = [title(p)]
    window.Life.init(p)
    p.income = calcIncome(p)
    addLog(p, t('log.firstJob', { place: p.place, edu: p.edu.name, size: p.size.name, ni: t(p.emp === 'self' ? 'c.de' : 'c.ni'), emp: empName(p), title: title(p) }))
    if (p.startDream) addLog(p, t(p.startDream === 'founder' ? 'log.founderStart' : 'log.dreamStart', { dream: t('dream.' + p.startDream) }), 'life')
    return p
  }

  // ---------- 収入 ----------
  // 年齢カーブ：大企業は50代前半まで上がり続け、小企業は早めに頭打ち
  // y0: 若手の年収÷働き盛りの年収（職業ごとの実数）
  function ageCurve(age, sizeKey, y0 = 0.65) {
    const small = sizeKey === 's' || sizeKey === 'm'
    const peak = small ? 48 : 53
    const startRatio = Math.min(0.95, y0 + (small ? 0.06 : 0))
    if (age <= peak) return startRatio + (1 - startRatio) * Math.pow(Math.max(0, age - 18) / (peak - 18), 0.9)
    if (age < 60) return 1 - (age - peak) * 0.01
    return 0.65
  }
  function calcIncome(p) {
    if (p.unemployed) return 0
    const j = JOBS[baseCode(p)]
    const skillF = 0.92 + p.skill / 500
    const vm = vInfo(p) ? vInfo(p).mult : 1
    if (p.dreamCareer) return Math.round(dreamIncome(p))
    if (p.emp === 'self' && p.netCareer) return Math.round(netYear(p) * (p.corp ? 1.05 : 1))
    if (p.emp === 'self') return Math.round(selfIncome(p, j) * vm * (p.corp ? 1.05 : 1))
    let base = vm * j.inc * p.size.mult * ageCurve(p.age, p.size.key, j.y0 ?? 0.65) * skillF * p.aiMult * (p.edu.wage ?? 1) * j.sexW[p.sex]
    if (p.emp === 'irregular') base = vm * j.inc * 0.55 * (0.9 + Math.min(p.workYears, 15) / 100) * p.aiMult * irrPay(p) * (p.flags && p.flags.leader ? 1.08 : 1)
    if (p.emp === 'rehired') base *= 0.6
    if (p.emp === 'senior') base = j.inc * 0.45 * (p.age < 70 ? 1 : 0.85)
    if (p.shortTime > 0) base *= 0.8 // 時短勤務
    base *= traitFx(p, 'work').pay // 査定・賞与の差
    base *= window.RANKS[p.rank].mult
    return Math.round(base * 10) / 10 >= 100 ? Math.round(base) : Math.round(base * 10) / 10
  }

  // 自営業の所得
  // 国の統計（JOB_STATS.meta.self_income）があればその分布から引く。なければ雇用者の年収をもとにばらつかせる。
  const SELF = window.JOB_STATS && window.JOB_STATS.meta.self_income
  function quantile(cdf, q) {
    let prev = [0, cdf[0][1]]
    for (const [cq, v] of cdf) {
      if (q <= cq) return prev[1] + (v - prev[1]) * ((q - prev[0]) / Math.max(1e-6, cq - prev[0]))
      prev = [cq, v]
    }
    return cdf[cdf.length - 1][1]
  }
  function selfIncome(p, j) {
    const exp = Math.min(1.2, 0.5 + p.yearsInMid / 12)
    if (SELF && SELF.farm && (C.farmMids || []).includes(j.mid)) return Math.max(M(30), SELF.farm * exp * Math.exp(gauss() * 0.45) * p.aiMult)
    if (SELF && SELF.biz) {
      const q = clamp(0.2 + Math.min(p.yearsInMid, 25) / 50 + (p.skill - 50) / 300 + gauss() * 0.15, 0.005, 0.99)
      const occ = Math.sqrt(clamp(j.inc / MEDIAN_INC, 0.6, 1.8))
      return Math.max(M(50), quantile(SELF.biz, q) * occ * p.aiMult)
    }
    return Math.max(M(80), j.inc * exp * (0.92 + p.skill / 500) * Math.exp(gauss() * 0.35) * p.aiMult)
  }

  // ---------- ログ ----------
  function addLog(p, text, kind = '') { p.log.push({ age: p.age, year: p.year, text, kind }) }

  // ---------- 職業の条件判定 ----------
  function eligible(p, j) {
    if (j.gate || !(j.inc > 0)) return false
    if (j.edu > p.edu.lv) return false
    if (j.lic && !p.licenses.includes(j.lic)) return false
    if (j.route === 'school' && !p.licenses.includes(j.lic) && JOBS[p.origin].mid !== j.mid) return false
    const lim = (C.ageLimitMids || {})[j.mid]
    if (lim && p.age > lim) return false
    return true
  }

  // 求人（転職オファー）を作る
  function makeOffers(p, n = 3) {
    const cur = JOBS[baseCode(p)]
    const pool = JOB_LIST.filter(j => j.code !== p.job && eligible(p, j))
    const ageF = p.age < 35 ? 1 : p.age < 45 ? 0.7 : p.age < 55 ? 0.45 : 0.25
    const offers = []
    const tries = Math.max(1, Math.round(n * ageF + rnd()))
    for (let i = 0; i < tries && pool.length; i++) {
      const j = weighted(pool, x => x.share * (x.mid === cur.mid ? 25 : x.major === cur.major ? 5 : 1) * (x.lic && p.licenses.includes(x.lic) ? 30 : 1))
      if (offers.find(o => o.job === j.code)) continue
      const size = weighted(window.COMPANY_SIZES, s => s.w * (p.skill > 60 && s.key === 'xl' ? 2 : 1))
      // 夢をあきらめて27歳以降に就職する人は、アルバイトの経験しかないので正社員の求人が少ない（ゲームの推定）
      const late = p.flags.dreamGaveUp && p.age >= 27 ? 0.35 : 0
      const emp = rnd() < (p.age > 45 ? 0.45 : 0.2) + late ? 'irregular' : 'regular'
      const irr = emp === 'irregular' ? pickIrr() : null
      const keepRank = j.major === cur.major && p.rank > 0 ? Math.max(0, p.rank - 1) : 0
      const variant = pickVariant(j.code, p.meta)
      const trial = { ...p, job: j.code, variant, size, emp, irr, corp: false, netCareer: null, rank: Math.min(keepRank, 3), skill: transferSkill(p, j), flags: {}, unemployed: false, leave: 0, shortTime: 0 }
      offers.push({ job: j.code, variant, size, emp, irr, rank: trial.rank, income: calcIncome(trial) })
    }
    return offers
  }
  function transferSkill(p, j) {
    const cur = JOBS[baseCode(p)]
    return Math.round(p.skill * (j.mid === cur.mid ? 0.85 : j.major === cur.major ? 0.5 : 0.2) + p.meta * 0.15)
  }

  // シニアの求人
  function makeSeniorOffers(p) {
    const pool = window.SENIOR_JOBS.filter(s => JOBS[s.code] && (!s.need || p.flags.familyBiz) && (!s.lic || p.licenses.includes(s.lic)) && (!s.edu || p.edu.lv >= s.edu) && s.code !== p.job)
    const out = []
    for (let i = 0; i < 6 && out.length < 3 && pool.length; i++) {
      const s = weighted(pool, x => x.w * (JOBS[x.code].mid === JOBS[p.job].mid ? 3 : 1))
      if (out.find(o => o.job === s.code)) continue
      const biz = s.need === 'familyBiz'
      const o = { job: s.code, note: s.note, emp: biz ? 'self' : 'senior', rank: 0, variant: null,
        size: biz ? { key: 's', name: C.familyBiz.name, mult: 1, retire: 0 } : C.seniorSize }
      o.income = biz ? Math.round(JOBS[s.code].inc * 0.8) : calcIncome({ ...p, ...o, skill: 20, shortTime: 0, flags: {}, unemployed: false, leave: 0 })
      out.push(o)
    }
    return out
  }

  function changeJob(p, offer, why) {
    const j = JOBS[offer.job], cur = JOBS[baseCode(p)]
    p.skill = transferSkill(p, j)
    if (j.mid !== cur.mid) p.yearsInMid = 0
    p.job = offer.job; p.size = offer.size; p.emp = offer.emp; p.rank = offer.rank || 0
    p.irr = offer.emp === 'irregular' ? (offer.irr || pickIrr()) : null
    // 夢を追っている途中、またはプロとして活動中に別の仕事に移ったら、夢・現役はそこで終わり
    if (p.dreamCareer) { p.flags.dreamDone = p.dreamCareer; p.dreamCareer = null }
    if (p.dream) { p.flags.dreamGaveUp = p.dream; p.dream = null }
    p.flags.preManager = null; p.flags.leader = false; p.corp = false; p.netCareer = null
    p.variant = offer.variant !== undefined ? offer.variant : pickVariant(offer.job, p.meta)
    p.yearsInJob = 0; p.unemployed = false; p.rel = 45
    // 家を失ったところから、もう一度働きはじめた
    if (p.flags.homeless && !p.flags.rebuilt) { p.flags.rebuilt = true; addLog(p, t('log.rebuilt'), 'up') }
    p.unYears = 0
    if (!p.jobsHeld.includes(j.code)) p.jobsHeld.push(j.code)
    if (!p.titles.includes(title(p))) p.titles.push(title(p))
    p.income = calcIncome(p)
    addLog(p, t('log.change', { why, title: title(p), size: offer.size.name, emp: empName(p), money: money(p.income) }), 'change')
  }

  // ---------- 1年進める ----------
  // 戻り値: 決断が必要なイベントの配列（UI側で選ばせる / auto ならその場で解決）
  function step(p) {
    if (p.ended) return []
    const events = []
    p.age++; p.year++; p.workYears++; p.yearsInJob++; p.yearsInMid++
    if (p.emp === 'self') p.selfYears++
    const j = JOBS[p.job]
    const f = p.focus

    // 休職中
    if (p.leave > 0) {
      p.leave--
      p.lifetime += Math.round(p.income * C.sickPay) // 休職中の所得補償（国の制度による）
      p.health = clamp(p.health + 15); p.mental = clamp(p.mental + 25)
      addLog(p, t(p.leave > 0 ? 'log.leaveCont' : 'log.leaveBack'), 'leave')
      window.Life.step(p, events, { idle: true })
      finishYear(p)
      return resolveAuto(p, events)
    }
    // 育休中
    if (p.parental > 0) {
      p.parental--
      p.lifetime += Math.round(p.income * C.parentalPay)
      p.mental = clamp(p.mental + 3); p.family.bond = clamp(p.family.bond + 10)
      addLog(p, t('log.parental'), 'life')
      window.Life.step(p, events, { idle: true })
      finishYear(p)
      return resolveAuto(p, events)
    }
    if (p.unemployed) {
      p.income = 0
      p.unYears = (p.unYears || 0) + 1
      // 旅に出ている1年は、心は削られない
      if (!(p.flags.traveler && p.unYears === 1)) p.mental = clamp(p.mental - (p.careQuit ? 1 : 4))
      p.savings -= Math.round(M(120)) // 働いていなくても生活費はかかる
      // 失業が何年も続き、貯金も尽きると、まれに住む家を失う
      // （厚生労働省「ホームレスの実態に関する全国調査（概数調査）」2025年1月：全国2,591人。とてもまれ）
      if (!p.flags.homeless && p.unYears >= 3 && p.savings < 0 && rnd() < 0.25) {
        p.flags.homeless = true; p.mental = clamp(p.mental - 15); p.health = clamp(p.health - 10)
        addLog(p, t('log.homeless'), 'bad')
      }
      if (p.age >= C.seniorAge) events.push({ type: 'senior', idle: true })
      else if (!p.careQuit) events.push({ type: 'hunt', offers: makeOffers(p, 4), forced: true })
      window.Life.step(p, events, { idle: true })
      finishYear(p)
      return resolveAuto(p, events)
    }

    // 残業とリソース消費
    let ot = j.ot * (p.emp === 'irregular' ? 0.4 : 1) * (f === 'work' ? 1.4 : 1) + (p.rank >= 3 ? 10 : 0)
    if (p.emp === 'self') ot += 15
    if (p.emp === 'senior') ot *= 0.2
    ot *= window.Life.otMult(p)
    p.lastOt = ot
    const ageDrain = (p.age > 45 ? (p.age - 45) * 0.12 : 0) + (p.age >= 65 ? (p.age - 64) * 0.6 : 0)
    const fxB = traitFx(p, 'body'), fxM = traitFx(p, 'mind'), fxW = traitFx(p, 'work')
    p.health = clamp(p.health - (j.phys * 0.08 + ot * 0.12 + ageDrain) * fxB.drain + 5 + (f === 'rest' ? 9 : 0) - (f === 'side' || f === 'study' ? 3 : 0))
    let stress = j.st * 0.11 + ot * 0.16 + (p.rel < 35 ? 4 : 0) + (p.emp === 'irregular' ? 3 : 0) + (p.emp === 'self' ? 2 : 0)
    if ((C.itMids || []).includes(j.mid)) stress += 1.5 // 情報通信業はメンタル不調の休業率が高い
    p.mental = clamp(p.mental - stress * fxM.stress * fxW.stress + 4 + fxM.rec + (f === 'rest' ? 6 : 0) + (f === 'play' ? 11 : 0) - (f === 'study' ? 2 : 0))

    // スキル・メタスキル・人間関係
    p.skill = clamp(p.skill + 7 * (1 - p.skill / 110) * (f === 'work' ? 1.4 : 1) * fxW.skill)
    p.meta = clamp(p.meta + (f === 'meta' ? 7 : f === 'side' ? 3 : 0.8) - (p.age > 50 && f !== 'meta' ? 0.5 : 0))
    p.rel = clamp(p.rel + (rnd() - 0.45) * 12 + (f === 'work' ? 3 : 0) + fxW.rel)

    // 収入
    p.income = calcIncome(p)
    let side = 0
    if (f === 'side' && !p.sideJob && !p.netKind && rnd() < 0.15) {
      // 副業を始める人の一部（15%）はネットの副業かギグワークを選ぶ。始めたチャンネルやブログは、副業をしない年も残る
      p.netKind = weighted(NET_KINDS, x => x[1])[0]; p.netLv = 0; p.netYears = 0
      addLog(p, t('log.netStart', { kind: t('net.' + p.netKind) }), 'side')
    }
    if (f === 'side' && p.netKind) {
      p.netYears++
      netLevelStep(p)
      side = Math.round(netYear(p))
      // 2年続けて稼げる段階なら、本業にするかを聞く
      if (p.netKind !== 'gig' && (p.netLv || 0) >= 2 && p.netYears >= 2 && p.emp !== 'self' && rnd() < 0.5) events.push({ type: 'netPro' })
    } else if (f === 'side') {
      side = Math.round(M(20 + rnd() * 60 + p.meta * 0.5))
      if (!p.sideJob) {
        p.sideJob = weighted(ENTRY_JOBS.filter(x => !x.lic && x.route !== 'school' && x.major !== j.major), x => x.share).code
        addLog(p, t('log.sideStart', { job: JOBS[p.sideJob].label }), 'side')
      }
      if (rnd() < 0.067) {
        const sj = JOBS[p.sideJob]
        const offer = { job: sj.code, size: weighted(window.COMPANY_SIZES, s => s.w), emp: 'regular', rank: 0, variant: null }
        offer.income = calcIncome({ ...p, ...offer, skill: 35, flags: {}, unemployed: false, leave: 0, shortTime: 0 })
        events.push({ type: 'sideOffer', offer })
      }
    } else if (p.sideJob && f !== 'side') {
      p.sideJob = null
    }
    // ネットが本業の人は、毎年レベルが上下する
    if (p.netCareer && p.emp === 'self') netLevelStep(p)
    // 情報商材を売る側に回った人：数年は稼げるが、炎上して返金騒ぎになることが多い
    if (p.flags.infoSeller) {
      side += Math.round(M(50 + rnd() * 250))
      if (rnd() < 0.3) {
        p.flags.infoSeller = false; p.flags.burned = true
        p.savings -= Math.round(M(100)); p.rel = clamp(p.rel - 15); p.mental = clamp(p.mental - 10)
        addLog(p, t('log.infoBurn'), 'bad')
      }
    }
    // バイトリーダー：同じ職場でアルバイトを続けると任される
    if (p.emp === 'irregular' && (p.irr || 'part') === 'part' && !p.flags.leader && p.yearsInJob >= 2 && rnd() < 0.15) {
      p.flags.leader = true; p.flags.everLeader = true
      addLog(p, t('log.leader'), 'up')
    }
    // 法人化：個人で稼げるようになった自営業は、会社をつくって社長になる道がある
    if (p.emp === 'self' && !p.corp && p.selfYears >= 3 && p.income >= M(700) && rnd() < 0.35) events.push({ type: 'corp' })
    // 夢の仕事を追う
    if (p.dream && !p.dreamCareer) dreamStep(p, events)
    else if (p.dreamCareer) dreamCareerStep(p)
    // 夢のある道（まれ）：旅人・会社の売却・FIRE
    if (!p.unemployed && !p.flags.traveled && p.age >= 22 && p.age <= 35 && rnd() < 0.012) events.push({ type: 'travel' })
    if (p.emp === 'self' && p.corp && !p.flags.exit && p.selfYears >= 4 && rnd() < 0.015 * (0.5 + p.skill / 100)) events.push({ type: 'exit' })
    if (!p.flags.fireAsked && p.age >= 35 && p.age <= 55 && p.savings >= FIRE_SAVE) events.push({ type: 'fire' })
    // ネットワークビジネス・情報商材の誘い（まれ）
    if (!p.unemployed && p.age >= 22 && p.age <= 60) {
      if (!p.flags.mlm && rnd() < 0.012) events.push({ type: 'mlm' })
      else if (!p.flags.scheme && rnd() < 0.012) events.push({ type: 'scheme' })
    }
    p.lifetime += p.income + side
    // 貯金：収入の一部を貯め、たまった分は少しずつ増える（運用）。
    // 率は、引退時の資産の分布が総務省「家計調査（貯蓄・負債編）」と野村総研の資産階層の推計に近くなるように合わせた値
    // 貯める割合は人によって大きく違い、投資をする人の資産は増えやすい
    p.savings += Math.round(p.income * (p.saveRate ?? SAVE_RATE) + side * 0.5 - (f === 'play' ? M(25) : 0))
    if (p.savings > 0) p.savings = Math.round(p.savings * (1 + (p.investor ? INVEST_GROWTH : SAVE_GROWTH)))

    // 資格の勉強
    if (f === 'study' && p.study.target) {
      const free = Math.max(80, 700 * (1 - ot / 90)) * (0.6 + p.health / 250) * window.Life.freeMult(p)
      p.study.hours += Math.round(free)
      const L = LIC[p.study.target]
      if (p.study.hours >= L.hours) events.push({ type: 'exam', lic: p.study.target })
    }

    // 昇進（正社員・公務員のみ）
    if ((p.emp === 'regular' || p.emp === 'public') && p.rank < 5) {
      const needAge = [0, 26, 31, 38, 45, 52][p.rank + 1]
      const base = [0, 0.2, 0.07, 0.016, 0.02, 0.006][p.rank + 1]
      const sizeOk = p.rank + 1 < 5 || ['xl', 'l', 'gov'].includes(p.size.key)
      const chance = base * Math.min(1.25, p.skill / 60) * (0.5 + p.rel / 100) * (f === 'work' ? 1.6 : 1) * (p.emp === 'public' ? 1.1 : 1) * window.Life.promoMult(p) * fxW.promo
      if (p.age >= needAge && sizeOk && rnd() < chance) events.push({ type: 'promo', to: p.rank + 1 })
    }

    // AI普及イベント（1回）
    if (p.year === AI_YEAR) {
      const ai = vInfo(p) ? vInfo(p).ai : j.ai
      if (ai <= 0.15) {
        // AIを使う側の職種は、普及の波に乗って価値が上がる
        p.aiMult = Math.round((1 + (0.2 - ai) * (0.6 + p.meta / 100)) * 100) / 100
        p.skill = clamp(p.skill + 8)
        addLog(p, t('log.aiUp', { title: title(p) }), 'ai')
      } else {
        const loss = ai * (1 - p.meta / 130)
        p.aiMult = Math.round((1 - loss * 0.35) * 100) / 100
        p.skill = clamp(p.skill - loss * 35)
        addLog(p, loss > 0.3 ? t('log.aiDown', { title: title(p) }) : t(p.meta >= 50 ? 'log.aiMeta' : 'log.aiSmall'), 'ai')
      }
    }

    // ランダムな出来事
    if (rnd() < 0.08) {
      const ev = pick([
        ['rand.boss', () => { p.rel = clamp(p.rel + (rnd() < 0.5 ? -15 : 12)) }],
        ['rand.bigwin', () => { p.skill = clamp(p.skill + 6); p.rel = clamp(p.rel + 5) }],
        ['rand.conflict', () => { p.rel = clamp(p.rel - 18); p.mental = clamp(p.mental - 8) }],
        ['rand.mentor', () => { p.meta = clamp(p.meta + 4); p.mental = clamp(p.mental - 3) }],
        ['rand.sick', () => { p.health = clamp(p.health - 10) }],
      ])
      ev[1](); addLog(p, t(ev[0]))
    } else if (rnd() < fxB.sick) {
      // 病弱な体質は、ほかの出来事とは別に体調を崩しやすい
      p.health = clamp(p.health - 10); addLog(p, t('rand.sick'))
    }
    episode(p)

    // 倒産・リストラ・自営の廃業
    if (p.emp === 'self') {
      const failRate = p.flags.expStart ? 0.01 : 0.26 // 経験分野の起業は5年生存95%、未経験は22%
      if (p.selfYears <= 5 && rnd() < failRate) {
        addLog(p, t('log.bizFail'), 'bad')
        p.savings -= Math.round(M(200)); p.unemployed = true; p.emp = 'regular'
      }
    } else if (p.emp !== 'public' && rnd() < (p.size.key === 's' ? 0.012 : 0.004) + (p.age >= 50 ? 0.006 : 0)) {
      addLog(p, t(p.emp === 'senior' ? 'log.contractEnd' : p.age >= 50 ? 'log.earlyRetire' : 'log.bankrupt'), 'bad')
      p.unemployed = true
    }

    // 独立の誘い
    if (!p.unemployed && p.emp !== 'self' && j.self >= 0.2 && p.yearsInMid >= 3 && p.age < 58 && rnd() < 0.06) {
      events.push({ type: 'indep' })
    }

    // 転職活動
    if (f === 'hunt' && !p.unemployed) events.push({ type: 'hunt', offers: makeOffers(p, 3) })

    // 家族（結婚・出産・介護・転勤）
    window.Life.step(p, events)

    // メンタル・体力の限界
    if (p.mental < 15 || p.health < 12) events.push({ type: 'burnout', cause: p.mental < 15 ? 'mental' : 'health' })

    // 定年（制度のある国だけ）
    if (C.retireAge && p.age === C.retireAge && (p.emp === 'regular' || p.emp === 'public')) events.push({ type: 'retire60' })
    // シニアの働き方
    if (p.age === C.seniorAge && p.emp !== 'self' && p.emp !== 'senior') events.push({ type: 'senior' })
    else if (p.age >= 70 && p.age % 5 === 0) events.push({ type: 'senior', check: true })
    if (p.age >= 66 && p.health < 18) events.push({ type: 'end', cause: 'health' })
    if (p.age >= 85) events.push({ type: 'end' })

    finishYear(p)
    return resolveAuto(p, events)
  }

  function finishYear(p) {
    p.peakRank = Math.max(p.peakRank, p.rank)
    p.history.push({ age: p.age, year: p.year, income: p.income, job: p.job, title: isMgr(p.job) ? (p.variant || JOBS[baseCode(p)].name) : title(p), rank: p.rank, health: p.health, mental: p.mental })
  }

  // ---------- 決断 ----------
  // 各イベントの選択肢を返す。choose(p, ev, key) で適用。
  function options(p, ev) {
    if (window.Life.TYPES.includes(ev.type)) return window.Life.options(p, ev)
    const R = window.RANKS
    switch (ev.type) {
      case 'senior': {
        if (!ev.offers) ev.offers = makeSeniorOffers(p)
        const canStay = (p.emp === 'rehired' && p.age === C.seniorAge) || (ev.check && !p.unemployed)
        // 仕事がない状態で迎えた年は「仕事を探すか」、5歳ごとは「まだ働くか」、最初の年は「シニアの働き方」
        const kind = ev.idle ? 'ev.seniorIdle' : ev.check ? 'ev.seniorCheck' : 'ev.senior'
        return {
          title: t(kind + '.t', { age: p.age }),
          text: t(kind, { age: p.age, health: Math.round(p.health) }),
          choices: [
            ...(canStay ? [{ key: 'cont', label: p.emp !== 'rehired' ? t('ev.senior.cont') : p.age < 70 ? t('ev.senior.contRehired') : t('ev.senior.contMore', { age: p.age + 5 }), sub: t('ev.incomeSub', { money: money(p.emp === 'rehired' ? p.income * 0.85 : p.income) }) }] : []),
            ...ev.offers.map((o, i) => ({ key: 'o' + i, label: JOBS[o.job].label, sub: [o.note, t(o.emp === 'self' ? 'ev.senior.familyBiz' : 'ev.senior.partTime'), t('ev.incomeSub', { money: money(o.income) })].join(t('sep')) })),
            { key: 'retire', label: t('ev.senior.retire') },
          ],
        }
      }
      case 'promo': return {
        title: t('ev.promo.t', { rank: R[ev.to].name }),
        text: t('ev.promo', { title: title(p), rank: R[ev.to].name }),
        choices: [{ key: 'yes', label: t('ev.promo.yes') }, { key: 'no', label: t('ev.promo.no') }],
      }
      case 'exam': {
        const L = LIC[ev.lic]
        return {
          title: t('ev.exam.t', { lic: L.name }),
          text: t('ev.exam', { hours: p.study.hours.toLocaleString(), pass: (L.pass * 100).toFixed(1) }),
          choices: [{ key: 'yes', label: t('ev.exam.yes') }, { key: 'no', label: t('ev.exam.no') }],
        }
      }
      case 'hunt': return {
        title: t(ev.forced ? 'ev.huntForced.t' : 'ev.hunt.t'),
        text: ev.offers.length ? t('ev.hunt', { n: ev.offers.length }) : t('ev.hunt.none'),
        choices: [
          ...ev.offers.map((o, i) => ({ key: 'o' + i, label: o.variant || JOBS[o.job].label, sub: [o.variant ? JOBS[o.job].label : null, o.size.name, empName(o, p.age), o.rank ? R[o.rank].name : null, t('ev.incomeSub', { money: money(o.income) })].filter(Boolean).join(t('sep')) })),
          { key: 'no', label: t(ev.forced ? 'ev.hunt.more' : 'ev.hunt.stay') },
        ],
      }
      case 'sideOffer': return {
        title: t('ev.side.t'),
        text: t('ev.side', { job: JOBS[ev.offer.job].label, money: money(ev.offer.income) }),
        choices: [{ key: 'yes', label: t('ev.side.yes') }, { key: 'no', label: t('ev.side.no') }],
      }
      case 'netPro': return {
        title: t('ev.netPro.t'),
        text: t('ev.netPro', { kind: t('net.' + p.netKind), n: p.netYears }),
        choices: [{ key: 'yes', label: t('ev.netPro.yes') }, { key: 'no', label: t('ev.netPro.no') }],
      }
      case 'corp': return {
        title: t('ev.corp.t'),
        text: t('ev.corp', { n: p.selfYears, money: money(p.income) }),
        choices: [{ key: 'yes', label: t('ev.corp.yes') }, { key: 'no', label: t('ev.corp.no') }],
      }
      case 'dreamQuit': return {
        title: t('ev.dreamQuit.t'), text: t(ev.forced ? 'ev.dreamQuit.forced' : 'ev.dreamQuit', { dream: t('dream.' + p.dream), n: p.dreamYears, age: p.age }),
        choices: ev.forced ? [{ key: 'yes', label: t('ev.dreamQuit.yes') }] : [{ key: 'yes', label: t('ev.dreamQuit.yes') }, { key: 'no', label: t('ev.dreamQuit.no') }],
      }
      case 'travel': return {
        title: t('ev.travel.t'), text: t('ev.travel', { title: title(p) }),
        choices: [{ key: 'yes', label: t('ev.travel.yes') }, { key: 'no', label: t('ev.travel.no') }],
      }
      case 'exit': return {
        title: t('ev.exit.t'), text: t('ev.exit', { co: p.corpName || '' }),
        choices: [{ key: 'yes', label: t('ev.exit.yes') }, { key: 'no', label: t('ev.exit.no') }],
      }
      case 'fire': return {
        title: t('ev.fire.t'), text: t('ev.fire', { money: money(p.savings), age: p.age }),
        choices: [{ key: 'yes', label: t('ev.fire.yes') }, { key: 'no', label: t('ev.fire.no') }],
      }
      case 'mlm': return {
        title: t('ev.mlm.t'), text: t('ev.mlm'),
        choices: [{ key: 'yes', label: t('ev.mlm.yes') }, { key: 'no', label: t('ev.mlm.no') }],
      }
      case 'scheme': return {
        title: t('ev.scheme.t'), text: t('ev.scheme'),
        choices: [{ key: 'yes', label: t('ev.scheme.yes') }, { key: 'no', label: t('ev.scheme.no') }],
      }
      case 'indep': return {
        title: t('ev.indep.t'),
        text: t('ev.indep', { title: title(p), n: p.yearsInMid, risk: t(p.yearsInMid >= 5 ? 'ev.indep.safe' : 'ev.indep.risky') }),
        choices: [{ key: 'yes', label: t('ev.indep.yes') }, { key: 'no', label: t('ev.indep.no') }],
      }
      case 'burnout': return {
        title: t(ev.cause === 'mental' ? 'ev.burnM.t' : 'ev.burnH.t'),
        text: t(ev.cause === 'mental' ? 'ev.burnM' : 'ev.burnH'),
        choices: [{ key: 'leave', label: t('ev.burn.leave') }, { key: 'quit', label: t('ev.burn.quit') }, { key: 'push', label: t('ev.burn.push') }],
      }
      case 'retire60': return {
        title: t('ev.retire.t', { age: C.retireAge }),
        text: t('ev.retire'),
        choices: [{ key: 'stay', label: t('ev.retire.stay') }, { key: 'retire', label: t('ev.retire.leave') }],
      }
      case 'end': return { title: t('ev.end.t'), text: t('ev.end'), choices: [{ key: 'ok', label: t('ev.end.ok') }] }
    }
  }

  function choose(p, ev, key) {
    if (window.Life.TYPES.includes(ev.type)) return window.Life.choose(p, ev, key)
    const j = JOBS[p.job], R = window.RANKS
    switch (ev.type) {
      case 'senior': {
        if (key === 'retire') { end(p, t('end.retire', { age: p.age })); break }
        if (key === 'cont') {
          if (p.emp === 'rehired') { p.income = Math.round(p.income * 0.85); p.flags.extended = true }
          addLog(p, t('log.contSenior', { age: p.age }))
          break
        }
        const o = ev.offers[+key.slice(1)]
        changeJob(p, o, t('why.senior', { age: p.age }))
        if (o.emp === 'self') { p.flags.expStart = true; addLog(p, t('log.familyBiz', { biz: C.familyBiz.name }), 'change') }
        p.flags.senior = true
        break
      }
      case 'promo':
        if (key === 'yes') {
          p.rank = ev.to
          let extra = ''
          // 管理職になると、職業分類上も管理的職業に移る
          if (ev.to === 3 && !isMgr(p.job)) {
            p.flags.preManager = p.job
            const to = p.emp === 'public' ? C.promo.publicManager : C.promo.manager
            p.job = to; if (!p.jobsHeld.includes(to)) p.jobsHeld.push(to)
            extra = t('log.promo.toMgr')
          }
          if (ev.to === 5) { p.job = C.promo.exec; if (!p.jobsHeld.includes(C.promo.exec)) p.jobsHeld.push(C.promo.exec) }
          p.income = calcIncome(p)
          addLog(p, t('log.promo', { rank: R[ev.to].name, money: money(p.income), extra }), 'up')
        } else addLog(p, t('log.promoNo', { rank: R[ev.to].name }))
        break
      case 'exam': {
        if (key !== 'yes') break
        const L = LIC[ev.lic]
        const chance = Math.min(0.85, L.pass * 2.2 * (1 + p.meta / 150))
        if (rnd() < chance) {
          p.licenses.push(ev.lic); p.study = { target: null, hours: 0 }; p.focus = 'rest'
          addLog(p, t('log.pass', { lic: L.name }), 'up')
          p.mental = clamp(p.mental + 15)
        } else {
          p.study.hours = Math.round(p.study.hours * 0.75)
          addLog(p, t('log.fail', { lic: L.name }), 'bad')
          p.mental = clamp(p.mental - 8)
        }
        break
      }
      case 'hunt': {
        const i = key.startsWith('o') ? +key.slice(1) : -1
        if (i >= 0) changeJob(p, ev.offers[i], t(ev.forced ? 'why.forced' : 'why.hunt'))
        if (p.focus === 'hunt') p.focus = 'rest'
        break
      }
      case 'sideOffer':
        if (key === 'yes') { changeJob(p, ev.offer, t('why.side')); p.sideJob = null; p.focus = 'rest' }
        break
      case 'netPro':
        if (key === 'yes') {
          p.emp = 'self'; p.rank = 0; p.selfYears = 0; p.yearsInJob = 0; p.netCareer = p.netKind; p.corp = false; p.flags.leader = false
          if (p.dream === 'youtuber') { p.dreamCareerNet = true; p.dream = null }
          p.variant = t('net.' + p.netKind)
          if (!p.titles.includes(p.variant)) p.titles.push(p.variant)
          p.focus = 'rest'; p.income = calcIncome(p)
          addLog(p, t('log.netPro', { kind: p.variant }), 'change')
        }
        break
      case 'corp':
        if (key === 'yes') {
          p.corp = true
          p.corpName = t('corp.name', { fam: String(p.name).split(' ')[0] })
          p.savings -= Math.round(M(25)); p.income = calcIncome(p)
          addLog(p, t('log.corp', { co: p.corpName }), 'up')
        }
        break
      case 'dreamQuit':
        if (key === 'yes') {
          addLog(p, t('log.dreamQuit', { dream: t('dream.' + p.dream), n: p.dreamYears }), 'change')
          p.flags.dreamGaveUp = p.dream; p.dream = null
          if (p.netKind && !p.netCareer) p.netKind = null
          p.focus = 'hunt' // 翌年から就職活動
        }
        break
      case 'travel':
        p.flags.traveled = true
        if (key === 'yes') {
          p.flags.traveler = true
          p.savings -= Math.round(M(150)); p.mental = clamp(p.mental + 30); p.health = clamp(p.health + 10)
          p.unemployed = true
          addLog(p, t('log.travel', { place: pick(t('travel.places').split('|')) }), 'life')
        }
        break
      case 'exit':
        p.flags.exit = true
        if (key === 'yes') {
          // 多くは数千万〜数億円。ごくまれに上場級（数十億〜百億円）
          const r = rnd()
          const gain = Math.round(M(r < 0.02 ? 200000 + rnd() * 800000 : r < 0.15 ? 20000 + rnd() * 180000 : 3000 + rnd() * 17000))
          p.savings += gain; p.lifetime += gain; p.flags.exitGain = gain
          addLog(p, t('log.exit', { co: p.corpName || '', money: money(gain) }), 'up')
        } else addLog(p, t('log.exitNo'))
        break
      case 'fire':
        p.flags.fireAsked = true
        if (key === 'yes') { p.flags.fire = true; end(p, t('end.fire', { age: p.age })) }
        break
      case 'mlm':
        p.flags.mlm = true
        if (key === 'yes') {
          if (rnd() < 0.05) { p.savings += Math.round(M(60)); addLog(p, t('log.mlmWin'), 'up') }
          else {
            const loss = Math.round(M(40 + rnd() * 120))
            p.savings -= loss; p.rel = clamp(p.rel - 12); p.mental = clamp(p.mental - 5); p.flags.mlmLost = true
            addLog(p, t('log.mlmLose', { money: money(loss) }), 'bad')
          }
        } else addLog(p, t('log.mlmNo'))
        break
      case 'scheme':
        p.flags.scheme = true
        if (key === 'yes') {
          const loss = Math.round(M(20 + rnd() * 40))
          p.savings -= loss
          if (rnd() < 0.1) { p.flags.infoSeller = true; addLog(p, t('log.schemeSell', { money: money(loss) }), 'side') }
          else addLog(p, t('log.schemeLose', { money: money(loss) }), 'bad')
        } else addLog(p, t('log.schemeNo'))
        break
      case 'indep':
        if (key === 'yes') {
          p.emp = 'self'; p.rank = 0; p.selfYears = 0; p.flags.expStart = p.yearsInMid >= 5
          if (p.flags.preManager) { p.job = p.flags.preManager; p.flags.preManager = null }
          p.savings -= Math.round(M(150)); p.income = calcIncome(p)
          addLog(p, t('log.indep', { title: title(p) }), 'change')
        }
        break
      case 'burnout':
        if (key === 'leave') { p.leave = 1; addLog(p, t('log.leave'), 'leave') }
        else if (key === 'quit') { p.unemployed = true; p.health = clamp(p.health + 20); p.mental = clamp(p.mental + 25); addLog(p, t('log.quit'), 'bad') }
        else { p.mental = clamp(p.mental - 5); if (p.mental <= 3 || p.health <= 3) { p.leave = 2; addLog(p, t('log.collapse'), 'bad') } }
        break
      case 'retire60':
        if (key === 'stay') { p.emp = 'rehired'; p.rank = 0; p.income = calcIncome(p); addLog(p, t('log.rehired', { money: money(p.income) })) }
        else end(p, t('end.mandatory', { age: C.retireAge }))
        break
      case 'end': end(p, t(p.emp === 'self' ? 'end.retire' : 'end.leave', { age: p.age })); break
    }
  }

  // おまかせの判断
  function autoChoice(p, ev) {
    if (window.Life.TYPES.includes(ev.type)) return window.Life.autoChoice(p, ev)
    switch (ev.type) {
      case 'senior': {
        options(p, ev)
        const keep = C.seniorKeep(p.age)
        if (p.health < 30 || rnd() > keep) return 'retire'
        if ((p.emp === 'rehired' && p.age === C.seniorAge) || (ev.check && !p.unemployed)) return rnd() < 0.6 ? 'cont' : (ev.offers.length ? 'o0' : 'cont')
        return ev.offers.length ? 'o' + Math.floor(rnd() * ev.offers.length) : 'retire'
      }
      case 'promo': return p.mental > 35 ? 'yes' : 'no'
      case 'exam': return 'yes'
      case 'hunt': {
        if (!ev.offers.length) return 'no'
        let best = -1, bi = 0
        ev.offers.forEach((o, i) => { if (o.income > best) { best = o.income; bi = i } })
        return ev.forced || best > p.income * 1.08 ? 'o' + bi : 'no'
      }
      case 'sideOffer': return ev.offer.income > p.income ? 'yes' : 'no'
      case 'indep': return p.yearsInMid >= 5 && rnd() < 0.4 ? 'yes' : 'no'
      case 'netPro': return rnd() < 0.5 ? 'yes' : 'no'
      case 'travel': return rnd() < 0.3 ? 'yes' : 'no'
      case 'dreamQuit': return ev.forced || rnd() < 0.35 ? 'yes' : 'no'
      case 'exit': return rnd() < 0.7 ? 'yes' : 'no'
      case 'fire': return rnd() < 0.5 ? 'yes' : 'no'
      case 'corp': return rnd() < 0.6 ? 'yes' : 'no'
      // 誘いに乗る人は少数（ゲームの推定）
      case 'mlm': return rnd() < 0.2 ? 'yes' : 'no'
      case 'scheme': return rnd() < 0.15 ? 'yes' : 'no'
      case 'burnout': return 'leave'
      case 'retire60': return rnd() < 0.75 ? 'stay' : 'retire'
      case 'end': return 'ok'
    }
  }
  function valid(p, ev) {
    if (window.Life.TYPES.includes(ev.type)) return window.Life.valid(p, ev)
    if (ev.type === 'promo') return (p.emp === 'regular' || p.emp === 'public') && !p.unemployed && p.rank < ev.to
    if (ev.type === 'hunt' || ev.type === 'indep' || ev.type === 'sideOffer') return !p.ended && !(ev.type !== 'hunt' && p.unemployed)
    if (ev.type === 'netPro') return !p.ended && !p.unemployed && !!p.netKind && p.emp !== 'self'
    if (ev.type === 'corp') return !p.ended && p.emp === 'self' && !p.corp
    if (ev.type === 'travel' || ev.type === 'fire') return !p.ended && !p.unemployed
    if (ev.type === 'dreamQuit') return !p.ended && !!p.dream
    if (ev.type === 'exit') return !p.ended && p.corp
    return true
  }
  function resolveAuto(p, events) {
    if (!p.auto) return events
    for (const ev of events) { if (!p.ended && valid(p, ev)) choose(p, ev, autoChoice(p, ev)) }
    if (p.auto) autoFocus(p)
    return []
  }
  function autoFocus(p) {
    if (p.family.spouse && p.family.bond < 35 && rnd() < 0.5) p.focus = 'family'
    else if (p.mental < 40 || p.health < 40) p.focus = rnd() < 0.5 ? 'rest' : 'play'
    else if (p.study.target) p.focus = 'study'
    else {
      const r = rnd()
      p.focus = r < 0.3 ? 'rest' : r < 0.45 ? 'play' : r < 0.6 ? 'work' : r < 0.7 ? 'side' : r < 0.8 ? 'meta' : r < 0.88 ? 'hunt' : 'rest'
      // 夢を追っている人・プロとして活動中の人は、自分から転職活動はしない
      if (p.focus === 'hunt' && (p.dream || p.dreamCareer)) p.focus = 'work'
      if (p.focus === 'rest' && rnd() < 0.03) {
        const cand = Object.keys(LIC).filter(k => LIC[k].kind === 'study' && !p.licenses.includes(k) && (!LIC[k].maxAge || p.age < LIC[k].maxAge - 2))
        if (cand.length) { p.study.target = pick(cand); p.focus = 'study' }
      }
    }
  }

  function end(p, reason) {
    if (p.ended) return
    p.ended = true; p.endReason = reason
    const ret = p.emp === 'self' ? 0 : Math.round((p.size.retire ?? M(500)) * Math.min(1, p.yearsInJob / 30))
    p.retireBonus = ret; p.lifetime += ret
    addLog(p, t('log.end', { reason, bonus: ret ? t('log.bonus', { money: money(ret) }) : '' }), 'end')
  }

  // 人生をひとことで（メモリアル用）
  function epitaphKey(p) {
    if (p.flags.senior && p.age >= 75) return 'senior'
    if (p.peakRank >= 3) return 'rank'
    if (p.titles.length >= 4) return 'many'
    if (p.emp === 'self') return 'self'
    return 'plain'
  }
  function epitaph(p) {
    const main = mainJob(p)
    switch (epitaphKey(p)) {
      case 'senior': return t('ep.senior', { age: p.age })
      case 'rank': return t('ep.rank', { n: p.workYears, rank: window.RANKS[p.peakRank].name })
      case 'many': return t('ep.many', { n: p.titles.length })
      case 'self': return t('ep.self', { job: main })
      default: return t('ep.plain', { job: main, n: p.workYears })
    }
  }
  // ---------- 夢を追う1年 ----------
  function dreamStep(p, events) {
    const d = DREAMS[p.dream]
    p.dreamYears++
    if (d.self) { p.dream = null; return } // 起業家は独立したところから。あとは自営業の仕組みどおり
    if (d.net) {
      // YouTuber：本業のかたわら、毎年本気で動画をつくる
      p.netYears++
      netLevelStep(p); netLevelStep(p)
      if ((p.netLv || 0) >= 2 && p.emp !== 'self') events.push({ type: 'netPro' })
    } else if (rnd() < d.chance * (0.7 + p.skill / 150)) {
      // チャンスをつかんだ
      p.dreamCareer = p.dream; p.dreamLv = 0; p.dream = null
      const j = JOBS[d.job]
      p.job = j.code; p.emp = 'self'; p.irr = null; p.flags.leader = false; p.yearsInJob = 0; p.selfYears = 0
      if (!p.jobsHeld.includes(j.code)) p.jobsHeld.push(j.code)
      p.variant = t('dream.lv.' + p.dreamCareer + '0')
      if (!p.titles.includes(p.variant)) p.titles.push(p.variant)
      p.retireAt = d.retire ? d.retire[0] + Math.round(rnd() * (d.retire[1] - d.retire[0])) : null
      p.income = calcIncome(p)
      addLog(p, t('log.dreamHit.' + p.dreamCareer, { n: p.dreamYears }), 'up')
      return
    }
    // 年齢の壁、または3年ごとの「あきらめる？」
    if (p.dream && (p.age > d.until || p.dreamYears % 3 === 0)) events.push({ type: 'dreamQuit', forced: p.age > d.until })
  }
  function dreamCareerStep(p) {
    const d = DREAMS[p.dreamCareer], lv = p.dreamLv || 0
    if (lv < 3 && rnd() < d.up[lv] * (0.7 + p.skill / 150)) {
      p.dreamLv = lv + 1; p.variant = t('dream.lv.' + p.dreamCareer + p.dreamLv)
      if (!p.titles.includes(p.variant)) p.titles.push(p.variant)
      addLog(p, t('log.dreamUp.' + p.dreamCareer + p.dreamLv), 'up')
    } else if (lv > 0 && rnd() < 0.08) {
      p.dreamLv = lv - 1; p.variant = t('dream.lv.' + p.dreamCareer + p.dreamLv)
      addLog(p, t('log.dreamDown.' + p.dreamCareer), 'bad')
    }
    p.peakDream = Math.max(p.peakDream || 0, p.dreamLv || 0)
    // スポーツは引退の年齢が来たら、役者・歌手は売れないまま仕事が途切れたら、セカンドキャリアへ
    const out = d.retire ? p.age >= p.retireAt : (p.dreamLv || 0) === 0 && rnd() < d.drop
    if (out) {
      addLog(p, t(d.retire ? 'log.dreamRetire' : 'log.dreamDrop', { title: p.variant }), 'change')
      p.flags.dreamDone = p.dreamCareer
      p.dreamCareer = null; p.variant = null; p.unemployed = true
    }
  }

  // 人生の称号：その人生でいちばん珍しかったことを一言にする（top は同じ年に働きはじめた人の中の上位%）
  function honor(p, top) {
    const R = window.RANKS, f = p.family || { kids: [], history: [] }
    const careYears = [...(f.history || []).filter(h => h.who), ...(f.care ? [f.care] : [])].reduce((a, c) => a + (c.years || 0), 0)
    const had = k => p.log.some(l => l.kind === k)
    const c = []
    if (top != null && top <= 3) c.push([95, 'honor.top', { n: Math.max(1, Math.round(top)) }])
    // 叩き上げ：大卒ではないのに管理職まで上りつめた
    if (p.peakRank >= 3 && p.edu.lv < 2) c.push([90, 'honor.climb', { rank: R[p.peakRank].name }])
    else if (p.peakRank >= 3) c.push([80, 'honor.rank', { rank: R[p.peakRank].name }])
    if (p.flags.senior && p.age >= 75) c.push([85, 'honor.lifelong', { age: p.age }])
    if (p.titles.length === 1 && p.workYears >= 35) c.push([82, 'honor.loyal', { n: p.workYears }])
    if (p.emp === 'self' && p.selfYears >= 15) c.push([78, 'honor.boss', {}])
    if (p.titles.length >= 5) c.push([75, 'honor.wander', { n: p.titles.length }])
    const leaves = p.log.some(l => l.kind === 'leave')
    if ((p.trait || {}).mind === 'steel' && !leaves && p.workYears >= 30) c.push([56, 'honor.steel', {}])
    if ((p.trait || {}).body === 'frail' && p.workYears >= 35) c.push([57, 'honor.frail', { n: p.workYears }])
    // 夢の仕事
    const dk = p.dreamCareer || p.flags.dreamDone
    if (dk && (p.peakDream || 0) >= 3) c.push([97, 'honor.dreamTop', { title: t('dream.lv.' + dk + '3') }])
    else if (dk) c.push([88, 'honor.dreamHit', { title: t('dream.lv.' + dk + (p.peakDream || 0)) }])
    else if (p.flags.dreamGaveUp) c.push([76, 'honor.dreamChase', { dream: t('dream.' + p.flags.dreamGaveUp) }])
    if (p.flags.rebuilt) c.push([90, 'honor.rebuilt', {}])
    else if (p.flags.homeless) c.push([70, 'honor.street', {}])
    if (p.netCareer && (p.netLv || 0) >= 4) c.push([96, 'honor.netTop', { kind: t('net.' + p.netCareer) }])
    if (p.flags.exitGain) c.push([92, 'honor.exit', { money: money(p.flags.exitGain) }])
    if (p.flags.fire) c.push([86, 'honor.fire', { age: p.age }])
    if (p.flags.traveler) c.push([42, 'honor.travel', {}])
    if (p.netCareer && p.workYears >= 10) c.push([68, 'honor.net', { kind: t('net.' + p.netCareer) }])
    if (p.corp) c.push([64, 'honor.corp', {}])
    if (p.flags.everLeader) c.push([46, 'honor.leader', {}])
    if (p.flags.burned) c.push([44, 'honor.burned', {}])
    else if (p.flags.mlmLost) c.push([34, 'honor.mlm', {}])
    const wk = (p.trait || {}).work
    if (wk === 'lax' && !leaves && p.workYears >= 30) c.push([50, 'honor.lax', {}])
    if (wk === 'diligent' && p.peakRank >= 2) c.push([48, 'honor.diligent', {}])
    if (careYears >= 3) c.push([72, 'honor.care', { n: careYears }])
    if (had('leave') && p.workYears >= 25) c.push([70, 'honor.rise', {}])
    if (p.aiMult <= 0.85) c.push([66, 'honor.aiDown', {}])
    else if (p.aiMult >= 1.08) c.push([65, 'honor.aiUp', {}])
    if (had('bad') && p.workYears >= 30) c.push([42, 'honor.tough', {}])
    if (p.licenses.length >= 3) c.push([60, 'honor.lic', { n: p.licenses.length }])
    if ((f.kids || []).length) c.push([f.kids.length >= 3 ? 58 : 40, 'honor.kids', { n: f.kids.length }])
    if (p.place !== p.home) c.push([45, 'honor.away', { home: p.home }])
    // 墓碑銘（epitaph）と同じことを言う称号は避ける
    const same = { senior: ['honor.lifelong'], rank: ['honor.rank', 'honor.climb'], many: ['honor.wander'], self: ['honor.boss'], plain: ['honor.plain', 'honor.loyal'] }[epitaphKey(p)]
    const cand = c.filter(x => !same.includes(x[1]))
    if (!cand.length) cand.push(p.titles.length <= 2 && !same.includes('honor.plain') ? [10, 'honor.plain', { job: mainJob(p) }] : [10, 'honor.steady', {}])
    const [, key, vars] = cand.sort((a, b) => b[0] - a[0])[0]
    return t(key, vars)
  }

  // 一言の場面：統計の数字は動かさず、その年の様子を短い文で残す
  // 文の候補は i18n の epi.* に | 区切り。同じ文は一生で一度だけ
  function episode(p) {
    if (p.unemployed || p.leave > 0 || p.parental > 0) return
    const first = p.workYears === 1
    if (!first && rnd() >= 0.18) return
    const f = p.family || { kids: [] }
    const pools = []
    if (first) pools.push(p.emp === 'self' ? 'epi.firstSelf' : 'epi.first')
    else {
      if (p.yearsInJob === 1 && p.jobsHeld.length > 1) pools.push('epi.newJob')
      if (p.age < 35) pools.push('epi.young')
      if (p.age >= 35 && p.age < 50) pools.push('epi.mid')
      if (p.age >= 50 && p.age < 65) pools.push('epi.late')
      if (p.age >= 65) pools.push('epi.senior')
      if (p.rank >= 2) pools.push('epi.mgr')
      if (p.emp === 'irregular') pools.push('epi.irr')
      if (p.emp === 'self') pools.push('epi.self')
      if (p.emp === 'public') pools.push('epi.pub')
      if ((f.kids || []).some(k => p.year - k.born < 12)) pools.push('epi.kids')
      if (f.care) pools.push('epi.care')
      if (p.mental < 35) pools.push('epi.low')
      if (p.skill >= 80) pools.push('epi.skill')
      if ((p.trait || {}).work === 'diligent') pools.push('epi.diligent')
      if (p.emp === 'irregular' && (p.irr || 'part') === 'part' && p.age <= 34) pools.push('epi.freeter')
      if (p.flags.leader && p.emp === 'irregular') pools.push('epi.leader')
      if (p.netKind && p.netKind !== 'gig') pools.push('epi.net')
      if (p.netKind === 'gig') pools.push('epi.gig')
      if (p.corp) pools.push('epi.corp')
      if ((p.trait || {}).work === 'lax') pools.push('epi.lax')
    }
    const used = (p.flags.epi ||= [])
    const lines = pools.flatMap(k => t(k).split('|')).filter(x => x && !used.includes(x))
    if (!lines.length) return
    const line = pick(lines)
    used.push(line)
    addLog(p, line.replace(/%job%/g, title(p)), 'scene')
  }

  // いちばん長く就いていた職業名
  function mainJob(p) {
    const cnt = {}
    for (const h of p.history) if (h.title) cnt[h.title] = (cnt[h.title] || 0) + 1
    return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] || p.titles[0]
  }

  window.Engine = { DREAM_KEYS, title, vInfo, pickVariant, valid, isMgr, empName, rankName, money, M, util: { rnd, clamp, pick, weighted, addLog }, JOBS, JOB_LIST, ENTRY_JOBS, create, step, options, choose, autoChoice, autoFocus, end, epitaph, honor, traitFx, calcIncome, eligible, START_YEAR, AI_YEAR }
})()
