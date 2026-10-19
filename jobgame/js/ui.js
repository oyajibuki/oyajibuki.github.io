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
  // 生まれつきの気質・体質（ふつうの人は出さない）
  const traitRows = p => [['kv.mind', 'mind'], ['kv.body', 'body']].filter(([, k]) => p.trait && p.trait[k] !== 'normal').map(([l, k]) => [l, t('trait.' + p.trait[k])])

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
    if (id === 'home') renderHomeMem()
    if (id !== 'play') S.playing = false
    if (window.__syncFloat) setTimeout(window.__syncFloat, 0)
  }
  document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go) })

  // ---------- 状態 ----------
  const S = { p: null, peers: [], playing: false, speed: 1, secPerYear: store.get('len', 6), sex: store.get('sex', ''), name: store.get('name', ''), acc: 0, busy: false }

  // ---------- ホーム ----------
  // 大分類ごとの就業者の割合（国の統計。日本は労働力調査、アメリカは雇用予測）
  function majorShares() {
    if (window.MAJOR_WORKERS) return window.OCC.majors.filter(m => window.MAJOR_WORKERS[m.code] && !m.mids.every(c => (window.MID_PARAMS[c] || {}).gate === 'none')).map(m => ({ m, pct: window.MAJOR_WORKERS[m.code] / window.TOTAL_WORKERS * 100 }))
    const tot = E.JOB_LIST.reduce((a, j) => a + (j.workers || 0), 0)
    return window.OCC.majors.map(m => ({ m, pct: E.JOB_LIST.filter(j => j.major === m.code).reduce((a, j) => a + (j.workers || 0), 0) / tot * 100 }))
  }
  function renderHome() {
    let rows = majorShares().sort((a, b) => b.pct - a.pct)
    // 大分類が多い国（アメリカは22）は上位11とその他にまとめる
    if (rows.length > 12) rows = [...rows.slice(0, 11), { m: { code: '', name: t('home.other') }, pct: rows.slice(11).reduce((a, r) => a + r.pct, 0) }]
    const max = Math.max(...rows.map(r => r.pct))
    $('majorBars').innerHTML = rows.map(r => `<div class="mbar"><span>${C.icons.major[r.m.code] || ''} ${esc(C.majorLabel(r.m.name))}</span><div class="track"><div class="fill" style="width:${r.pct / max * 100}%"></div></div><span class="pct">${r.pct.toFixed(1)}%</span></div>`).join('')
    document.querySelectorAll('#lenSeg button').forEach(b => b.classList.toggle('on', +b.dataset.sec === S.secPerYear))
    document.querySelectorAll('#sexSeg button').forEach(b => b.classList.toggle('on', b.dataset.sex === S.sex))
  }
  // 自分の名前で遊べる（空欄なら毎回ランダムな名前）。記号は落としておく
  const cleanName = v => v.replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20)
  $('nameIn').value = S.name
  $('nameIn').addEventListener('input', () => { S.name = cleanName($('nameIn').value); store.set('name', S.name) })
  $('sexSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return
    S.sex = b.dataset.sex; store.set('sex', S.sex); renderHome()
  })
  $('lenSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return
    S.secPerYear = +b.dataset.sec; store.set('len', S.secPerYear); renderHome()
  })

  // ---------- 雇用契約書 ----------
  $('btnStart').addEventListener('click', newLife)
  function newLife() {
    S.p = E.create({ sex: S.sex, name: S.name })
    S.ref = null
    S.peers = Array.from({ length: 4 }, () => E.create({ auto: true }))
    const p = S.p, j = JOBS[p.job]
    $('cNo').textContent = `No. ${C.code.toUpperCase()}-${E.START_YEAR}-${p.id.toUpperCase()}`
    $('cName').textContent = p.name
    lifeScene($('cScene'), { id: p.id, sex: p.sex, isco: j.isco, home: false })
    $('cLead').textContent = t('c.lead', { year: E.START_YEAR, age: p.age, place: p.place, edu: p.edu.name, size: p.size.name, ni: t(p.emp === 'self' ? 'c.de' : 'c.ni'), emp: E.empName(p.emp), title: E.title(p) })
    const kv = [
      ['kv.major', `${j.major} ${j.majorName}`], ['kv.mid', `${j.mid} ${j.midName}`], ['kv.job', `${j.code} ${j.name}`], ...(p.variant ? [['kv.variant', p.variant]] : []),
      ['kv.sex', t('sex.' + p.sex)], ...traitRows(p), ['kv.edu', cap(p.edu.name)], ['kv.emp', E.empName(p.emp)],
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
    // 画面上部の小さなゲージ（体力・メンタル）
    $('pVitals').innerHTML = [['st.health', p.health, 'var(--green)'], ['st.mental', p.mental, 'var(--yellow)']].map(([k, v, c]) => `<span title="${t(k)} ${Math.round(v)}">${t(k)}<i><b style="width:${v}%;background:${v < 25 ? 'var(--red)' : c}"></b></i></span>`).join('')
    $('pProg').style.width = Math.min(100, (p.age - p.startAge) / span * 100) + '%'
    $('idYear').textContent = p.year
    $('idAvatar').textContent = icon(j)
    $('idName').textContent = p.name
    const dl = [
      ['dl.job', E.title(p)], ...(p.variant && !E.isMgr(p.job) ? [['kv.job', j.name]] : []), ['dl.class', C.classLabel(j)], ['dl.size', p.unemployed ? '—' : p.size.name],
      ['dl.emp', p.unemployed ? t('p.seeking') : p.leave > 0 ? t('p.onLeave', { emp: E.empName(p.emp) }) : E.empName(p.emp)], ['dl.rank', RANKS[p.rank].name], ['dl.edu', cap(p.edu.name)], ...traitRows(p),
    ]
    $('idDl').innerHTML = dl.map(([k, v]) => `<dt>${t(k)}</dt><dd>${esc(v)}</dd>`).join('')
    const st = [['st.health', p.health, 'var(--green)'], ['st.mental', p.mental, 'var(--yellow)'], ['st.skill', p.skill, 'var(--blue)'], ['st.meta', p.meta, 'var(--blue)'], ['st.rel', p.rel, 'var(--accent)'], ...(p.family.spouse ? [['st.bond', p.family.bond, 'var(--accent)']] : [])]
    $('stats').innerHTML = st.map(([k, v, c]) => `<div class="stat"><span>${t(k)}</span><div class="track"><div class="fill" style="width:${v}%;background:${v < 20 ? 'var(--red)' : c}"></div></div><span class="v">${Math.round(v)}</span></div>`).join('')
    renderFamily(p)
    $('money').innerHTML = [['m.income', p.income], ['m.household', window.Life.householdIncome(p)], ['m.savings', p.savings], ['m.lifetime', p.lifetime]].map(([k, v]) => `<div><span>${t(k)}</span><b>${money(v)}</b></div>`).join('')
    $('lics').innerHTML = p.licenses.length ? p.licenses.map(k => `<span class="chip">${esc(LIC[k].name)}</span>`).join('') : `<span class="muted small">${t('p.noLics')}</span>`
    $('sceneIcon').textContent = icon(j)
    // 働いている様子のドット絵（求職中は職探し、休職中・引退後は家で）
    if (window.Pixel) {
      if (!S.work) S.work = window.Pixel.work($('workScene'))
      if (!S.look || S.look.id !== p.id) { const c = window.Pixel.cast({ seed: p.id, sex: p.sex, outfit: 'casual', country: C.code })[0]; S.look = { id: p.id, skin: c.skin, hair: c.hair } }
      S.work.set(window.Pixel.lookFor(j.isco), { sex: p.sex, skin: S.look.skin, hair: S.look.hair, age: p.age >= 65 ? 'old' : 'adult' }, p.unemployed ? 'seek' : p.leave > 0 || p.ended ? 'rest' : null)
    }
    $('sceneJob').textContent = p.unemployed ? t('p.seekingJob') : `${E.title(p)}${p.rank ? t('paren', { s: RANKS[p.rank].name }) : ''}`
    $('sceneMeta').textContent = t('p.scene', { major: `${t('z.majorPrefix', { code: j.major })}${C.majorLabel(j.majorName)}`, mid: j.midName, where: p.unemployed ? t('p.seeking') : `${p.size.name} · ${E.empName(p.emp)}`, ot: Math.round(j.ot) })
    $('peers').innerHTML = S.peers.map(q => `<div class="peer"><span>${esc(q.name)}${q.ended ? t('p.retired') : ''}</span><span class="r">${esc(E.title(q))}${q.rank ? t('sep') + RANKS[q.rank].name : ''}<br>${money(q.income)}</span></div>`).join('')
    const recent = p.log.slice(-60).reverse()
    $('log').innerHTML = recent.map(l => `<li class="${l.kind}"><span class="a">${age(l.age)}</span><span>${esc(l.text)}</span></li>`).join('')
    renderFocus()
    chartExtras($('chartLegend'), null, p, drawChart($('chart'), p, S.peers))
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
    const W = 600, H = 170, top = 10, bottom = 22, left = 6, right = 64
    const all = [p, ...peers]
    const a0 = Math.min(...all.map(q => q.startAge)), a1 = Math.max(70, ...all.map(q => q.age))
    const vmax = Math.max(C.money.ticks[0] * 0.8, ...all.flatMap(q => q.history.map(h => h.income))) * 1.1
    const x = a => left + (a - a0) / (a1 - a0) * (W - left - right)
    const y = v => H - bottom - v / vmax * (H - top - bottom)
    const line = q => q.history.map((h, i) => `${i ? 'L' : 'M'}${x(h.age).toFixed(1)},${y(h.income).toFixed(1)}`).join(' ')
    let s = ''
    // 年収の目盛り（右側の余白に単位つきで）
    for (const v of C.money.ticks) if (v < vmax) s += `<line x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="${W - right + 6}" y="${y(v) + 4}" fill="var(--muted)" font-size="12">${esc(money(v))}</text>`
    // 年齢の目盛り（10歳ごと）
    for (let a = Math.ceil(a0 / 10) * 10; a <= a1; a += 10) {
      const xa = x(a)
      s += `<line x1="${xa}" x2="${xa}" y1="${top}" y2="${H - bottom}" stroke="var(--line)"/><text x="${xa}" y="${H - 6}" fill="var(--muted)" font-size="12" text-anchor="${xa < 24 ? 'start' : 'middle'}">${t('unit.age', { n: a })}</text>`
    }
    for (const q of peers) if (q.history.length) s += `<path d="${line(q)}" fill="none" stroke="var(--muted)" stroke-opacity=".45" stroke-width="1.3"/>`
    if (p.history.length) s += `<path d="${line(p)}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round"/>`
    // いちばん大きく年収が下がった年（前の年より15%以上）に印。理由はグラフの下に文章で
    let drop = null
    p.history.forEach((h, i) => { if (i && p.history[i - 1].income > 0) { const r = h.income / p.history[i - 1].income; if (r < 0.85 && (!drop || r < drop.r)) drop = { r, h, prev: p.history[i - 1] } } })
    if (drop) {
      const dx = x(drop.h.age), dy = y(drop.h.income)
      s += `<line x1="${dx}" x2="${dx}" y1="${top}" y2="${H - bottom}" stroke="var(--red)" stroke-dasharray="2 3" stroke-opacity=".7"/><circle cx="${dx}" cy="${dy}" r="5" fill="var(--red)" stroke="var(--card)" stroke-width="2"/>`
    }
    svg.innerHTML = s
    return drop
  }
  // 凡例と「何歳で、なぜ下がったか」
  function chartExtras(legendEl, noteEl, p, drop) {
    if (legendEl) legendEl.innerHTML = `<span><i style="background:var(--accent)"></i>${esc(t('chart.you', { name: p.name }))}</span><span><i style="background:var(--muted);opacity:.6"></i>${esc(t('chart.peers'))}</span>`
    if (!noteEl) return
    if (!drop) { noteEl.textContent = ''; return }
    const why = p.log.filter(l => l.age === drop.h.age || l.age === drop.h.age - 1).filter(l => ['change', 'end', 'bad', 'leave', 'ai', 'life', 'up'].includes(l.kind)).map(l => l.text.replace(/（[^）]*）/g, '').split(/(?<=。)/)[0]).slice(-2).join(' ')
    noteEl.innerHTML = `<b>● ${esc(t('chart.dropAt', { age: drop.h.age }))}</b> ${esc(t('chart.dropFromTo', { from: money(drop.prev.income), to: money(drop.h.income) }))}${why ? ` — ${esc(why)}` : ''}`
  }

  // ---------- ループ ----------
  setInterval(() => {
    if (!S.playing || S.busy || !S.p) return
    S.acc += 0.1 * S.speed
    if (S.acc >= S.secPerYear) { S.acc = 0; advance() }
  }, 100)

  // ひと息：節目で止まり、数字で自分の位置を見せてから問いかける
  // 30年目だけは「もう一度この仕事を選ぶか」を選んで答える
  const PAUSE_AT = [1, 10, 20, 30, 40]
  const PAUSE_CHOICES = { 30: ['again', 'other'] }
  // 比べる相手：統計どおりに引いた200人の仕事人生（同じ年に働きはじめた人たち）。引退画面の「上位◯%」にも使う
  function refLives() {
    if (!S.ref) S.ref = Array.from({ length: 200 }, () => { const q = E.create({ auto: true }); let g = 0; while (!q.ended && g++ < 90) E.step(q); return q })
    return S.ref
  }
  function pauseData(p) {
    const inc = refLives().map(q => (q.history.find(h => h.age === p.age) || {}).income).filter(v => v > 0).sort((a, b) => a - b)
    const rows = []
    if (inc.length >= 20 && p.income > 0) {
      const above = inc.filter(v => v > p.income).length / inc.length * 100
      rows.push([t('pause.d.inc', { age: p.age }), money(p.income)])
      rows.push([t('pause.d.med', { age: p.age }), money(inc[Math.floor(inc.length / 2)])])
      rows.push([t('pause.d.pos'), above <= 50 ? t('e.hi.topV', { n: Math.max(1, Math.round(above)) }) : t('e.hi.botV', { n: Math.max(1, Math.round(100 - above)) })])
    }
    const all = [p, ...S.peers].map(q => q.lifetime)
    rows.push([t('pause.d.peers'), t('e.hi.rankV', { n: 1 + all.filter(v => v > p.lifetime).length })])
    return rows
  }
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
      const keys = PAUSE_CHOICES[p.workYears]
      const choices = keys ? keys.map(k => ({ key: k, label: t(`pause.${p.workYears}.${k}`) })) : [{ key: 'ok', label: t('ask.continue') }]
      const r = await ask({ title: t('ask.pause'), text: t('pause.' + p.workYears), choices, data: pauseData(p) }, age(p.age), true)
      if (keys) p.log.push({ age: p.age, year: p.year, text: t(`pause.${p.workYears}.${r.key}.log`, { job: E.title(p) }), kind: 'reflect' })
      if (r.note) p.log.push({ age: p.age, year: p.year, text: t('quote', { s: r.note }), kind: 'reflect' })
      if (keys || r.note) renderPlay()
    }
    if (p.ended) { finish(); return }
    S.busy = false
  }

  function ask(opt, kind, withInput = false) {
    return new Promise(res => {
      $('mKind').textContent = kind
      $('mTitle').textContent = opt.title
      $('mText').textContent = opt.text
      $('mData').innerHTML = (opt.data || []).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')
      $('mData').classList.toggle('hidden', !(opt.data || []).length)
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
    chartExtras($('eChartLegend'), $('eChartNote'), p, drawChart($('eChart'), p, S.peers))
    $('eJobs').innerHTML = p.titles.map(x => `<span class="chip">${esc(x)}</span>`).join('') + (p.jobsHeld.some(c => E.isMgr(c)) ? `<span class="chip">${t('e.manager')}</span>` : '')
    $('ePeers').innerHTML = S.peers.map(q => `<div class="peer"><span>${esc(q.name)}</span><span class="r">${esc(t('e.peerLife', { ep: E.epitaph(q), money: money(q.lifetime) }))}</span></div>`).join('')
    $('eFamily').textContent = window.Life.summary(p)
    // シェアしたくなる数字：同期の中の順位、同じ年に働きはじめた人の中の位置、最初の職業の希少さ
    const rank = 1 + S.peers.filter(q => q.lifetime > p.lifetime).length
    const ref = refLives().map(q => q.lifetime)
    const above = ref.filter(v => v > p.lifetime).length / ref.length * 100
    const top = above <= 50 ? t('e.hi.topV', { n: Math.max(1, Math.round(above)) }) : t('e.hi.botV', { n: Math.max(1, Math.round(100 - above)) })
    const first = JOBS[p.jobsHeld[0]]
    const rare = Math.max(1, Math.round(1 / first.share)).toLocaleString()
    $('eHi').innerHTML = [['e.hi.rank', t('e.hi.rankV', { n: rank })], ['e.hi.top', top], ['e.hi.rare', t('e.hi.rareV', { n: rare })]]
      .map(([k, v]) => `<div><span>${t(k)}</span><b>${esc(v)}</b></div>`).join('')
    const honor = E.honor(p, above)
    $('eHonor').textContent = honor
    S.shareText = t('e.share.text', { job: p.titles[0], money: money(p.lifetime), rank, top, ep: E.epitaph(p), honor })
    S.snap = window.Pass.snapshot(p, S.peers, { honor })
    snapScene($('eScene'), S.snap)
    $('eWord').value = ''
    go('ending')
  }
  $('btnPass').addEventListener('click', () => window.Pass.open(S.snap, 'ending'))
  // 結果をシェア（URL は公開版に固定。英語は英語版へ）
  const SHARE_URL = 'https://oyajibuki.github.io/jobgame/' + (C.lang === 'ja' ? '' : `?lang=${C.lang}`)
  // SNS ごとの共有画面（Instagram・TikTok・YouTube は文章とURLだけの共有ができないので、作品画面の画像・動画から共有する）
  const shareTo = {
    x: (tx, u) => `https://x.com/intent/post?text=${encodeURIComponent(tx)}&url=${encodeURIComponent(u)}`,
    line: (tx, u) => `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(u)}&text=${encodeURIComponent(tx)}`,
    fb: (tx, u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
    threads: (tx, u) => `https://www.threads.net/intent/post?text=${encodeURIComponent(tx + '\n' + u)}`,
  }
  document.querySelector('#ending .share-row').addEventListener('click', e => {
    const b = e.target.closest('[data-share]'); if (!b) return
    window.open(shareTo[b.dataset.share](S.shareText, SHARE_URL), '_blank', 'noopener')
  })
  if (navigator.share) {
    $('btnShareMore').classList.remove('hidden')
    $('btnShareMore').addEventListener('click', () => navigator.share({ text: S.shareText, url: SHARE_URL }).catch(() => {}))
  }
  $('btnSave').addEventListener('click', () => {
    const p = S.p
    const list = store.get('memorial', [])
    // 作品はあとからメモリアルからもつくれるよう、スナップショットごと納める
    list.unshift({ name: p.name, epitaph: E.epitaph(p), honor: S.snap.honor, from: E.START_YEAR, to: p.year, lifetime: p.lifetime, origin: p.origin, jobs: p.jobsHeld, word: $('eWord').value.trim(), sex: p.sex, family: window.Life.summary(p), snap: S.snap })
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
    $('mList').innerHTML = list.length ? list.map((m, i) => `<div class="mcard">${m.snap ? `<canvas class="pix doc-scene" data-scene="${i}"></canvas>` : ''}<div class="n">${esc(m.name)}</div><div class="muted small">${m.from} – ${m.to}</div>${m.honor ? `<div class="honor sm">${esc(m.honor)}</div>` : ''}<div class="e">${esc(m.epitaph)}</div><div class="muted small">${esc(t('mem.lifetime', { money: money(m.lifetime) }))}</div>${m.family ? `<div class="muted small">${esc(m.family)}</div>` : ''}${m.word ? `<div class="small" style="margin-top:6px">${esc(t('quote', { s: m.word }))}</div>` : ''}${m.snap ? `<button class="btn sm" data-pass="${i}" style="margin-top:8px">${t(window.Pass.isOwned(m.snap.id) ? 'mem.view' : 'mem.make')}</button>` : ''}</div>`).join('') : `<p class="muted">${t('mem.empty')}</p>`
    drawMemScenes()
  }
  function drawMemScenes() { document.querySelectorAll('#mList [data-scene]').forEach(c => { const m = store.get('memorial', [])[+c.dataset.scene]; if (m && m.snap) snapScene(c, m.snap) }) }
  $('mList').addEventListener('click', e => {
    const b = e.target.closest('[data-pass]'); if (!b) return
    const m = store.get('memorial', [])[+b.dataset.pass]
    if (m && m.snap) window.Pass.open(m.snap, 'memorial')
  })

  // ---------- ドット絵（職場・家族） ----------
  function lifeScene(canvas, o) {
    if (!window.Pixel || !canvas) return
    const look = window.Pixel.lookFor(o.isco)
    const fam = !!(o.spouse || o.kids)
    window.Pixel.scene(canvas, {
      seed: o.id, place: look.place, home: o.home ?? fam,
      people: window.Pixel.cast({ seed: o.id, sex: o.sex, outfit: look.outfit, spouse: o.spouse, kids: o.kids, country: C.code }),
      dog: o.dog,
    })
  }
  function snapScene(canvas, s) {
    const d = s.docs || {}
    lifeScene(canvas, { id: s.id, sex: s.sex, isco: d.mainIsco, spouse: !!d.spouse, kids: (d.kids || []).length, dog: String(s.id).charCodeAt(0) % 3 === 0 })
  }

  // ---------- ホームの「いま」：今日働きはじめた人・仕事を離れた人（推計） ----------
  const F = C.flow
  let heroLive = null, lastSpawn = 0
  // ページを開いた瞬間を0として数える
  const OPENED = performance.now()
  const secondsToday = () => (performance.now() - OPENED) / 1000
  const YEAR = 365 * 86400
  const fmtWait = v => (F.hire / YEAR > 0.5 ? Math.max(0.1, v).toFixed(1) : String(Math.max(1, Math.ceil(v))))
  const prev = { h: -1, s: -1 }
  function bump(id) { const el = $(id); el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 500) }
  function tickLive() {
    if (!F || !$('home').classList.contains('active')) return
    const sec = secondsToday(), rh = F.hire / YEAR, rs = F.sep / YEAR
    const h = Math.floor(sec * rh), s = Math.floor(sec * rs)
    $('liveHire').textContent = h.toLocaleString(); $('liveSep').textContent = s.toLocaleString()
    $('liveHireNext').textContent = t('home.live.hireNext', { s: fmtWait((h + 1) / rh - sec) })
    $('liveSepNext').textContent = t('home.live.sepNext', { s: fmtWait((s + 1) / rs - sec) })
    const now = performance.now()
    if (prev.h >= 0 && h > prev.h) { bump('liveHire'); if (heroLive && now - lastSpawn > 1200) { heroLive.hire(); lastSpawn = now } }
    if (prev.s >= 0 && s > prev.s) { bump('liveSep'); if (heroLive && now - lastSpawn > 1200) { heroLive.leave(); lastSpawn = now } }
    prev.h = h; prev.s = s
  }
  function initLive() {
    if (!F) return
    $('liveNow').innerHTML = t('home.live.now', { n: `<b>${F.workers}</b>` })
    $('liveRate').textContent = t('home.live.rate', { s: (YEAR / F.hire).toFixed(1) })
    if (window.Pixel) heroLive = window.Pixel.live($('heroScene'), C.code)
    tickLive(); setInterval(tickLive, 100)
  }

  // ---------- ホームのメモリアル：納めた人生＋同じ春に働きはじめた人たち ----------
  let others = []
  function makeOthers() {
    others = Array.from({ length: 6 }, () => { const q = E.create({ auto: true }); let g = 0; while (!q.ended && g++ < 90) E.step(q); return window.Pass.snapshot(q, []) })
  }
  function renderHomeMem() {
    const mine = store.get('memorial', []).filter(m => m.snap).slice(0, 6)
    if (!others.length) makeOthers()
    const cards = [...mine.map((m, i) => ({ s: m.snap, mine: i })), ...others.map(s => ({ s }))]
    $('homeMem').innerHTML = cards.map((c, k) => `<div class="mc${c.mine != null ? ' mine' : ''}" ${c.mine != null ? `data-mine="${c.mine}"` : ''}><canvas class="pix" data-k="${k}"></canvas><div class="b"><div class="n">${esc(c.s.name)}</div><div class="y">${c.s.from} – ${c.s.to} · ${esc(c.s.home || '')}</div>${c.s.honor ? `<div class="honor sm">${esc(c.s.honor)}</div>` : ''}<div class="e">${esc(c.s.epitaph)}</div><span class="tag">${t(c.mine != null ? 'home.mem.mine' : 'home.mem.other')}</span></div></div>`).join('')
    $('homeMem').querySelectorAll('canvas[data-k]').forEach(cv => snapScene(cv, cards[+cv.dataset.k].s))
  }
  $('homeMem').addEventListener('click', e => {
    const c = e.target.closest('[data-mine]'); if (!c) return
    const m = store.get('memorial', []).filter(x => x.snap)[+c.dataset.mine]
    if (m) window.Pass.open(m.snap, 'home')
  })
  $('btnMoreLives').addEventListener('click', () => { makeOthers(); renderHomeMem(); $('homeMem').scrollLeft = 0 })

  applyText()
  renderHome()
  renderHomeMem()
  initLive()
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
