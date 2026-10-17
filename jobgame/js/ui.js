// 画面・ゲームループ
(function () {
  const E = window.Engine, JOBS = E.JOBS, LIC = window.LICENSES, RANKS = window.RANKS, C = window.COUNTRY
  const $ = id => document.getElementById(id)
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const money = v => C.money.fmt(v)
  const age = n => t('unit.age', { n })
  const icon = j => C.icons.mid[j.mid] || C.icons.major[j.major] || '•'
  const fmtPeople = j => j.workers == null ? '—' : C.fmtPeople(j.workers, j.split)
  const cap = s => (C.lang === 'ja' ? s : s.charAt(0).toUpperCase() + s.slice(1))

  // ---------- 保存（国ごとに分ける） ----------
  const K = k => `jg_${C.code}_${k}`
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(K(k))) ?? d } catch { return d } },
    set(k, v) { try { localStorage.setItem(K(k), JSON.stringify(v)) } catch {} },
  }
  // 多言語化前（v0.1）の日本の保存データを引き継ぐ
  if (C.code === 'jp') {
    try {
      for (const k of ['seen', 'memorial', 'len']) {
        const old = localStorage.getItem('jg_' + k)
        if (old && !localStorage.getItem(K(k))) localStorage.setItem(K(k), old)
      }
    } catch {}
  }
  function markSeen(codes) {
    const seen = new Set(store.get('seen', []))
    codes.forEach(c => seen.add(c)); store.set('seen', [...seen])
  }

  // ---------- 静的な文言 ----------
  // data-i18n="key" はテキスト、data-i18n-html はHTML、data-i18n-ph はプレースホルダー
  function applyText() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n) })
    document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml) })
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh) })
    document.title = `${t('brand')} — ${t('title.suffix')}`
    $('chartUnit').textContent = C.money.unit
    // 言語タブ
    $('langTabs').innerHTML = window.LANGS.map(l => `<a href="?lang=${l.lang}" class="${l.lang === C.lang ? 'on' : ''}" data-lang="${l.lang}">${esc(l.label)}</a>`).join('')
  }
  $('langTabs').addEventListener('click', e => {
    const a = e.target.closest('[data-lang]'); if (!a) return
    try { localStorage.setItem('jg_lang', a.dataset.lang) } catch {}
  })

  // ---------- 画面遷移 ----------
  function go(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id))
    window.scrollTo(0, 0)
    if (id === 'zukan') renderZukan()
    if (id === 'memorial') renderMemorial()
    if (id !== 'play') S.playing = false
  }
  document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go) })

  // ---------- 状態 ----------
  const S = { p: null, peers: [], playing: false, speed: 1, secPerYear: store.get('len', 6), acc: 0, busy: false }

  // ---------- ホーム ----------
  // 大分類ごとの就業者の割合（国の統計。日本は労働力調査、アメリカは雇用予測）
  function majorShares() {
    if (window.MAJOR_WORKERS) return window.OCC.majors.filter(m => window.MAJOR_WORKERS[m.code] && !m.mids.every(c => (window.MID_PARAMS[c] || {}).gate === 'none')).map(m => ({ m, pct: window.MAJOR_WORKERS[m.code] / window.TOTAL_WORKERS * 100 }))
    const tot = E.JOB_LIST.reduce((a, j) => a + (j.workers || 0), 0)
    return window.OCC.majors.map(m => ({ m, pct: E.JOB_LIST.filter(j => j.major === m.code).reduce((a, j) => a + (j.workers || 0), 0) / tot * 100 }))
  }
  function renderHome() {
    let rows = majorShares().sort((a, b) => window.MAJOR_WORKERS ? 0 : b.pct - a.pct)
    // 大分類が多い国（アメリカは22）は上位11とその他にまとめる
    if (rows.length > 12) rows = [...rows.slice(0, 11), { m: { code: '', name: t('home.other') }, pct: rows.slice(11).reduce((a, r) => a + r.pct, 0) }]
    const max = Math.max(...rows.map(r => r.pct))
    $('majorBars').innerHTML = rows.map(r => `<div class="mbar"><span>${C.icons.major[r.m.code] || ''} ${esc(C.majorLabel(r.m.name))}</span><div class="track"><div class="fill" style="width:${r.pct / max * 100}%"></div></div><span class="pct">${r.pct.toFixed(1)}%</span></div>`).join('')
    document.querySelectorAll('#lenSeg button').forEach(b => b.classList.toggle('on', +b.dataset.sec === S.secPerYear))
  }
  $('lenSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return
    S.secPerYear = +b.dataset.sec; store.set('len', S.secPerYear); renderHome()
  })

  // ---------- 雇用契約書 ----------
  $('btnStart').addEventListener('click', newLife)
  function newLife() {
    S.p = E.create()
    S.peers = Array.from({ length: 4 }, () => E.create({ auto: true }))
    const p = S.p, j = JOBS[p.job]
    $('cNo').textContent = `No. ${C.code.toUpperCase()}-${E.START_YEAR}-${p.id.toUpperCase()}`
    $('cName').textContent = p.name
    $('cLead').textContent = t('c.lead', { year: E.START_YEAR, age: p.age, place: p.place, edu: p.edu.name, size: p.size.name, ni: t(p.emp === 'self' ? 'c.de' : 'c.ni'), emp: E.empName(p.emp), title: E.title(p) })
    const kv = [
      ['kv.major', `${j.major} ${j.majorName}`], ['kv.mid', `${j.mid} ${j.midName}`], ['kv.job', `${j.code} ${j.name}`], ...(p.variant ? [['kv.variant', p.variant]] : []),
      ['kv.sex', t('sex.' + p.sex)], ['kv.edu', cap(p.edu.name)], ['kv.emp', E.empName(p.emp)],
      ['kv.size', p.size.name], ['kv.firstInc', money(p.income)], ['kv.peakInc', `${money(j.inc)}${j.incSrc === 'est' ? t('estParen') : ''}`],
      ['kv.ot', t('unit.hours', { n: j.ot })], ['kv.female', `${Math.round(j.female * 100)}%`], ['kv.ai', `${Math.round(j.ai * 100)}%`],
      ...(j.isco ? [['kv.isco', `${j.isco} ${(window.ISCO.subMajors[j.isco] || {})[C.lang] || ''}`]] : []),
    ]
    $('cKv').innerHTML = kv.map(([k, v]) => `<div><span>${t(k)}</span><b>${esc(v)}</b></div>`).join('')
    $('cRare').innerHTML = t('c.rare', { people: fmtPeople(j), n: Math.round(1 / j.share).toLocaleString() }) +
      (j.split ? `<br><span class="small muted">${t('c.rare.split')}</span>` : '') +
      (j.lic ? `<br>${esc(t('c.rare.lic', { lic: LIC[j.lic].name }))}` : '')
    $('cPeers').innerHTML = S.peers.map(q => `<div class="peer"><span>${esc(q.name)}</span><span class="r">${esc([E.title(q), q.size.name, E.empName(q.emp)].join(' · '))}</span></div>`).join('')
    go('contract')
  }
  $('btnBegin').addEventListener('click', () => {
    markSeen([S.p.job]); S.acc = 0; S.speed = 1; S.busy = false
    S.p.focus = 'rest'
    renderPlay(); go('play'); S.playing = true; updateCtrls()
  })

  // ---------- プレイ画面 ----------
  function updateCtrls() {
    $('btnPause').textContent = t(S.playing ? 'p.pause' : 'p.resume')
    document.querySelectorAll('#spdSeg button').forEach(b => b.classList.toggle('on', +b.dataset.x === S.speed))
    $('btnAuto').classList.toggle('on', !!(S.p && S.p.auto))
  }
  $('btnPause').addEventListener('click', () => { S.playing = !S.playing; updateCtrls() })
  $('spdSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { S.speed = +b.dataset.x; updateCtrls() } })
  $('btnAuto').addEventListener('click', () => { S.p.auto = !S.p.auto; updateCtrls(); renderFocus() })
  $('btnQuit').addEventListener('click', () => { if (confirm(t('p.quitConfirm'))) { S.playing = false; go('home') } })

  function renderPlay() {
    const p = S.p, j = JOBS[p.job]
    const span = Math.max(65, p.age) - p.startAge
    $('pAge').textContent = age(p.age)
    $('pSub').textContent = t('p.sub', { year: p.year, name: p.name, n: p.workYears })
    $('pProg').style.width = Math.min(100, (p.age - p.startAge) / span * 100) + '%'
    $('idYear').textContent = p.year
    $('idAvatar').textContent = icon(j)
    $('idName').textContent = p.name
    const dl = [
      ['dl.job', E.title(p)], ...(p.variant && !E.isMgr(p.job) ? [['kv.job', j.name]] : []), ['dl.class', C.classLabel(j)], ['dl.size', p.unemployed ? '—' : p.size.name],
      ['dl.emp', p.unemployed ? t('p.seeking') : p.leave > 0 ? t('p.onLeave', { emp: E.empName(p.emp) }) : E.empName(p.emp)], ['dl.rank', RANKS[p.rank].name], ['dl.edu', cap(p.edu.name)],
    ]
    $('idDl').innerHTML = dl.map(([k, v]) => `<dt>${t(k)}</dt><dd>${esc(v)}</dd>`).join('')
    const st = [['st.health', p.health, 'var(--green)'], ['st.mental', p.mental, 'var(--yellow)'], ['st.skill', p.skill, 'var(--blue)'], ['st.meta', p.meta, 'var(--blue)'], ['st.rel', p.rel, 'var(--accent)'], ...(p.family.spouse ? [['st.bond', p.family.bond, 'var(--accent)']] : [])]
    $('stats').innerHTML = st.map(([k, v, c]) => `<div class="stat"><span>${t(k)}</span><div class="track"><div class="fill" style="width:${v}%;background:${v < 20 ? 'var(--red)' : c}"></div></div><span class="v">${Math.round(v)}</span></div>`).join('')
    renderFamily(p)
    $('money').innerHTML = [['m.income', p.income], ['m.household', window.Life.householdIncome(p)], ['m.savings', p.savings], ['m.lifetime', p.lifetime]].map(([k, v]) => `<div><span>${t(k)}</span><b>${money(v)}</b></div>`).join('')
    $('lics').innerHTML = p.licenses.length ? p.licenses.map(k => `<span class="chip">${esc(LIC[k].name)}</span>`).join('') : `<span class="muted small">${t('p.noLics')}</span>`
    $('sceneIcon').textContent = icon(j)
    $('sceneJob').textContent = p.unemployed ? t('p.seekingJob') : `${E.title(p)}${p.rank ? t('paren', { s: RANKS[p.rank].name }) : ''}`
    $('sceneMeta').textContent = t('p.scene', { major: `${t('z.majorPrefix', { code: j.major })}${C.majorLabel(j.majorName)}`, mid: j.midName, where: p.unemployed ? t('p.seeking') : `${p.size.name} · ${E.empName(p.emp)}`, ot: Math.round(j.ot) })
    $('peers').innerHTML = S.peers.map(q => `<div class="peer"><span>${esc(q.name)}${q.ended ? t('p.retired') : ''}</span><span class="r">${esc(E.title(q))}${q.rank ? t('sep') + RANKS[q.rank].name : ''}<br>${money(q.income)}</span></div>`).join('')
    const recent = p.log.slice(-60).reverse()
    $('log').innerHTML = recent.map(l => `<li class="${l.kind}"><span class="a">${age(l.age)}</span><span>${esc(l.text)}</span></li>`).join('')
    renderFocus()
    drawChart($('chart'), p, S.peers)
  }

  function renderFamily(p) {
    const f = p.family, s = f.spouse, rel = window.Life.rel
    const kids = f.kids.map(k => t('fam.kid', { name: k.name, age: p.year - k.born })).join(t('list.sep'))
    const parents = f.parents.map(x => x.alive ? t('fam.parent', { rel: rel(x.rel), age: x.age }) + (f.care && f.care.who === x.rel ? t('fam.needsCare') : '') : t('fam.passed', { rel: rel(x.rel) })).join(t('list.sep'))
    const rows = [
      ['fam.spouse', s ? t('fam.spouseV', { name: s.name, age: s.age, job: s.working ? `${JOBS[s.job].label} ${money(s.income)}` : t('fam.notWorking') }) : t(f.divorced ? 'fam.divorced' : 'fam.single')],
      ['fam.kids', kids || t('fam.noKids')],
      ['fam.parents', parents],
      ['fam.home', `${p.place}${f.away > 0 ? t('fam.away', { n: f.away }) : ''}${p.place !== p.home ? t('fam.from', { home: p.home }) : ''}`],
    ]
    if (f.care) rows.push(['fam.care', t('fam.careV', { mode: t('care.' + f.care.mode), n: f.care.years })])
    if (p.shortTime > 0) rows.push(['fam.work', t('fam.short', { n: p.shortTime })])
    if (p.parental > 0) rows.push(['fam.work', t('fam.parental')])
    $('family').innerHTML = rows.map(([k, v]) => `<dt>${t(k)}</dt><dd>${esc(v)}</dd>`).join('')
  }

  const FOCUS_KEYS = ['rest', 'play', 'study', 'meta', 'side', 'work', 'hunt', 'family']
  function renderFocus() {
    const p = S.p
    $('focus').innerHTML = FOCUS_KEYS.map(k => `<button data-f="${k}" class="${p.focus === k ? 'on' : ''}"><b>${t('focus.' + k)}</b><span>${t('focus.' + k + '.d')}</span></button>`).join('')
    $('focusHint').textContent = t(p.auto ? 'p.focusAuto' : 'p.focusHint')
    const showStudy = p.focus === 'study'
    $('studyBox').classList.toggle('hidden', !showStudy)
    if (showStudy) {
      const cand = Object.entries(LIC).filter(([k, L]) => L.kind === 'study' && !p.licenses.includes(k) && (!L.maxAge || p.age < L.maxAge))
      $('studySel').innerHTML = `<option value="">${t('p.studyPick')}</option>` + cand.map(([k, L]) => `<option value="${k}" ${p.study.target === k ? 'selected' : ''}>${esc(t('p.studyOpt', { name: L.name, hours: L.hours.toLocaleString(), pass: (L.pass * 100).toFixed(1) }))}</option>`).join('')
      const L = LIC[p.study.target]
      $('studyMeter').style.width = L ? Math.min(100, p.study.hours / L.hours * 100) + '%' : '0'
      $('studyText').textContent = L ? t('p.studyProgress', { done: p.study.hours.toLocaleString(), need: L.hours.toLocaleString(), desc: L.desc }) : t('p.studyHint')
    }
  }
  $('focus').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return
    S.p.focus = b.dataset.f; renderFocus()
  })
  $('studySel').addEventListener('change', e => {
    const k = e.target.value
    if (k !== S.p.study.target) S.p.study = { target: k || null, hours: 0 }
    renderFocus()
  })

  // 年収の推移（自分 + 同期）
  function drawChart(svg, p, peers = []) {
    const W = 600, H = 140, pad = 6
    const all = [p, ...peers]
    const a0 = Math.min(...all.map(q => q.startAge)), a1 = Math.max(70, ...all.map(q => q.age))
    const vmax = Math.max(C.money.ticks[0] * 0.8, ...all.flatMap(q => q.history.map(h => h.income))) * 1.1
    const x = a => pad + (a - a0) / (a1 - a0) * (W - pad * 2)
    const y = v => H - pad - v / vmax * (H - pad * 2)
    const line = q => q.history.map((h, i) => `${i ? 'L' : 'M'}${x(h.age).toFixed(1)},${y(h.income).toFixed(1)}`).join(' ')
    let s = ''
    for (const v of C.money.ticks) if (v < vmax) s += `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="${W - 4}" y="${y(v) - 3}" fill="var(--muted)" font-size="10" text-anchor="end">${v}</text>`
    for (const q of peers) if (q.history.length) s += `<path d="${line(q)}" fill="none" stroke="var(--muted)" stroke-opacity=".45" stroke-width="1.2"/>`
    if (p.history.length) s += `<path d="${line(p)}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round"/>`
    svg.innerHTML = s
  }

  // ---------- ループ ----------
  setInterval(() => {
    if (!S.playing || S.busy || !S.p) return
    S.acc += 0.1 * S.speed
    if (S.acc >= S.secPerYear) { S.acc = 0; advance() }
  }, 100)

  const PAUSE_AT = [1, 10, 20, 30]
  async function advance() {
    const p = S.p
    S.busy = true
    const events = E.step(p)
    for (const q of S.peers) { if (!q.ended) E.step(q) }
    markSeen(p.jobsHeld)
    renderPlay()
    for (const ev of events) {
      if (p.ended) break
      if (!E.valid(p, ev)) continue
      const key = await ask(E.options(p, ev), t('ask.decide'))
      E.choose(p, ev, key)
      markSeen(p.jobsHeld)
      renderPlay()
    }
    if (PAUSE_AT.includes(p.workYears) && !p.ended && !p.auto) {
      const r = await ask({ title: t('ask.pause'), text: t('pause.' + p.workYears), choices: [{ key: 'ok', label: t('ask.continue') }] }, age(p.age), true)
      if (r.note) { p.log.push({ age: p.age, year: p.year, text: t('quote', { s: r.note }), kind: 'reflect' }); renderPlay() }
    }
    if (p.ended) { finish(); return }
    S.busy = false
  }

  function ask(opt, kind, withInput = false) {
    return new Promise(res => {
      $('mKind').textContent = kind
      $('mTitle').textContent = opt.title
      $('mText').textContent = opt.text
      $('mInput').value = ''
      $('mInput').classList.toggle('hidden', !withInput)
      $('mChoices').innerHTML = opt.choices.map(c => `<button data-k="${c.key}">${esc(c.label)}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</button>`).join('')
      $('modal').classList.remove('hidden')
      $('mChoices').onclick = e => {
        const b = e.target.closest('button'); if (!b) return
        $('modal').classList.add('hidden')
        const note = $('mInput').value.trim()
        res(withInput ? { key: b.dataset.k, note } : b.dataset.k)
      }
    })
  }

  // ---------- エンディング ----------
  function finish() {
    S.playing = false; S.busy = false
    const p = S.p
    // 同期も最後まで進める
    for (const q of S.peers) { let g = 0; while (!q.ended && g++ < 60) E.step(q) }
    const nChanges = p.titles.length - 1
    $('eNo').textContent = `${E.START_YEAR} – ${p.year}`
    $('eName').textContent = p.name
    $('eEpitaph').textContent = E.epitaph(p)
    $('eSummary').textContent = t('e.summary', { age: p.startAge, job: p.titles[0], reason: p.endReason, changes: nChanges > 0 ? t('e.changes', { n: nChanges }) : t('e.oneJob') })
    const kv = [
      ['e.years', t('unit.years', { n: p.workYears })], ['e.lifetime', money(p.lifetime)], ['e.peak', money(Math.max(...p.history.map(h => h.income), 0))],
      ['e.rank', RANKS[p.peakRank].name], ['e.lics', t('unit.count', { n: p.licenses.length })], ['e.savings', money(p.savings)],
    ]
    $('eKv').innerHTML = kv.map(([k, v]) => `<div><span>${t(k)}</span><b>${esc(v)}</b></div>`).join('')
    drawChart($('eChart'), p, S.peers)
    $('eJobs').innerHTML = p.titles.map(x => `<span class="chip">${esc(x)}</span>`).join('') + (p.jobsHeld.some(c => E.isMgr(c)) ? `<span class="chip">${t('e.manager')}</span>` : '')
    $('ePeers').innerHTML = S.peers.map(q => `<div class="peer"><span>${esc(q.name)}</span><span class="r">${esc(t('e.peerLife', { ep: E.epitaph(q), money: money(q.lifetime) }))}</span></div>`).join('')
    $('eFamily').textContent = window.Life.summary(p)
    S.snap = window.Pass.snapshot(p, S.peers)
    $('eWord').value = ''
    go('ending')
  }
  $('btnPass').addEventListener('click', () => window.Pass.open(S.snap, 'ending'))
  $('btnSave').addEventListener('click', () => {
    const p = S.p
    const list = store.get('memorial', [])
    // 作品はあとからメモリアルからもつくれるよう、スナップショットごと納める
    list.unshift({ name: p.name, epitaph: E.epitaph(p), from: E.START_YEAR, to: p.year, lifetime: p.lifetime, origin: p.origin, jobs: p.jobsHeld, word: $('eWord').value.trim(), sex: p.sex, family: window.Life.summary(p), snap: S.snap })
    store.set('memorial', list.slice(0, 100))
    newLife()
  })

  // ---------- 職業図鑑 ----------
  $('zSearch').addEventListener('input', renderZukan)
  function renderZukan() {
    const seen = new Set(store.get('seen', []))
    const q = $('zSearch').value.trim().toLowerCase()
    const J = window.OCC
    $('zCount').textContent = t('z.count', { total: E.JOB_LIST.length, n: seen.size })
    const head = `<div class="jobrow head"><span>${t('z.h.code')}</span><span>${t('z.h.job')}</span><span>${t('z.h.people')}</span><span>${t('z.h.inc')}</span><span class="hide-sm">${t('z.h.female')}</span><span class="hide-sm">${t('z.h.ot')}</span><span class="hide-sm">${t('z.h.ai')}</span></div>`
    $('zTree').innerHTML = J.majors.map(Mj => {
      const mids = Mj.mids.map(c => J.mids[c]).map(mid => {
        const jobs = mid.jobs.map(x => JOBS[x.code]).filter(j => !q || j.name.toLowerCase().includes(q) || mid.name.toLowerCase().includes(q) || (j.variants || []).some(v => v.name.toLowerCase().includes(q)))
        if (!jobs.length) return ''
        const rows = jobs.map(j => `<div class="jobrow ${seen.has(j.code) ? 'seen' : ''}"><span class="mono">${j.code}</span><span>${esc(j.name)}${j.lic ? `<br><span class="lic">${esc(t('z.req', { lic: LIC[j.lic].name }))}</span>` : ''}${j.gate === 'rank' ? `<br><span class="lic">${t('z.rank')}</span>` : ''}${j.variants ? `<div class="vars">${j.variants.map(v => `<span class="var" title="${esc(v.note || '')}">${esc(v.name)}<small>×${v.mult}・AI ${Math.round(v.ai * 100)}%</small></span>`).join('')}</div>` : ''}</span><span>${fmtPeople(j)}</span><span>${j.inc ? money(j.inc) : '—'}${j.incSrc === 'est' ? `<br><span class="lic">${t('est')}</span>` : ''}</span><span class="hide-sm">${Math.round(j.female * 100)}%</span><span class="hide-sm">${j.ot}h</span><span class="hide-sm">${Math.round(j.ai * 100)}%</span></div>`).join('')
        const seenN = mid.jobs.filter(x => seen.has(x.code)).length
        const iso = JOBS[mid.jobs[0].code].isco
        return `<details class="mid" ${q ? 'open' : ''}><summary><span>${mid.code} ${esc(mid.name)}</span><span class="muted small">${iso ? `<span class="isco" title="${esc((window.ISCO.subMajors[iso] || {})[C.lang] || '')}">ISCO ${iso}</span> ` : ''}${seenN}/${mid.jobs.length}</span></summary>${head}${rows}</details>`
      }).join('')
      if (!mids) return ''
      const total = Mj.mids.reduce((a, c) => a + J.mids[c].jobs.length, 0)
      const seenN = Mj.mids.reduce((a, c) => a + J.mids[c].jobs.filter(x => seen.has(x.code)).length, 0)
      const workers = Mj.mids.reduce((a, c) => a + J.mids[c].jobs.reduce((b, x) => b + (JOBS[x.code].workers || 0), 0), 0)
      return `<details class="major" ${q ? 'open' : ''}><summary><span>${C.icons.major[Mj.code] || ''} ${t('z.majorPrefix', { code: Mj.code })}${esc(Mj.name)}</span><span class="muted small">${C.fmtPeople(workers)} · ${seenN}/${total}</span></summary>${mids}</details>`
    }).join('')
  }

  // ---------- メモリアル ----------
  function renderMemorial() {
    const list = store.get('memorial', [])
    $('mList').innerHTML = list.length ? list.map((m, i) => `<div class="mcard"><div class="n">${esc(m.name)}</div><div class="muted small">${m.from} – ${m.to}</div><div class="e">${esc(m.epitaph)}</div><div class="muted small">${esc(t('mem.lifetime', { money: money(m.lifetime) }))}</div>${m.family ? `<div class="muted small">${esc(m.family)}</div>` : ''}${m.word ? `<div class="small" style="margin-top:6px">${esc(t('quote', { s: m.word }))}</div>` : ''}${m.snap ? `<button class="btn sm" data-pass="${i}" style="margin-top:8px">${t(window.Pass.isOwned(m.snap.id) ? 'mem.view' : 'mem.make')}</button>` : ''}</div>`).join('') : `<p class="muted">${t('mem.empty')}</p>`
  }
  $('mList').addEventListener('click', e => {
    const b = e.target.closest('[data-pass]'); if (!b) return
    const m = store.get('memorial', [])[+b.dataset.pass]
    if (m && m.snap) window.Pass.open(m.snap, 'memorial')
  })

  applyText()
  renderHome()
  // Stripe から戻ってきたら、その人生をメモリアルに納めて（まだなら）作品を開く
  const paidSnap = window.Pass.resume()
  if (paidSnap) {
    const list = store.get('memorial', [])
    if (!list.some(m => m.snap && m.snap.id === paidSnap.id)) {
      const s = paidSnap
      list.unshift({ name: s.name, epitaph: s.epitaph, from: s.from, to: s.to, lifetime: s.lifetime, word: '', sex: s.sex, family: s.family, snap: s })
      store.set('memorial', list.slice(0, 100))
    }
    window.Pass.open(paidSnap, 'memorial')
  }
})()
