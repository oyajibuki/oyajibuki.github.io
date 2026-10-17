// プライベートのライフイベント（結婚・出産・介護・転勤）と仕事の両立
// engine.js から呼ばれる。確率などの数値は国ごとの LIFE_PARAMS、文言は i18n。
(function () {
  const U = () => window.Engine.util
  const P = window.LIFE_PARAMS
  const C = window.COUNTRY
  const M = v => v * C.money.scale
  const money = v => C.money.fmt(v)
  const rel = r => t('rel.' + r)

  // ---------- 初期化 ----------
  function init(p) {
    const { rnd, weighted } = U()
    const a = p.age
    p.place = weighted(P.places, x => x.w).name
    p.home = p.place
    p.family = {
      spouse: null, kids: [], care: null, away: 0, bond: 60,
      parents: [
        { rel: 'mother', age: a + 25 + Math.floor(rnd() * 8), alive: true, cared: 0 },
        { rel: 'father', age: a + 27 + Math.floor(rnd() * 9), alive: true, cared: 0 },
      ],
      marriedYears: 0, divorced: false, transferBoost: 0, refused: 0, history: [],
    }
    p.shortTime = 0; p.parental = 0; p.careQuit = false
  }

  // ---------- 仕事への影響 ----------
  const kidsUnder = (p, n) => p.family.kids.filter(k => p.year - k.born < n).length
  // 自由に使える時間（資格の勉強などに効く）
  function freeMult(p) {
    const f = p.family
    let m = 1 - kidsUnder(p, 6) * 0.25 - kidsUnder(p, 12) * 0.08
    if (f.care) m -= P.careModes[f.care.mode].load * 0.45
    return Math.max(0.15, m)
  }
  function otMult(p) {
    let m = 1
    if (p.shortTime > 0) m *= 0.15
    if (p.family.care && p.family.care.mode === 'self') m *= 0.8
    return m
  }
  function promoMult(p) {
    let m = 1
    if (p.shortTime > 0) m *= 0.35
    if (p.family.transferBoost > 0) m *= 1.5
    if (p.family.refused > 0) m *= 0.5
    return m
  }
  function householdIncome(p) {
    const s = p.family.spouse
    return p.income + (s && s.working ? s.income : 0)
  }

  // ---------- 1年ぶんの家族の変化 ----------
  function step(p, events, ctx = {}) {
    const { rnd, clamp, addLog } = U()
    const f = p.family
    const focus = p.focus

    // 親の加齢・介護・看取り
    for (const par of f.parents) {
      if (!par.alive) continue
      par.age++
      const caring = f.care && f.care.who === par.rel
      const q = 0.004 * Math.exp((par.age - 60) / 9) + (caring ? 0.1 : 0) // 生命表のざっくり近似
      if (rnd() < q) {
        par.alive = false
        addLog(p, t('life.passed', { rel: rel(par.rel), age: par.age, care: caring ? t('life.passedCare', { n: Math.max(1, f.care.years), pos: t('rel.' + par.rel + '.pos') }) : '' }), 'life')
        p.mental = clamp(p.mental - 10)
        if (caring) endCare(p)
        continue
      }
      // きょうだいと分担する分を差し引いた、主に担う確率
      if (!f.care && par.age >= 75 && rnd() < 0.012 + (par.age - 75) * 0.003) {
        events.push({ type: 'care', who: par.rel, age: par.age })
      }
    }
    if (f.care) {
      f.care.years++
      const m = P.careModes[f.care.mode]
      p.mental = clamp(p.mental - m.mental); p.health = clamp(p.health - m.health)
      p.savings -= Math.round(M(m.cost))
    }

    // 配偶者
    if (f.spouse) {
      f.marriedYears++
      const s = f.spouse
      s.age++
      if (s.working && s.age < 60) s.income = Math.round(s.income * 1.012 * 10) / 10
      if (!s.working && s.backIn > 0 && --s.backIn === 0 && s.age < 58) {
        s.working = true; s.income = Math.round(s.baseIncome * 0.6 * 10) / 10
        addLog(p, t('life.spouseBack'), 'life')
      }
      if (s.age >= 65) s.working = false
      // 家庭の満足度
      const d = -2.8 - (p.lastOt > 40 ? 4 : 0) - (f.away > 0 ? 7 : 0) - (f.care ? 2 : 0) + (focus === 'family' ? 14 : 0) + (focus === 'rest' ? 2 : 0)
      f.bond = clamp(f.bond + d + (rnd() - 0.5) * 10)
      if (f.bond < 25 && rnd() < 0.4) events.push({ type: 'crisis' })
    } else if (!f.divorced || rnd() < 0.3) {
      const r = P.marriageRate.find(x => p.age <= x.to)
      let chance = r ? r.p : 0
      if (p.lastOt > 45) chance *= 0.7
      if (f.divorced) chance *= 0.5
      if (rnd() < chance) events.push({ type: 'marriage', spouse: makeSpouse(p) })
    }

    // 子ども
    for (const k of f.kids) {
      if (p.year - k.born === 22) addLog(p, t('life.kidOut', { name: k.name }), 'life')
    }
    const youngKids = kidsUnder(p, 6)
    p.mental = clamp(p.mental - youngKids * (p.shortTime > 0 ? 0.5 : 1.8) + (f.kids.length && focus === 'family' ? 3 : 0))
    p.health = clamp(p.health - youngKids * 0.8)
    if (f.spouse && f.kids.length < 4) {
      const motherAge = p.sex === 'f' ? p.age : f.spouse.age
      const last = f.kids[f.kids.length - 1]
      const sinceLast = last ? p.year - last.born : 99
      const base = P.birthRate[Math.min(f.kids.length, 3)]
      const ageF = motherAge < 25 ? 0.7 : motherAge <= 34 ? 1 : motherAge <= 39 ? 0.55 : motherAge <= 43 ? 0.15 : 0
      if (sinceLast >= 2 && rnd() < base * ageF) events.push({ type: 'birth' })
    }
    if (p.shortTime > 0 && --p.shortTime === 0) addLog(p, t('life.shortEnd'), 'life')

    // 転勤
    if (f.transferBoost > 0) f.transferBoost--
    if (f.refused > 0) f.refused--
    if (f.away > 0 && --f.away === 0) addLog(p, t('life.awayEnd'), 'life')
    if (!ctx.idle && (p.emp === 'regular' || p.emp === 'public') && ['xl', 'l', 'gov'].includes(p.size.key) &&
        p.age >= 25 && p.age <= 55 && f.away === 0 && rnd() < P.transferRate) {
      const { weighted } = U()
      const to = weighted(P.places.filter(x => x.name !== p.place), x => x.w).name
      events.push({ type: 'transfer', to })
    }

    // 家計
    const s = f.spouse
    const kidCost = f.kids.filter(k => p.year - k.born < 22).reduce((a, k) => a + (p.year - k.born >= 18 ? 110 : 45), 0)
    p.savings += Math.round((s && s.working ? s.income * 0.15 : 0) - M(kidCost * 0.5) - (f.away > 0 ? M(50) : 0))
    p.household = householdIncome(p)
  }

  function makeSpouse(p) {
    const { weighted, pick } = U()
    const E = window.Engine
    const sex = p.sex === 'm' ? 'f' : 'm'
    const job = weighted(E.ENTRY_JOBS, j => j.share)
    const age = Math.max(20, p.age + Math.round((sex === 'm' ? 2 : -2) + (Math.random() - 0.5) * 6))
    const irregular = Math.random() < C.irrDefault[sex] * 0.85
    const income = Math.round(job.inc * (irregular ? 0.55 : 0.8) * (0.85 + Math.random() * 0.3) * 10) / 10
    return { name: pick(C.names.given[sex]), sex, age, job: job.code, income, baseIncome: income, working: true, backIn: 0, irregular }
  }

  function endCare(p) {
    const f = p.family
    f.history.push({ ...f.care })
    const quit = f.care.mode === 'quit'
    f.care = null
    if (quit && p.careQuit) {
      p.careQuit = false
      U().addLog(p, t('life.careEnd'), 'life')
    }
  }

  // ---------- 決断 ----------
  const TYPES = ['marriage', 'birth', 'care', 'transfer', 'crisis']
  // 同じ年の先の決断で前提が崩れたイベント（離婚した年の出産など）は無効
  function valid(p, ev) {
    const f = p.family
    if ((ev.type === 'birth' || ev.type === 'crisis') && !f.spouse) return false
    if (ev.type === 'marriage' && f.spouse) return false
    if (ev.type === 'care' && f.care) return false
    if (ev.type === 'transfer' && (p.unemployed || p.ended)) return false
    return true
  }
  // 第2子 / second child（4人目まで用意、それ以上は番号）
  const nth = n => n === 1 ? t('kid.first') : n <= 4 ? t('kid.' + n) : t('kid.nth', { n })
  function options(p, ev) {
    const E = window.Engine, f = p.family
    switch (ev.type) {
      case 'marriage': {
        const s = ev.spouse
        return {
          title: t('ev.marry.t'),
          text: t('ev.marry', { age: s.age, name: s.name, job: E.JOBS[s.job].label, emp: E.empName(s.irregular ? 'irregular' : 'regular'), money: money(s.income) }),
          choices: [{ key: 'yes', label: t('ev.marry.yes') }, { key: 'no', label: t('ev.marry.no') }],
        }
      }
      case 'birth': return {
        title: t('ev.birth.t', { nth: nth(f.kids.length + 1) }),
        text: t('ev.birth'),
        choices: ['long_short', 'long', 'short', 'none'].map(k => ({ key: k, label: t('ev.birth.' + k), sub: t('ev.birth.' + k + '.s') })),
      }
      case 'care': return {
        title: t('ev.care.t', { who: rel(ev.who) }),
        text: t('ev.care', { who: rel(ev.who), age: ev.age }),
        choices: Object.keys(P.careModes).map(k => ({ key: k, label: t('care.' + k), sub: t('care.' + k + '.s') })),
      }
      case 'transfer': return {
        title: t('ev.transfer.t', { to: ev.to }),
        text: t('ev.transfer', { from: p.place, to: ev.to, care: f.care ? t('ev.transfer.care') : '' }),
        choices: f.spouse
          ? [
            { key: 'family', label: t('ev.transfer.family'), sub: t(f.spouse.working ? 'ev.transfer.family.sWork' : 'ev.transfer.family.sKids') },
            { key: 'alone', label: t('ev.transfer.alone'), sub: t('ev.transfer.alone.s') },
            { key: 'refuse', label: t('ev.transfer.refuse'), sub: t('ev.transfer.refuse.s') },
          ]
          : [{ key: 'family', label: t('ev.transfer.move') }, { key: 'refuse', label: t('ev.transfer.refuse'), sub: t('ev.transfer.refuse.s') }],
      }
      case 'crisis': return {
        title: t('ev.crisis.t'), text: t('ev.crisis'),
        choices: [{ key: 'talk', label: t('ev.crisis.talk'), sub: t('ev.crisis.talk.s') }, { key: 'part', label: t('ev.crisis.part') }],
      }
    }
  }

  function choose(p, ev, key) {
    if (!valid(p, ev)) return
    const { clamp, addLog, rnd, pick } = U()
    const E = window.Engine, f = p.family
    switch (ev.type) {
      case 'marriage':
        if (key === 'yes') {
          f.spouse = ev.spouse; f.marriedYears = 0; f.bond = 70
          p.mental = clamp(p.mental + 10)
          addLog(p, t('log.married', { name: ev.spouse.name, job: E.JOBS[ev.spouse.job].label }), 'life')
        } else addLog(p, t('log.notMarried'), 'life')
        break
      case 'birth': {
        const kid = { name: pick(C.names.given[rnd() < 0.5 ? 'm' : 'f']), born: p.year }
        f.kids.push(kid)
        const s = f.spouse
        let note = ''
        if (key === 'long_short' || key === 'long') {
          p.parental = 1
          if (key === 'long_short') p.shortTime = 4
        } else {
          // 配偶者が主に担う。第一子出産を機に一定の割合が離職
          if (s.working && rnd() < (s.sex === 'f' ? P.quitAfterBirth : 0.08) * (key === 'none' ? 1.3 : 1)) {
            s.working = false; s.backIn = 4 + Math.floor(rnd() * 4)
            note = t('log.birthQuit')
          }
          if (key === 'short') p.mental = clamp(p.mental + 4)
          if (key === 'none') f.bond = clamp(f.bond - 8)
        }
        addLog(p, t('log.birth', { nth: nth(f.kids.length), name: kid.name, how: t('how.' + key), note }), 'life')
        p.mental = clamp(p.mental + 8); f.bond = clamp(f.bond + 6)
        break
      }
      case 'care': {
        f.care = { who: ev.who, mode: key, years: 0 }
        const par = f.parents.find(x => x.rel === ev.who); if (par) par.cared = 1
        if (key === 'quit') {
          p.careQuit = true; p.unemployed = true; p.income = 0
          addLog(p, t('log.careQuit', { who: rel(ev.who) }), 'bad')
        } else if (key === 'leave') {
          p.income = Math.round(p.income * 0.92) // 休業期間の分だけ年収が減る
          addLog(p, t('log.careLeave', { who: rel(ev.who) }), 'life')
        } else addLog(p, t('log.careStart.' + key, { who: rel(ev.who) }), 'life')
        break
      }
      case 'transfer':
        if (key === 'refuse') {
          f.refused = 5; p.rel = clamp(p.rel - 10)
          addLog(p, t('log.transferNo', { to: ev.to }), 'life')
          break
        }
        f.transferBoost = 4; p.skill = clamp(p.skill + 4)
        if (key === 'alone') {
          f.away = 3
          addLog(p, t('log.transferAlone', { to: ev.to }), 'life')
        } else {
          const s = f.spouse
          if (s && s.working) { s.working = false; s.backIn = 2; addLog(p, t('log.transferFamilyQuit', { to: ev.to }), 'life') }
          else addLog(p, t('log.transferMove', { to: ev.to }), 'life')
          p.place = ev.to
          if (f.care && f.care.mode === 'self') { f.care.mode = 'facility'; addLog(p, t('log.careToFacility'), 'life') }
        }
        break
      case 'crisis':
        if (key === 'talk') { p.focus = 'family'; f.bond = clamp(f.bond + 15); addLog(p, t('log.talk'), 'life') }
        else {
          addLog(p, t('log.divorce', { n: f.marriedYears, name: f.spouse.name }), 'bad')
          f.history.push({ divorce: true, years: f.marriedYears })
          f.spouse = null; f.divorced = true; f.away = 0
          p.mental = clamp(p.mental - 15); p.savings = Math.round(p.savings * 0.6)
        }
        break
    }
  }

  function autoChoice(p, ev) {
    const { rnd } = U()
    switch (ev.type) {
      case 'marriage': return rnd() < 0.85 ? 'yes' : 'no'
      case 'birth': return P.autoBirth(p.sex, rnd())
      case 'care': {
        const r = rnd()
        return r < 0.45 ? 'self' : r < 0.77 ? 'leave' : r < 0.95 ? 'facility' : 'quit'
      }
      case 'transfer': {
        if (p.family.care) return 'refuse'
        const r = rnd()
        return !p.family.spouse ? (r < 0.8 ? 'family' : 'refuse') : r < 0.45 ? 'alone' : r < 0.85 ? 'family' : 'refuse'
      }
      case 'crisis': return rnd() < 0.55 ? 'talk' : 'part'
    }
  }

  // 職歴証明書に載せる家族のまとめ
  function summary(p) {
    const f = p.family, E = window.Engine, parts = []
    if (f.spouse) parts.push(t('sum.married', { job: E.JOBS[f.spouse.job].label, name: f.spouse.name, n: f.marriedYears }))
    else parts.push(t(f.divorced ? 'sum.divorced' : 'sum.single'))
    if (f.kids.length) parts.push(t('sum.kids', { n: f.kids.length }))
    const cared = [...f.history.filter(h => h.who), ...(f.care ? [f.care] : [])]
    for (const c of cared) parts.push(t('sum.care', { who: rel(c.who), n: Math.max(1, c.years), quit: c.mode === 'quit' ? t('sum.careQuit') : '' }))
    if (p.place !== p.home) parts.push(t('sum.moved', { home: p.home, place: p.place }))
    return parts.join(C.lang === 'ja' ? '' : ' ').trim()
  }

  window.Life = { init, step, valid, freeMult, otMult, promoMult, householdIncome, options, choose, autoChoice, summary, TYPES, kidsUnder, rel }
})()
