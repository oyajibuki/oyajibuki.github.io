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
  const empName = e => t('emp.' + e)

  // ---------- 誕生（入職） ----------
  function create(opts = {}) {
    // 性別を選んだときは、その性別で働く人の数に比例して職業を引く。選ばないときは職業を引いてから、その職業の女性比率で性別を決める
    const pickSex = opts.sex === 'm' || opts.sex === 'f' ? opts.sex : null
    const job = opts.job ? JOBS[opts.job] : weighted(ENTRY_JOBS, j => j.share * (pickSex ? (pickSex === 'f' ? j.female : 1 - j.female) : 1))
    const sex = pickSex || (rnd() < job.female ? 'f' : 'm')
    let edu
    if (C.longSchool && C.longSchool.match(job)) edu = C.longSchool.edu
    else if (job.eduDist) edu = weighted(window.EDUCATION, e => job.eduDist[e.lv] || 0.0001) // 職業ごとの学歴の分布（実数）
    else edu = weighted(window.EDUCATION.filter(e => e.lv >= job.edu), e => e.w)
    const isPublic = C.isPublic(job)
    // 自営率・非正規率は職業×性別の実数。高齢者を含む数字なので、入職時は少し割り引く
    const isSelf = !isPublic && rnd() < job.self * 0.4
    const irrRate = job.irr ? job.irr[sex] : C.irrDefault[sex]
    const irregular = !isPublic && !isSelf && rnd() < irrRate * (edu.lv >= 2 ? 0.6 : 0.9)
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
    p.flags.familyBiz = (C.familyBiz && (job.code === C.familyBiz.job || rnd() < C.familyBiz.rate)) || false
    p.variant = pickVariant(job.code, p.meta)
    p.titles = [title(p)]
    window.Life.init(p)
    p.income = calcIncome(p)
    addLog(p, t('log.firstJob', { place: p.place, edu: p.edu.name, size: p.size.name, ni: t(p.emp === 'self' ? 'c.de' : 'c.ni'), emp: empName(p.emp), title: title(p) }))
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
    if (p.emp === 'self') return Math.round(selfIncome(p, j) * vm)
    let base = vm * j.inc * p.size.mult * ageCurve(p.age, p.size.key, j.y0 ?? 0.65) * skillF * p.aiMult * (p.edu.wage ?? 1) * j.sexW[p.sex]
    if (p.emp === 'irregular') base = vm * j.inc * 0.55 * (0.9 + Math.min(p.workYears, 15) / 100) * p.aiMult
    if (p.emp === 'rehired') base *= 0.6
    if (p.emp === 'senior') base = j.inc * 0.45 * (p.age < 70 ? 1 : 0.85)
    if (p.shortTime > 0) base *= 0.8 // 時短勤務
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
      const emp = rnd() < (p.age > 45 ? 0.45 : 0.2) ? 'irregular' : 'regular'
      const keepRank = j.major === cur.major && p.rank > 0 ? Math.max(0, p.rank - 1) : 0
      const variant = pickVariant(j.code, p.meta)
      const trial = { ...p, job: j.code, variant, size, emp, rank: Math.min(keepRank, 3), skill: transferSkill(p, j), flags: {}, unemployed: false, leave: 0, shortTime: 0 }
      offers.push({ job: j.code, variant, size, emp, rank: trial.rank, income: calcIncome(trial) })
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
    p.flags.preManager = null
    p.variant = offer.variant !== undefined ? offer.variant : pickVariant(offer.job, p.meta)
    p.yearsInJob = 0; p.unemployed = false; p.rel = 45
    if (!p.jobsHeld.includes(j.code)) p.jobsHeld.push(j.code)
    if (!p.titles.includes(title(p))) p.titles.push(title(p))
    p.income = calcIncome(p)
    addLog(p, t('log.change', { why, title: title(p), size: offer.size.name, emp: empName(offer.emp), money: money(p.income) }), 'change')
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
      p.mental = clamp(p.mental - (p.careQuit ? 1 : 4))
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
    p.health = clamp(p.health - j.phys * 0.08 - ot * 0.12 - ageDrain + 5 + (f === 'rest' ? 9 : 0) - (f === 'side' || f === 'study' ? 3 : 0))
    let stress = j.st * 0.11 + ot * 0.16 + (p.rel < 35 ? 4 : 0) + (p.emp === 'irregular' ? 3 : 0) + (p.emp === 'self' ? 2 : 0)
    if ((C.itMids || []).includes(j.mid)) stress += 1.5 // 情報通信業はメンタル不調の休業率が高い
    p.mental = clamp(p.mental - stress + 4 + (f === 'rest' ? 6 : 0) + (f === 'play' ? 11 : 0) - (f === 'study' ? 2 : 0))

    // スキル・メタスキル・人間関係
    p.skill = clamp(p.skill + 7 * (1 - p.skill / 110) * (f === 'work' ? 1.4 : 1))
    p.meta = clamp(p.meta + (f === 'meta' ? 7 : f === 'side' ? 3 : 0.8) - (p.age > 50 && f !== 'meta' ? 0.5 : 0))
    p.rel = clamp(p.rel + (rnd() - 0.45) * 12 + (f === 'work' ? 3 : 0))

    // 収入
    p.income = calcIncome(p)
    let side = 0
    if (f === 'side') {
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
    p.lifetime += p.income + side
    p.savings += Math.round(p.income * 0.12 + side * 0.5 - (f === 'play' ? M(25) : 0))

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
      const chance = base * Math.min(1.25, p.skill / 60) * (0.5 + p.rel / 100) * (f === 'work' ? 1.6 : 1) * (p.emp === 'public' ? 1.1 : 1) * window.Life.promoMult(p)
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
    }

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
          ...ev.offers.map((o, i) => ({ key: 'o' + i, label: o.variant || JOBS[o.job].label, sub: [o.variant ? JOBS[o.job].label : null, o.size.name, empName(o.emp), o.rank ? R[o.rank].name : null, t('ev.incomeSub', { money: money(o.income) })].filter(Boolean).join(t('sep')) })),
          { key: 'no', label: t(ev.forced ? 'ev.hunt.more' : 'ev.hunt.stay') },
        ],
      }
      case 'sideOffer': return {
        title: t('ev.side.t'),
        text: t('ev.side', { job: JOBS[ev.offer.job].label, money: money(ev.offer.income) }),
        choices: [{ key: 'yes', label: t('ev.side.yes') }, { key: 'no', label: t('ev.side.no') }],
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
      case 'burnout': return 'leave'
      case 'retire60': return rnd() < 0.75 ? 'stay' : 'retire'
      case 'end': return 'ok'
    }
  }
  function valid(p, ev) {
    if (window.Life.TYPES.includes(ev.type)) return window.Life.valid(p, ev)
    if (ev.type === 'promo') return (p.emp === 'regular' || p.emp === 'public') && !p.unemployed && p.rank < ev.to
    if (ev.type === 'hunt' || ev.type === 'indep' || ev.type === 'sideOffer') return !p.ended && !(ev.type !== 'hunt' && p.unemployed)
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
  function epitaph(p) {
    const main = mainJob(p)
    if (p.flags.senior && p.age >= 75) return t('ep.senior', { age: p.age })
    if (p.peakRank >= 3) return t('ep.rank', { n: p.workYears, rank: window.RANKS[p.peakRank].name })
    if (p.titles.length >= 4) return t('ep.many', { n: p.titles.length })
    if (p.emp === 'self') return t('ep.self', { job: main })
    return t('ep.plain', { job: main, n: p.workYears })
  }
  // いちばん長く就いていた職業名
  function mainJob(p) {
    const cnt = {}
    for (const h of p.history) if (h.title) cnt[h.title] = (cnt[h.title] || 0) + 1
    return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] || p.titles[0]
  }

  window.Engine = { title, vInfo, pickVariant, valid, isMgr, empName, money, M, util: { rnd, clamp, pick, weighted, addLog }, JOBS, JOB_LIST, ENTRY_JOBS, create, step, options, choose, autoChoice, autoFocus, end, epitaph, calcIncome, eligible, START_YEAR, AI_YEAR }
})()
