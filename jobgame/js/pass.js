// 職歴証明書パス：終わった仕事人生から作品（SNS画像・職歴書PDF・縦動画）をつくる
// 1つの人生につき1パス（日本 ¥480 / 米国 $3.99）。決済は Stripe Payment Link。支払い後は ?paid=<セッションID> で戻ってくる。
(function () {
  const $ = id => document.getElementById(id)
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const CT = window.COUNTRY
  const man = v => CT.money.fmt(v)
  const ageL = n => t('unit.age', { n })

  // 価格と決済先は国ごと（Stripe Payment Link の URL。空のあいだは「テスト購入」で開く）
  window.PASS_CONFIG = window.PASS_CONFIG || {
    price: { jp: '¥480', us: '$3.99' }[CT.code] || '',
    // 本番（live）のリンク。テストモードのリンクは README に控えてある
    // 手元（localhost）では決済に飛ばさず、そのまま作品を開く（開発者の確認用）
    checkoutUrl: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? '' : {
      jp: 'https://buy.stripe.com/8x2eVd4ND1VkbgBgTrcjS03',
      us: 'https://buy.stripe.com/00wdR9bc1eI6fwR9qZcjS04',
    }[CT.code] || '',
  }

  // ---------- 購入状態（このブラウザだけに保存） ----------
  const PK = 'jg_pass'
  const owned = () => { try { return JSON.parse(localStorage.getItem(PK) || '[]') } catch { return [] } }
  const isOwned = id => owned().includes(id)
  function grant(id) { try { localStorage.setItem(PK, JSON.stringify([...new Set([...owned(), id])])) } catch {} }
  // 決済に出るあいだ、どの人生の作品か覚えておく（戻ってきたら作品を開く）
  const PEND = 'jg_pass_pending'
  // 決済から戻ったとき：?paid= があれば預けておいた人生にパスを付ける。サーバー検証はしない（静的サイトのため）
  function resume() {
    const q = new URLSearchParams(location.search)
    const paid = q.get('paid')
    if (!paid) return null
    q.delete('paid')
    history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : '') + location.hash)
    let snap = null
    try { snap = JSON.parse(localStorage.getItem(PEND) || 'null'); localStorage.removeItem(PEND) } catch {}
    if (!snap || !/^cs_/.test(paid)) return null
    grant(snap.id)
    return snap
  }

  // ---------- 人生のスナップショット ----------
  // 作品づくりに必要なものだけを、メモリアルにも保存できる形で抜き出す
  function snapshot(p, peers = [], extra = {}) {
    const E = window.Engine, J = E.JOBS, R = window.RANKS
    const keep = ['change', 'up', 'life', 'bad', 'ai', 'end', 'leave', 'reflect']
    const milestones = p.log.filter((l, i) => i === 0 || keep.includes(l.kind)).map(l => ({ age: l.age, year: l.year, text: l.text, kind: l.kind }))
    return {
      id: p.id, name: p.name, sex: p.sex,
      from: E.START_YEAR, to: p.year, startAge: p.startAge, endAge: p.age,
      epitaph: E.epitaph(p), honor: extra.honor || E.honor(p), endReason: p.endReason, firstRare: (J[p.jobsHeld[0]] || {}).share ? Math.max(1, Math.round(1 / J[p.jobsHeld[0]].share)) : null,
      docs: docsData(p),
      firstJob: p.titles[0], titles: p.titles, edu: p.edu.name,
      home: p.home, place: p.place,
      workYears: p.workYears, lifetime: p.lifetime,
      peakIncome: Math.max(0, ...p.history.map(h => h.income)), peakRank: R[p.peakRank].name,
      licenses: p.licenses.map(k => window.LICENSES[k].name),
      family: window.Life.summary(p),
      history: p.history.map(h => ({ age: h.age, income: h.income })),
      milestones,
      peers: peers.map(q => ({ name: q.name, epitaph: E.epitaph(q), lifetime: q.lifetime, history: q.history.map(h => ({ age: h.age, income: h.income })) })),
    }
  }


  // ---------- 書類セットのための材料（スナップショットに入れる） ----------
  function docsData(p) {
    const E = window.Engine, J = E.JOBS, R = window.RANKS, H = p.history || []
    // いちばん長く就いていた職業（管理職の分類は除く。名刺の肩書きに使う）
    const cnt = {}
    H.forEach(h => { if (!E.isMgr(h.job)) cnt[h.job] = (cnt[h.job] || 0) + 1 })
    const mainCode = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || p.jobsHeld[0]
    const last = H.filter(h => h.job === mainCode).pop()
    const peakH = p.peakRank > 0 ? H.find(h => h.rank === p.peakRank) : null
    const f = p.family || {}
    return {
      firstCode: p.jobsHeld[0],
      startSelf: !!(p.log[0] && p.log[0].text.includes(t('emp.self'))),
      peak: peakH ? { year: peakH.year, rank: R[peakH.rank].name } : null,
      mainTitle: (last && last.title) || J[mainCode].label, mainIsco: J[mainCode].isco || '',
      mainMid: J[mainCode].midName, mainMajor: J[mainCode].major,
      pub: !!(CT.isPublic && CT.isPublic(J[mainCode])),
      spouse: f.spouse && !f.divorced ? f.spouse.name : null,
      married: f.marriedYears || 0,
      kids: (f.kids || []).map(k => k.name),
    }
  }

  // ---------- 5. 仕事人生の書類セット（辞令・表彰状・名刺・寄せ書き） ----------
  const HAND = '"Klee One", "Noto Sans JP", cursive'
  // 人生ごとに同じ結果になる乱数（会社名・同僚の名前を毎回変えないため）
  function seeded(str) {
    let h = 2166136261
    for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    return () => { h += 0x6D2B79F5; let x = h; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
  }
  const pickR = (r, a) => a[Math.floor(r() * a.length)]
  function docsCtx(snap) {
    const d = snap.docs || { firstCode: null, startSelf: false, peak: null, mainTitle: snap.firstJob, mainMid: '', mainMajor: '', pub: false, spouse: null, married: 0, kids: [] }
    const r = seeded(snap.id)
    const N = CT.names
    const person = () => { const s = r() < 0.5 ? 'm' : 'f'; const fam = pickR(r, N.family); return { fam, full: N.full(s, fam, pickR(r, N.given[s])) } }
    const company = d.pub ? t('docs.publicOrg', { place: snap.home, mid: d.mainMid }) : t('docs.company', { p: pickR(r, t('docs.coPrefix').split('|')), s: pickR(r, t('docs.coSuffix').split('|')) })
    const boss = person()
    return { d, r, company, boss, person }
  }
  async function docsFonts(text = '') {
    await fontsReady()
    try { await Promise.all([document.fonts.load(`600 32px ${HAND}`, text || 'あ'), document.fonts.load(`700 64px ${SERIF}`, text || 'あ'), document.fonts.load(`500 64px ${SERIF}`, text || 'あ')]) } catch {}
  }
  const docsText = (snap, k) => [snap.name, snap.firstJob, k.company, k.boss.full, k.d.mainTitle, k.d.mainMid, snap.home, snap.place, ...Object.keys(I18N[CT.lang] || {}).filter(x => x.startsWith('docs.')).map(x => t(x))].join('')
  function paper(ctx, x, y, W, H, color = '#fbf8ef') {
    ctx.fillStyle = color; ctx.fillRect(x, y, W, H)
    const r = seeded(W * H)
    ctx.fillStyle = 'rgba(120,100,60,.05)'
    for (let i = 0; i < 900; i++) ctx.fillRect(x + r() * W, y + r() * H, 2, 2)
  }
  function hanko(ctx, x, y, rad, text) {
    ctx.save()
    ctx.strokeStyle = '#c8302c'; ctx.lineWidth = rad * 0.1
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#c8302c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const chars = [...text]
    if (CT.lang === 'ja' && chars.length >= 2) {
      ctx.font = `700 ${rad * 0.72}px ${SERIF}`
      ctx.fillText(chars[0], x, y - rad * 0.36); ctx.fillText(chars[1], x, y + rad * 0.4)
    } else if (CT.lang === 'ja') {
      ctx.font = `700 ${rad}px ${SERIF}`; ctx.fillText(text, x, y + 2)
    } else {
      ctx.font = `700 ${rad * 0.34}px ${SERIF}`; ctx.fillText(text.slice(0, 8), x, y + 2)
    }
    ctx.restore()
  }
  // 中央ぞろえの折り返し
  function fitText(ctx, text, x, y, weight, size, maxW, font = SERIF) {
    let s = size; ctx.font = `${weight} ${s}px ${font}`
    while (ctx.measureText(text).width > maxW && s > 24) { s -= 4; ctx.font = `${weight} ${s}px ${font}` }
    ctx.fillText(text, x, y)
  }
  const NOHEAD = /^[、。，．」』）！？ー・…]/
  function wrapC(ctx, text, x, y, maxW, lh, maxLines = 12) {
    const tokens = CT.lang === 'ja' ? text.match(/[0-9A-Za-z,.%]+|./gu) || [] : text.split(/(?<= )/)
    const lines = []; let line = ''
    for (const tk of tokens) {
      if (line && ctx.measureText(line + tk).width > maxW && !NOHEAD.test(tk)) { lines.push(line); line = tk.trimStart() } else line += tk
    }
    if (line) lines.push(line)
    lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l.trim(), x, y + i * lh))
    return y + Math.min(lines.length, maxLines) * lh
  }

  // 辞令（いちばん上まで昇進した日。昇進がなければ採用の日）
  async function drawJirei(canvas, snap) {
    const k = docsCtx(snap); await docsFonts(docsText(snap, k))
    const W = 1240, H = 1754; canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d'); const { d, company, boss } = k
    paper(ctx, 0, 0, W, H)
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3; ctx.strokeRect(80, 80, W - 160, H - 160)
    ctx.lineWidth = 1; ctx.strokeRect(96, 96, W - 192, H - 192)
    ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center'
    fitText(ctx, t('docs.jirei.h'), W / 2, 330, 700, 120, W - 300)
    ctx.textAlign = 'left'; ctx.font = `500 64px ${SERIF}`
    ctx.fillText(t('docs.jirei.to', { name: snap.name }), 170, 520)
    ctx.textAlign = 'center'
    const self = d.startSelf && !d.peak
    const year = d.peak ? d.peak.year : snap.from
    if (d.peak) {
      ctx.fillStyle = '#444'; fitText(ctx, t('docs.jirei.dept', { mid: d.mainMid || d.mainTitle }), W / 2, 760, 500, 44, W - 320)
      ctx.fillStyle = '#1a1a1a'; fitText(ctx, t('docs.jirei.rank', { rank: d.peak.rank }), W / 2, 920, 700, 104, W - 300)
    } else {
      ctx.font = `700 76px ${SERIF}`
      wrapC(ctx, t(self ? 'docs.jirei.self' : 'docs.jirei.hire', { job: snap.firstJob }), W / 2, 820, W - 360, 108, 3)
    }
    ctx.font = `500 46px ${SERIF}`; ctx.fillText(t('docs.jirei.date', { year }), W / 2, 1180)
    ctx.textAlign = 'right'; ctx.font = `500 50px ${SERIF}`
    ctx.fillText(self ? t('brand') : company, W - 190, 1380)
    const sig = self ? t('docs.jirei.selfSig') : d.pub ? t('docs.jirei.pubSig') : t('docs.jirei.sig', { name: boss.full })
    ctx.font = `500 46px ${SERIF}`; ctx.fillText(sig, W - 270, 1470)
    hanko(ctx, W - 210, 1452, 48, self ? t('docs.seal') : d.pub ? t('docs.sealPub') : boss.fam)
    ctx.textAlign = 'center'; ctx.fillStyle = '#999'; ctx.font = `24px ${SANS}`; wrapC(ctx, t('docs.foot'), W / 2, H - 165, W - 300, 32, 2)
    return canvas
  }

  // 表彰状（勤続の表彰）
  async function drawAward(canvas, snap) {
    const k = docsCtx(snap); await docsFonts(docsText(snap, k))
    const W = 1240, H = 1754; canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d'); const { d } = k
    paper(ctx, 0, 0, W, H, '#fffdf6')
    const gold = '#b48a2c'
    ctx.strokeStyle = gold; ctx.lineWidth = 22; ctx.strokeRect(60, 60, W - 120, H - 120)
    ctx.lineWidth = 3; ctx.strokeRect(100, 100, W - 200, H - 200)
    ctx.fillStyle = gold
    for (const [x, y] of [[100, 100], [W - 100, 100], [100, H - 100], [W - 100, H - 100]]) { ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill() }
    ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center'
    fitText(ctx, t('docs.award.h'), W / 2, 360, 700, 132, W - 320)
    ctx.textAlign = 'left'; ctx.font = `500 66px ${SERIF}`; ctx.fillText(t('docs.award.to', { name: snap.name }), 180, 560)
    ctx.textAlign = 'center'; ctx.font = `500 48px ${SERIF}`
    const body = t('docs.award.body', { from: snap.from, job: snap.firstJob, n: snap.workYears, main: d.mainTitle })
    const y = wrapC(ctx, body, W / 2, 700, W - 380, 84, 8)
    const yd = Math.min(Math.max(y + 70, 1320), H - 360)
    ctx.font = `500 46px ${SERIF}`; ctx.fillText(t('docs.award.date', { year: snap.to }), W / 2, yd)
    ctx.font = `700 50px ${SERIF}`; ctx.fillText(t('docs.award.from'), W / 2 - 40, yd + 110)
    hanko(ctx, W / 2 - 40 + ctx.measureText(t('docs.award.from')).width / 2 + 70, yd + 95, 50, t('docs.seal'))
    ctx.textAlign = 'center'; ctx.fillStyle = '#999'; ctx.font = `24px ${SANS}`; wrapC(ctx, t('docs.foot'), W / 2, H - 165, W - 300, 32, 2)
    return canvas
  }

  // 名刺（いちばん長く就いた職業と、いちばん上の役職）
  async function drawCard(canvas, snap) {
    const k = docsCtx(snap); await docsFonts(docsText(snap, k))
    const W = 1400, H = 900; canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d'); const { d, company } = k
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#3b3026'); g.addColorStop(1, '#1d1712')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.035)
    const cw = 1050, ch = 600, x0 = -cw / 2, y0 = -ch / 2
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18
    ctx.fillStyle = '#fdfcf8'; ctx.fillRect(x0, y0, cw, ch)
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = C.accent; ctx.fillRect(x0, y0, 18, ch)
    ctx.fillStyle = '#222'; ctx.textAlign = 'left'
    ctx.font = `700 36px ${SANS}`; ctx.fillText(d.startSelf && !d.peak ? t('docs.card.self') : company, x0 + 70, y0 + 90)
    ctx.fillStyle = '#666'; ctx.font = `28px ${SANS}`; ctx.fillText(d.mainMid || '', x0 + 70, y0 + 140)
    ctx.fillStyle = '#333'
    const role = d.peak ? `${d.mainTitle}　${d.peak.rank}` : d.mainTitle
    let s = 36; ctx.font = `500 ${s}px ${SANS}`
    while (ctx.measureText(role).width > cw - 140 && s > 22) { s -= 2; ctx.font = `500 ${s}px ${SANS}` }
    ctx.fillText(role, x0 + 70, y0 + 300)
    ctx.fillStyle = '#111'; ctx.font = `700 92px ${SERIF}`; ctx.fillText(snap.name, x0 + 70, y0 + 420)
    ctx.fillStyle = '#777'; ctx.font = `26px ${SANS}`; ctx.fillText(t('docs.card.since', { year: snap.from, place: snap.place || snap.home }), x0 + 70, y0 + ch - 60)
    ctx.textAlign = 'right'; ctx.fillStyle = C.accent; ctx.font = `700 28px ${SERIF}`; ctx.fillText(t('brand'), x0 + cw - 50, y0 + ch - 60)
    ctx.restore()
    return canvas
  }

  // 寄せ書き（家族・同期・同僚から）
  function farewellMsgs(snap, k) {
    const { d, r, person } = k
    const msgs = []
    const parent = t(snap.sex === 'f' ? 'docs.fw.mom' : 'docs.fw.dad')
    if (d.spouse) msgs.push({ from: t('docs.fw.fromSpouse', { name: d.spouse }), text: t('docs.fw.spouse', { n: d.married }) })
    const kidPool = t('docs.fw.kid', { parent }).split('|')
    d.kids.slice(0, 2).forEach((kid, i) => msgs.push({ from: t('docs.fw.fromKid', { name: kid }), text: kidPool[i % kidPool.length] }))
    const peerPool = t('docs.fw.peer').split('|')
    const pb = Math.floor(r() * peerPool.length)
    ;(snap.peers || []).slice(0, 2).forEach((q, i) => msgs.push({ from: t('docs.fw.fromPeer', { name: q.name }), text: peerPool[(pb + i) % peerPool.length] }))
    const pool = t('docs.fw.colleague').split('|'), roles = t('docs.fw.roles').split('|')
    const used = new Set(msgs.map(m => m.text))
    for (let guard = 0; msgs.length < 8 && guard < 40; guard++) {
      const text = pickR(r, pool).replace('%job%', d.mainTitle).replace('%n%', snap.workYears)
      if (used.has(text)) continue
      used.add(text)
      msgs.push({ from: t('docs.fw.fromColleague', { role: pickR(r, roles), name: person().full }), text })
    }
    return msgs.slice(0, 8)
  }
  async function drawFarewell(canvas, snap) {
    const k = docsCtx(snap)
    const msgs = farewellMsgs(snap, k)
    await docsFonts(docsText(snap, k) + msgs.map(m => m.text + m.from).join(''))
    const W = 1400, H = 1400; canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#c9a548'; ctx.fillRect(0, 0, W, H)
    paper(ctx, 30, 30, W - 60, H - 60, '#fffaf0')
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(W / 2, H / 2, 250, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = C.accent; ctx.lineWidth = 6; ctx.stroke()
    ctx.textAlign = 'center'; ctx.fillStyle = C.accent
    ctx.font = `600 60px ${HAND}`; wrapC(ctx, t('docs.fw.center', { name: snap.name }), W / 2, H / 2 - 50, 420, 74, 2)
    ctx.fillStyle = '#333'; ctx.font = `600 38px ${HAND}`; ctx.fillText(t('docs.fw.center2', { n: snap.workYears }), W / 2, H / 2 + 110)
    const colors = ['#d9534f', '#2e6fd8', '#2a9d5c', '#e08a1e', '#8e44ad', '#c2185b', '#00838f', '#6d4c41']
    msgs.forEach((m, i) => {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / msgs.length)
      const cx = W / 2 + Math.cos(a) * 470, cy = H / 2 + Math.sin(a) * 450
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((k.r() - 0.5) * 0.22)
      ctx.fillStyle = colors[i % colors.length]; ctx.textAlign = 'center'
      ctx.font = `600 30px ${HAND}`
      const yEnd = wrapC(ctx, m.text, 0, -40, 330, 38, 5)
      ctx.font = `600 24px ${HAND}`; ctx.fillText(m.from, 0, yEnd + 6)
      ctx.restore()
    })
    return canvas
  }
  const DOCS = [['jirei', drawJirei], ['award', drawAward], ['card', drawCard], ['farewell', drawFarewell]]

  // ---------- 描画の共通部品 ----------
  const C = { bg: '#12171a', card: '#1b2327', line: '#2b363b', text: '#e6e9ea', muted: '#8e9a9f', accent: '#d9708a', green: '#6cc69a', yellow: '#d9b866', blue: '#6aa8d8' }
  const SERIF = '"Shippori Mincho", serif', SANS = '"Noto Sans JP", system-ui, sans-serif'
  async function fontsReady() {
    try { await Promise.all([document.fonts.load(`700 64px ${SERIF}`), document.fonts.load(`400 28px ${SANS}`), document.fonts.load(`700 28px ${SANS}`)]) } catch {}
  }
  // 日本語は1文字ずつ、英語などは単語ごとに折り返す
  function wrap(ctx, text, x, y, maxW, lh, maxLines = 99) {
    const tokens = CT.lang === 'ja' ? [...text] : text.split(/(?<= )/)
    let line = '', lines = 0
    for (const tk of tokens) {
      if (line && ctx.measureText(line + tk).width > maxW) {
        if (++lines >= maxLines) {
          let cut = line.trimEnd()
          while (cut && ctx.measureText(cut + '…').width > maxW) cut = cut.slice(0, -1)
          ctx.fillText(cut + '…', x, y); return y + lh
        }
        ctx.fillText(line.trimEnd(), x, y); y += lh; line = tk.trimStart()
      } else line += tk
    }
    if (line) { ctx.fillText(line, x, y); y += lh }
    return y
  }
  function chart(ctx, snap, x, y, w, h, progress = 1, labels = true) {
    const all = [snap.history, ...snap.peers.map(q => q.history)]
    const a0 = Math.min(...all.map(hs => hs[0] ? hs[0].age : 99)), a1 = Math.max(70, ...all.map(hs => hs.length ? hs[hs.length - 1].age : 0))
    const vmax = Math.max(CT.money.ticks[0] * 0.8, ...all.flat().map(h => h.income)) * 1.1
    const X = a => x + (a - a0) / (a1 - a0) * w, Y = v => y + h - v / vmax * h
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.setLineDash([6, 8])
    for (const v of CT.money.ticks.slice(0, 3)) if (v < vmax) { ctx.beginPath(); ctx.moveTo(x, Y(v)); ctx.lineTo(x + w, Y(v)); ctx.stroke(); if (labels) { ctx.fillStyle = C.muted; ctx.font = `22px ${SANS}`; ctx.fillText(man(v), x + w - 110, Y(v) - 8) } }
    ctx.setLineDash([])
    const line = (hs, color, lw, part) => {
      const n = Math.max(1, Math.floor(hs.length * part))
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.beginPath()
      hs.slice(0, n).forEach((pt, i) => i ? ctx.lineTo(X(pt.age), Y(pt.income)) : ctx.moveTo(X(pt.age), Y(pt.income)))
      ctx.stroke()
    }
    ctx.globalAlpha = 0.4; for (const q of snap.peers) line(q.history, C.muted, 2, progress); ctx.globalAlpha = 1
    line(snap.history, C.accent, 6, progress)
    return { X, Y }
  }
  const keyMilestones = (snap, n) => {
    const pri = { change: 3, up: 3, life: 2, end: 3, bad: 2, ai: 1, leave: 1, reflect: 0 }
    const ms = snap.milestones.slice(1).filter(m => pri[m.kind] >= 1)
    if (ms.length <= n) return ms
    return [...ms].sort((a, b) => pri[b.kind] - pri[a.kind]).slice(0, n).sort((a, b) => a.age - b.age)
  }

  // ---------- 1. SNS用画像（1080×1350） ----------
  async function drawImage(canvas, snap) {
    await fontsReady()
    const W = 1080, H = 1350
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = C.accent; ctx.fillRect(0, 0, W, 96)
    ctx.fillStyle = '#2a1118'; ctx.font = `700 34px ${SERIF}`; ctx.fillText(t('pass.card.doc'), 56, 62)
    ctx.font = `24px ${SANS}`; ctx.textAlign = 'right'; ctx.fillText(`${snap.from} – ${snap.to}`, W - 56, 60); ctx.textAlign = 'left'
    ctx.fillStyle = C.muted; ctx.font = `24px ${SANS}`; ctx.fillText(t('pass.card.name'), 56, 160)
    ctx.fillStyle = C.text; ctx.font = `700 84px ${SERIF}`; ctx.fillText(snap.name, 56, 250)
    // 称号（古いメモリアルには無い）
    let ey = 320
    if (snap.honor) { ctx.fillStyle = C.accent; ctx.font = `700 32px ${SANS}`; ctx.fillText(t('honor.label', { s: snap.honor }), 56, 318); ctx.fillStyle = C.text; ey = 382 }
    ctx.font = `500 40px ${SERIF}`; let y = wrap(ctx, snap.epitaph, 56, ey, W - 112, 54, 2)
    ctx.fillStyle = C.muted; ctx.font = `26px ${SANS}`
    y = wrap(ctx, t('pass.card.lead', { age: snap.startAge, job: snap.firstJob, reason: snap.endReason, places: `${snap.home}${snap.place !== snap.home ? ` → ${snap.place}` : ''}` }), 56, y + 16, W - 112, 38, 2)
    // 数字
    const stats = [[t('e.years'), t('unit.years', { n: snap.workYears })], [t('m.lifetime'), man(snap.lifetime)], [t('e.peak'), man(snap.peakIncome)], [t('e.rank'), snap.peakRank]]
    const sy = y + 30
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(56, sy - 6); ctx.lineTo(W - 56, sy - 6); ctx.stroke()
    stats.forEach(([k, v], i) => {
      const x = 56 + i * ((W - 112) / 4)
      ctx.fillStyle = C.muted; ctx.font = `22px ${SANS}`; ctx.fillText(k, x, sy + 36)
      ctx.fillStyle = C.text; ctx.font = `700 34px ${SANS}`; ctx.fillText(v, x, sy + 84)
    })
    // 年収グラフ
    ctx.fillStyle = C.muted; ctx.font = `22px ${SANS}`; ctx.fillText(t('pass.card.chart'), 56, sy + 150)
    chart(ctx, snap, 56, sy + 170, W - 112, 220)
    // 歩み
    let ty = sy + 450
    ctx.fillStyle = C.text; ctx.font = `700 28px ${SANS}`; ctx.fillText(t('pass.card.steps'), 56, ty); ty += 46
    // 下の家族の欄（2行）とフッターの分をあけておく
    const limit = H - 210
    for (const m of keyMilestones(snap, 6)) {
      if (ty > limit) break
      ctx.fillStyle = m.kind === 'bad' ? '#d97066' : m.kind === 'life' ? C.accent : m.kind === 'up' ? C.green : C.yellow
      ctx.font = `700 24px ${SANS}`; ctx.fillText(ageL(m.age), 56, ty)
      ctx.fillStyle = C.text; ctx.font = `24px ${SANS}`; ty = wrap(ctx, m.text, 160, ty, W - 216, 34, 1) + 12 // 1行に収めて多く並べる
    }
    // 家族
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(56, H - 186); ctx.lineTo(W - 56, H - 186); ctx.stroke()
    ctx.fillStyle = C.muted; ctx.font = `22px ${SANS}`; wrap(ctx, snap.family, 56, H - 148, W - 112, 32, 2)
    ctx.fillStyle = C.accent; ctx.font = `700 26px ${SERIF}`; ctx.fillText(t('brand'), 56, H - 40)
    ctx.fillStyle = C.muted; ctx.font = `20px ${SANS}`; ctx.textAlign = 'right'; ctx.fillText(t('pass.card.foot'), W - 56, H - 42); ctx.textAlign = 'left'
  }

  // ---------- 2. 職歴書PDF（印刷用ページ → 「PDFとして保存」） ----------
  function printDoc(snap) {
    const rows = snap.milestones.map(m => `<tr><td>${m.year}</td><td>${ageL(m.age)}</td><td>${esc(m.text)}</td></tr>`).join('')
    $('printArea').innerHTML = `
      <h1>${t('pass.pdf.h1')}</h1>
      <p class="pr-sub">${esc(t('pass.pdf.sub', { from: snap.from, to: snap.to, brand: t('brand') }))}</p>
      <table class="pr-head"><tr><th>${t('pass.pdf.name')}</th><td class="pr-name">${esc(snap.name)}</td></tr>
        <tr><th>${t('pass.pdf.edu')}</th><td>${esc(CT.lang === 'ja' ? snap.edu : snap.edu.charAt(0).toUpperCase() + snap.edu.slice(1))}</td></tr>
        <tr><th>${t('pass.pdf.place')}</th><td>${esc(snap.home)}${snap.place !== snap.home ? ` → ${esc(snap.place)}` : ''}</td></tr></table>
      ${snap.honor ? `<p class="pr-honor">${esc(t('honor.label', { s: snap.honor }))}</p>` : ''}<p class="pr-epitaph">${esc(snap.epitaph)}</p>
      <h2>${t('pass.pdf.history')}</h2>
      <table class="pr-table"><thead><tr><th>${t('pass.pdf.year')}</th><th>${t('pass.pdf.age')}</th><th>${t('pass.pdf.item')}</th></tr></thead><tbody>${rows}</tbody></table>
      <h2>${t('pass.pdf.lics')}</h2><p>${snap.licenses.length ? snap.licenses.map(esc).join(t('list.sep')) : t('pass.pdf.none')}</p>
      <h2>${t('pass.pdf.family')}</h2><p>${esc(snap.family)}</p>
      <h2>${t('pass.pdf.numbers')}</h2>
      <table class="pr-head"><tr><th>${t('e.years')}</th><td>${t('unit.years', { n: snap.workYears })}</td><th>${t('m.lifetime')}</th><td>${man(snap.lifetime)}</td></tr>
        <tr><th>${t('e.peak')}</th><td>${man(snap.peakIncome)}</td><th>${t('e.rank')}</th><td>${esc(snap.peakRank)}</td></tr></table>
      <p class="pr-note">${t('pass.pdf.note')}</p>`
    document.body.classList.add('printing')
    setTimeout(() => { window.print(); document.body.classList.remove('printing') }, 50)
  }

  // ---------- 3. 縦動画（1080×1920・約20秒） ----------
  function videoMime() {
    const cands = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
    return cands.find(c => window.MediaRecorder && MediaRecorder.isTypeSupported(c)) || null
  }
  async function makeVideo(snap, onProgress) {
    await fontsReady()
    const mime = videoMime()
    if (!mime) throw new Error(t('pass.videoNo'))
    const W = 1080, H = 1920, DUR = 20
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    const ms = keyMilestones(snap, 7)
    const fade = (tm, a, b) => Math.max(0, Math.min(1, (tm - a) / (b - a)))
    function frame(tm) {
      ctx.globalAlpha = 1; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H)
      // 0-3秒: タイトル
      ctx.textAlign = 'center'
      ctx.globalAlpha = fade(tm, 0, 1) * (1 - fade(tm, 3, 3.6))
      ctx.fillStyle = C.text; ctx.font = `700 120px ${SERIF}`; ctx.fillText(t('pass.v.title1'), W / 2, 820)
      ctx.fillStyle = C.accent; ctx.fillText(t('pass.v.title2'), W / 2, 960)
      ctx.fillStyle = C.muted; ctx.font = `36px ${SANS}`; ctx.fillText(t('pass.v.tag'), W / 2, 1080)
      // 3-6秒: 名前と最初の仕事
      ctx.globalAlpha = fade(tm, 3.2, 4) * (1 - fade(tm, 6, 6.5))
      ctx.fillStyle = C.text; ctx.font = `700 110px ${SERIF}`; ctx.fillText(snap.name, W / 2, 820)
      ctx.font = `40px ${SANS}`; ctx.fillStyle = C.muted; ctx.fillText(t('pass.v.start', { year: snap.from, age: snap.startAge, place: snap.home }), W / 2, 920)
      ctx.fillStyle = C.yellow; ctx.font = `700 52px ${SANS}`; wrap(ctx, t('quote', { s: snap.firstJob }), W / 2, 1040, W - 160, 64, 2)
      ctx.textAlign = 'left'
      // 6-15秒: 歩みと年収グラフ
      if (tm >= 6 && tm < 16) {
        ctx.globalAlpha = fade(tm, 6, 6.6) * (1 - fade(tm, 15.4, 16))
        ctx.fillStyle = C.muted; ctx.font = `30px ${SANS}`; ctx.fillText(t('pass.v.chart'), 80, 200)
        chart(ctx, snap, 80, 230, W - 160, 380, fade(tm, 6.2, 14.5))
        const per = 8.5 / Math.max(1, ms.length)
        let y = 760
        ms.forEach((m, i) => {
          const a = fade(tm, 6.5 + i * per, 7.1 + i * per)
          if (a <= 0) return
          ctx.globalAlpha = a * (1 - fade(tm, 15.4, 16))
          ctx.fillStyle = m.kind === 'bad' ? '#d97066' : m.kind === 'life' ? C.accent : m.kind === 'up' ? C.green : C.yellow
          ctx.font = `700 40px ${SANS}`; ctx.fillText(ageL(m.age), 80, y)
          ctx.fillStyle = C.text; ctx.font = `36px ${SANS}`; y = wrap(ctx, m.text, 250, y, W - 330, 50, 2) + 34
        })
      }
      // 15.5-20秒: ひとこと
      ctx.globalAlpha = fade(tm, 15.8, 16.8)
      ctx.textAlign = 'center'
      if (snap.honor) { ctx.fillStyle = C.accent; ctx.font = `700 44px ${SANS}`; wrap(ctx, t('honor.label', { s: snap.honor }), W / 2, 590, W - 160, 58, 2) }
      ctx.fillStyle = C.text; ctx.font = `700 64px ${SERIF}`
      wrap(ctx, snap.epitaph, W / 2, 760, W - 160, 88, 3)
      ctx.fillStyle = C.muted; ctx.font = `38px ${SANS}`; ctx.fillText(t('pass.v.end', { money: man(snap.lifetime), n: snap.workYears }), W / 2, 1060)
      ctx.font = `32px ${SANS}`; wrap(ctx, snap.family, W / 2, 1150, W - 200, 48, 3)
      ctx.fillStyle = C.accent; ctx.font = `700 44px ${SERIF}`; ctx.fillText(t('brand'), W / 2, H - 140)
      ctx.textAlign = 'left'; ctx.globalAlpha = 1
    }
    const stream = canvas.captureStream(30)
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
    const chunks = []
    rec.ondataavailable = e => e.data.size && chunks.push(e.data)
    const done = new Promise(res => { rec.onstop = res })
    rec.start(250)
    const t0 = performance.now()
    await new Promise(res => {
      const tick = () => {
        const el = (performance.now() - t0) / 1000
        frame(Math.min(el, DUR))
        onProgress && onProgress(Math.min(1, el / DUR))
        if (el < DUR) requestAnimationFrame(tick); else res()
      }
      tick()
    })
    rec.stop(); await done
    return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' }
  }

  // ---------- 4. ショート動画（物語の型・YouTube ショート / TikTok 向け） ----------
  // 断酒クエストのショートと同じ「年齢＋場面＋オチ」の型。冒頭1フレーム目から引きの文字を出す
  const shortLine = s => {
    const x = String(s).replace(/（[^）]*）|\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
    const m = CT.lang === 'ja' ? x.match(/^[^。]*。/) : x.match(/^[^.]*\./)
    return (m ? m[0] : x).trim()
  }
  const shortRank = snap => 1 + (snap.peers || []).filter(q => q.lifetime > snap.lifetime).length
  const shortBeats = snap => {
    // 「何も起きなかった」系（結婚はまだ・転勤を断った など）は物語にならないので外す
    const quiet = /まだ|断りました|見送|考えない|限定的|not yet|declined|turned down|limited/i
    const ms = snap.milestones.slice(1).filter(m => ['change', 'life', 'up', 'bad', 'leave'].includes(m.kind) && !quiet.test(m.text))
    // 種類が偏らないよう、転職→家族→昇進→つまずき→休職 の順に1つずつ取る（同じ文は1回だけ）
    const order = ['change', 'life', 'up', 'bad', 'leave'], picked = [], seen = new Set()
    for (let round = 0; picked.length < 4 && round < 4; round++) {
      for (const k of order) {
        if (picked.length >= 4) break
        const m = ms.filter(x => x.kind === k && !picked.includes(x) && !seen.has(shortLine(x.text)))[round === 0 ? 0 : 0]
        if (m) { picked.push(m); seen.add(shortLine(m.text)) }
      }
    }
    return picked.sort((a, b) => a.age - b.age)
  }
  // 太字＋黒縁の見出し文字（サムネの定番）
  function punch(ctx, text, x, y, size, color, maxW, font = SANS) {
    ctx.font = `900 ${size}px ${font}`
    let s = size
    while (maxW && ctx.measureText(text).width > maxW && s > 30) { s -= 4; ctx.font = `900 ${s}px ${font}` }
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(6, s * 0.14); ctx.strokeStyle = '#000'
    ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y)
  }
  // 折り返しつきの黒縁文字
  function punchWrap(ctx, text, x, y, size, color, maxW, lh, maxLines = 4) {
    ctx.font = `900 ${size}px ${SANS}`
    const tokens = CT.lang === 'ja' ? [...text] : text.split(/(?<= )/)
    const lines = []; let line = ''
    for (const tk of tokens) {
      if (line && ctx.measureText(line + tk).width > maxW) { lines.push(line); line = tk.trimStart() } else line += tk
    }
    if (line) lines.push(line)
    lines.slice(0, maxLines).forEach((l, i) => punch(ctx, l.trim(), x, y + i * lh, size, color))
    return y + Math.min(lines.length, maxLines) * lh
  }
  const RED = '#ff4d4d', YEL = '#ffd23f'
  function shortBg(ctx, W, H, tint) {
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H * 0.5, H * 0.8)
    g.addColorStop(0, tint || '#2a2f36'); g.addColorStop(1, '#07090b')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  }
  function shortHeader(ctx, W, snap, n) {
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 66, W, 120)
    punch(ctx, t('short.series', { n: n || '' }), W / 2, 148, 52, '#fff', W - 100)
  }
  function shortText(snap) {
    const rank = shortRank(snap)
    const vars = { age: snap.startAge, end: snap.endAge, job: snap.firstJob, money: man(snap.lifetime), rank, rare: snap.firstRare ? snap.firstRare.toLocaleString() : '', ep: snap.epitaph, name: snap.name, honor: snap.honor || snap.epitaph }
    return {
      title: t('short.ytTitle', vars),
      desc: t('short.ytDesc', vars) + '\n' + 'https://oyajibuki.github.io/jobgame/' + (CT.lang === 'ja' ? '' : `?lang=${CT.lang}`) + '\n\n' + t('short.tags'),
    }
  }
  // サムネイル（ショートの1フレーム目と同じ構図）
  async function drawShortThumb(canvas, snap) {
    await fontsReady()
    const W = 1080, H = 1920; canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    shortBg(ctx, W, H)
    shortHeader(ctx, W, snap)
    ctx.textAlign = 'center'
    punch(ctx, t('short.hook1', { age: snap.startAge }), W / 2, 560, 130, '#fff', W - 120)
    punch(ctx, t('short.thumbJobLead'), W / 2, 720, 72, '#fff', W - 120)
    punchWrap(ctx, t('quote', { s: snap.firstJob }), W / 2, 900, 120, YEL, W - 120, 150, 3)
    punch(ctx, t('short.thumbMoney'), W / 2, 1380, 70, '#fff', W - 120)
    punch(ctx, man(snap.lifetime), W / 2, 1540, 170, RED, W - 100)
    punch(ctx, t('short.cta'), W / 2, 1760, 60, '#fff', W - 120)
    return canvas
  }
  // ショート動画の音：素材ファイルを使わず、ブラウザの中で合成する（著作権の心配がない）
  function shortMime() {
    const cands = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs="avc1.42E01E, mp4a.40.2"', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus']
    return cands.find(c => window.MediaRecorder && MediaRecorder.isTypeSupported(c)) || videoMime()
  }
  function shortAudio(ac, out, T0, total, cues) {
    const at = s => T0 + s
    const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d) }
    const tone = (type, f, t, a, peak, d, dest = out) => {
      const o = ac.createOscillator(), g = ac.createGain()
      o.type = type; o.frequency.setValueAtTime(f, t); o.connect(g); g.connect(dest)
      env(g, t, a, peak, d); o.start(t); o.stop(t + a + d + 0.05)
      return o
    }
    const noise = (t, d, peak, hp = 1000) => {
      const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * d), ac.sampleRate), ch = b.getChannelData(0)
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain()
      f.type = 'highpass'; f.frequency.value = hp
      s.buffer = b; s.connect(f); f.connect(g); g.connect(out); env(g, t, 0.005, peak, d); s.start(t)
    }
    // BGM：やさしいピアノ風の分散和音（C - Am - F - G を2秒ずつ）
    const bgm = ac.createGain(); bgm.gain.value = 0.55; bgm.connect(out)
    const chords = [[261.6, 329.6, 392.0], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [196.0, 246.9, 293.7]]
    for (let s = 0, i = 0; s < total - 0.5; s += 2, i++) {
      const c = chords[i % 4]
      tone('sine', c[0] / 2, at(s), 0.02, 0.10, 1.9, bgm)
      ;[0, 1, 2, 1, 0, 1, 2, 1].forEach((k, j) => tone('triangle', c[k] * (j >= 4 ? 2 : 1), at(s + j * 0.25), 0.01, 0.045, 0.5, bgm))
    }
    // 効果音
    const hit = t => { // 〇〇歳：ドン＋キラッ
      const o = ac.createOscillator(), g = ac.createGain()
      o.type = 'sine'; o.frequency.setValueAtTime(150, at(t)); o.frequency.exponentialRampToValueAtTime(45, at(t) + 0.25)
      o.connect(g); g.connect(out); env(g, at(t), 0.005, 0.9, 0.35); o.start(at(t)); o.stop(at(t) + 0.45)
      noise(at(t), 0.08, 0.25, 2500)
      tone('triangle', 1318.5, at(t) + 0.03, 0.005, 0.12, 0.35)
    }
    const reveal = t => { // 職業の発表：ジャン
      ;[523.3, 659.3, 784.0].forEach(f => tone('sawtooth', f, at(t), 0.01, 0.07, 0.6))
      noise(at(t), 0.15, 0.15, 3000)
    }
    const ticks = (a, b) => { for (let s = a; s < b; s += 0.07) tone('square', 1800, at(s), 0.002, 0.03, 0.03) }
    const fanfare = t => { // 生涯年収が止まる：ジャーン
      ;[[523.3, 0], [659.3, 0], [784.0, 0], [1046.5, 0.12]].forEach(([f, d]) => { tone('sawtooth', f, at(t + d), 0.01, 0.08, 1.4); tone('triangle', f * 2, at(t + d), 0.01, 0.05, 1.2) })
      noise(at(t), 0.9, 0.18, 4000)
      hit(t)
    }
    const chime = t => [880, 1108.7, 1318.5, 1760].forEach((f, i) => tone('triangle', f, at(t + i * 0.12), 0.005, 0.12, 0.8))
    cues.forEach(([kind, t, b]) => ({ hit, reveal, fanfare, chime })[kind] ? ({ hit, reveal, fanfare, chime })[kind](t) : kind === 'ticks' && ticks(t, b))
  }
  async function makeShort(snap, onProgress) {
    await fontsReady()
    const mime = shortMime()
    if (!mime) throw new Error(t('pass.videoNo'))
    const W = 1080, H = 1920, DUR = 22
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    const beats = shortBeats(snap)
    const rank = shortRank(snap)
    const fade = (tm, a, b) => Math.max(0, Math.min(1, (tm - a) / (b - a)))
    const pop = (tm, a) => { const k = fade(tm, a, a + 0.25); return k <= 0 ? 0 : 1 + (1 - k) * 0.35 }
    const B0 = 5, BL = 2.2 // 出来事は5秒目から1つ2.2秒
    const climax = B0 + beats.length * BL
    const MW = W - 80 // 文字の最大幅（画面いっぱいに大きく）
    function frame(tm) {
      ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.textAlign = 'center'
      if (tm < 2.4) {
        // 0〜2.4秒：引き（1フレーム目から見える）
        shortBg(ctx, W, H); shortHeader(ctx, W, snap)
        punch(ctx, t('short.hook1', { age: snap.startAge }), W / 2, 860, 230, '#fff', MW)
        punch(ctx, t('short.hook2'), W / 2, 1120, 128, YEL, MW)
      } else if (tm < B0) {
        // 2.4〜5秒：職業の発表
        shortBg(ctx, W, H, '#3a2a12'); shortHeader(ctx, W, snap)
        punch(ctx, t('short.hook2'), W / 2, 600, 84, '#fff', MW)
        const s = pop(tm, 2.4)
        ctx.save(); ctx.translate(W / 2, 880); ctx.scale(s, s)
        punchWrap(ctx, t('quote', { s: snap.firstJob }), 0, 0, 150, YEL, W - 100, 180, 3)
        ctx.restore()
        if (snap.firstRare) { ctx.globalAlpha = fade(tm, 3.3, 3.6); punch(ctx, t('short.rare', { n: snap.firstRare.toLocaleString() }), W / 2, 1460, 96, RED, MW) }
      } else if (tm < climax) {
        // 出来事：1つずつ全画面で
        const i = Math.min(beats.length - 1, Math.floor((tm - B0) / BL))
        const m = beats[i], a = B0 + i * BL
        const tint = m.kind === 'bad' ? '#3a1414' : m.kind === 'life' ? '#3a1a2a' : m.kind === 'up' ? '#14301f' : '#1d2836'
        shortBg(ctx, W, H, tint); shortHeader(ctx, W, snap)
        const s = pop(tm, a)
        ctx.save(); ctx.translate(W / 2, 740); ctx.scale(s, s)
        punch(ctx, ageL(m.age), 0, 0, 250, m.kind === 'bad' ? RED : m.kind === 'up' ? '#5dffa0' : YEL, MW)
        ctx.restore()
        ctx.globalAlpha = fade(tm, a + 0.25, a + 0.5)
        punchWrap(ctx, shortLine(m.text), W / 2, 1010, 96, '#fff', W - 100, 128, 4)
      } else if (tm < climax + 4) {
        // 生涯年収の発表（数字が回ってから止まる）
        shortBg(ctx, W, H, '#2a2412'); shortHeader(ctx, W, snap)
        punch(ctx, t('short.end1', { end: snap.endAge }), W / 2, 700, 160, '#fff', MW)
        punch(ctx, t('short.end2'), W / 2, 900, 112, '#fff', MW)
        const k = fade(tm, climax + 1, climax + 2.6)
        if (k > 0) {
          const v = k < 1 ? snap.lifetime * (0.2 + 0.8 * k) * (0.97 + Math.random() * 0.06) : snap.lifetime
          const s = k >= 1 ? pop(tm, climax + 2.6) : 1
          ctx.save(); ctx.translate(W / 2, 1230); ctx.scale(s, s)
          punch(ctx, man(v), 0, 0, 250, RED, MW)
          ctx.restore()
        }
        ctx.globalAlpha = fade(tm, climax + 2.9, climax + 3.2)
        punch(ctx, t('short.rank', { n: rank }), W / 2, 1460, 100, YEL, MW)
      } else {
        // しめ：ひとこと＋呼びかけ
        shortBg(ctx, W, H); shortHeader(ctx, W, snap)
        ctx.globalAlpha = fade(tm, climax + 4, climax + 4.4)
        if (snap.honor) punchWrap(ctx, t('honor.label', { s: snap.honor }), W / 2, 330, 70, YEL, W - 100, 92, 2)
        punchWrap(ctx, snap.epitaph, W / 2, 640, 100, '#fff', W - 100, 132, 3)
        punch(ctx, t('short.cta'), W / 2, 1180, 120, YEL, MW)
        punch(ctx, t('short.search'), W / 2, 1360, 80, '#fff', MW)
        ctx.fillStyle = '#cfd6da'; ctx.font = `44px ${SANS}`; ctx.fillText('oyajibuki.github.io/jobgame', W / 2, 1480)
      }
      ctx.globalAlpha = 1
    }
    const total = Math.max(DUR, climax + 8)
    // 音のきっかけ：〇〇歳（冒頭と出来事ごと）、職業の発表、数字が回る音、生涯年収が止まる音、しめ
    const cues = [['hit', 0.05], ['reveal', 2.4], ...beats.map((m, i) => ['hit', B0 + i * BL]), ['hit', climax], ['ticks', climax + 1, climax + 2.6], ['fanfare', climax + 2.6], ['chime', climax + 4]]
    const video = canvas.captureStream(30)
    let ac = null, tracks = [...video.getVideoTracks()]
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)()
      await ac.resume()
      const dest = ac.createMediaStreamDestination()
      const master = ac.createGain(); master.gain.value = 0.8; master.connect(dest)
      tracks = [...tracks, ...dest.stream.getAudioTracks()]
      ac.__out = master
    } catch { ac = null }
    const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 160_000 })
    const chunks = []
    rec.ondataavailable = e => e.data.size && chunks.push(e.data)
    const done = new Promise(res => { rec.onstop = res })
    frame(0)
    rec.start(250)
    const t0 = performance.now()
    if (ac) shortAudio(ac, ac.__out, ac.currentTime + 0.02, total, cues)
    await new Promise(res => {
      const tick = () => {
        const el = (performance.now() - t0) / 1000
        frame(Math.min(el, total))
        onProgress && onProgress(Math.min(1, el / total))
        if (el < total) requestAnimationFrame(tick); else res()
      }
      tick()
    })
    rec.stop(); await done
    if (ac) ac.close()
    return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm', seconds: total }
  }

  function download(blobOrUrl, filename) {
    const a = document.createElement('a')
    a.href = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl)
    a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  }

  // ---------- 画面 ----------
  let cur = null
  // 作品画面を開く（未購入なら購入の案内）
  function open(snap, back = 'ending') {
    cur = snap
    $('passBack').dataset.go = back
    if (!isOwned(snap.id)) return showBuy(snap)
    showWorks(snap)
  }
  function showBuy(snap) {
    $('buyTitle').textContent = t('pass.buy.t', { name: snap.name })
    $('buyPrice').textContent = window.PASS_CONFIG.price
    $('buyModal').classList.remove('hidden')
    renderBuyPreview(snap)
  }

  // 購入前の見本：その人生で実際につくれるものを、小さく・透かし入りで見せる（保存はできない）
  let prevToken = 0
  async function renderBuyPreview(snap) {
    const box = $('buyPreview'), token = ++prevToken
    const items = [['img', drawImage, 'pass.prev.img'], ...DOCS.map(([k, fn]) => [k, fn, 'docs.name.' + k]), ['short', drawShortThumb, 'pass.prev.short']]
    box.innerHTML = items.map(([k, , l]) => `<figure data-prev="${k}"><canvas></canvas><figcaption>${t(l)}</figcaption></figure>`).join('')
    for (const [k, fn] of items) {
      if (token !== prevToken) return
      const fig = box.querySelector(`[data-prev="${k}"]`)
      try {
        const src = document.createElement('canvas')
        await fn(src, snap)
        if (token !== prevToken) return
        watermark(fig.querySelector('canvas'), src)
      } catch { fig.remove() } // 古いメモリアルなど、材料が足りないものは出さない
    }
  }
  // 縮小して（印刷やSNSに使えない解像度）、斜めに「SAMPLE」を敷き詰める
  function watermark(dst, src) {
    const h = 260, w = Math.round(src.width * h / src.height)
    dst.width = w; dst.height = h
    const g = dst.getContext('2d')
    g.drawImage(src, 0, 0, w, h)
    g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 7)
    const label = t('pass.sample')
    g.font = `800 ${Math.round(h / 9)}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.35)'; g.fillStyle = 'rgba(255,255,255,.6)'
    const step = g.measureText(label).width + h / 6
    for (let y = -h; y <= h; y += h / 3.4) for (let x = -w - (y / 2 % step); x <= w; x += step) { g.strokeText(label, x, y); g.fillText(label, x, y) }
    g.restore()
  }
  $('buyPreview').addEventListener('contextmenu', e => e.preventDefault())
  async function showWorks(snap) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'pass'))
    window.scrollTo(0, 0)
    $('passTitle').textContent = t('pass.works', { name: snap.name })
    $('videoStatus').textContent = ''
    $('videoOut').innerHTML = ''
    $('shortOut').innerHTML = ''; $('shortStatus').textContent = ''; $('shortCopy').textContent = t('short.copy')
    const st = shortText(snap); $('shortTitle').value = st.title; $('shortDesc').value = st.desc
    renderDocs(snap)
    await drawImage($('passCanvas'), snap)
  }
  $('buyClose').addEventListener('click', () => { prevToken++; $('buyModal').classList.add('hidden') })
  $('buyGo').addEventListener('click', () => {
    const url = window.PASS_CONFIG.checkoutUrl
    if (url) {
      try { localStorage.setItem(PEND, JSON.stringify(cur)) } catch {}
      location.href = `${url}?client_reference_id=${encodeURIComponent(cur.id)}&locale=${CT.lang}`
      return
    }
    // 試作：決済の代わりにこの端末で開く
    grant(cur.id)
    $('buyModal').classList.add('hidden')
    showWorks(cur)
  })
  $('dlImage').addEventListener('click', () => download($('passCanvas').toDataURL('image/png'), `${t('pass.file', { name: cur.name.replace(/\s+/g, '_') })}.png`))
  $('dlPdf').addEventListener('click', () => printDoc(cur))
  $('mkVideo').addEventListener('click', async () => {
    const btn = $('mkVideo')
    btn.disabled = true
    try {
      const { blob, ext } = await makeVideo(cur, r => { $('videoStatus').textContent = t('pass.videoMaking', { p: Math.round(r * 100) }) })
      const url = URL.createObjectURL(blob)
      $('videoStatus').textContent = t('pass.videoDone')
      $('videoOut').innerHTML = `<video src="${url}" controls playsinline></video><button class="btn primary" id="dlVideo">${t('pass.videoSave')}</button>`
      $('dlVideo').addEventListener('click', () => download(blob, `${t('pass.file', { name: cur.name.replace(/\s+/g, '_') })}.${ext}`))
    } catch (e) {
      $('videoStatus').textContent = e.message
    } finally { btn.disabled = false }
  })

  // ---------- 0. 無料のシェア用カード（1080×1350） ----------
  // 引退画面・ランキングから、画像つきで投稿するためのカード。
  // 有料の SNS 用画像（年収グラフ・歩み入り）と差をつけて、結果の要点だけを載せる。
  // extra: { scene: 描画済みのドット絵 canvas, top: '上位12%', peer: 同期内の順位, badge: ランキングの順位の一言 }
  async function drawShareCard(canvas, snap, extra = {}) {
    await fontsReady()
    const W = 1080, H = 1350, M = 64
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H)
    // 見出しの帯
    ctx.fillStyle = C.accent; ctx.fillRect(0, 0, W, 110)
    ctx.fillStyle = '#2a1118'; ctx.font = `700 46px ${SERIF}`; ctx.fillText(t('brand'), M, 72)
    ctx.font = `24px ${SANS}`; ctx.textAlign = 'right'; ctx.fillText(`${CT.code.toUpperCase()}-${snap.from}-${String(snap.id).toUpperCase()}`, W - M, 70); ctx.textAlign = 'left'
    // ドット絵（ぼかさずに拡大）
    let y = 140
    if (extra.scene && extra.scene.width) {
      // 空の上のほうを切って、地面と人物が入る横長の帯にする
      const sh = 220, sw = extra.scene.width, srcH = Math.min(extra.scene.height, Math.round(sw * sh / (W - M * 2)))
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(extra.scene, 0, extra.scene.height - srcH, sw, srcH, M, y, W - M * 2, sh)
      ctx.imageSmoothingEnabled = true
      ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.strokeRect(M, y, W - M * 2, sh)
      y += sh + 50
    } else y += 40
    // 名前・期間・称号
    ctx.fillStyle = C.accent; ctx.font = `700 26px ${SANS}`; ctx.fillText(t('card.rec'), M, y)
    if (extra.badge) { ctx.textAlign = 'right'; ctx.fillStyle = C.yellow; ctx.font = `700 30px ${SANS}`; ctx.fillText(extra.badge, W - M, y); ctx.textAlign = 'left' }
    ctx.fillStyle = C.text; fitText(ctx, snap.name, M, y + 82, 700, 76, W - M * 2)
    ctx.fillStyle = C.muted; ctx.font = `28px ${SANS}`
    ctx.fillText(t('card.meta', { from: snap.from, to: snap.to, n: snap.workYears, place: snap.place || snap.home || '' }), M, y + 128)
    if (snap.honor) { ctx.fillStyle = C.accent; ctx.font = `700 32px ${SANS}`; wrap(ctx, t('honor.label', { s: snap.honor }), M, y + 176, W - M * 2, 40, 1) }
    y += 210
    // 6つの数字（2列×3段）
    const d = snap.docs || {}
    const cells = [
      [t('card.first'), snap.firstJob], [t('card.main'), d.mainTitle || snap.firstJob],
      [t('card.money'), man(snap.lifetime)], [t('card.rank'), snap.peakRank],
      [t('card.rare'), snap.firstRare ? t('e.hi.rareV', { n: snap.firstRare.toLocaleString() }) : '—'], [t('card.end'), t('card.endV', { age: snap.endAge })],
    ]
    const cw = (W - M * 2) / 2
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke()
    cells.forEach(([k, v], i) => {
      const x = M + (i % 2) * cw, cy = y + 46 + Math.floor(i / 2) * 96
      ctx.fillStyle = C.muted; ctx.font = `22px ${SANS}`; ctx.fillText(k, x, cy)
      ctx.fillStyle = C.text; fitText(ctx, String(v), x, cy + 46, 700, 36, cw - 24, SANS)
    })
    y += 46 + 3 * 96
    // 大きな数字：同じ年に働きはじめた人の中の位置
    ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(M, y - 20); ctx.lineTo(W - M, y - 20); ctx.stroke()
    if (extra.top) {
      ctx.fillStyle = C.accent; ctx.font = `700 104px ${SERIF}`; ctx.fillText(extra.top, M, y + 100)
      ctx.fillStyle = C.muted; ctx.font = `24px ${SANS}`
      ctx.fillText(t('card.topCap'), M, y + 142)
      if (extra.peer) ctx.fillText(t('card.peers', { n: extra.peer }), M, y + 176)
    }
    // 年収の推移（小さく）
    if (snap.history && snap.history.length > 1) {
      const gx = W / 2 + 20, gw = W / 2 - M - 20
      const { X, Y } = chart(ctx, { ...snap, peers: snap.peers || [] }, gx, y + 40, gw, 140, 1, false)
      // いちばん年収が高かった年に印をつけ、グラフの上に「最高 ◯◯（◯歳）」
      const pk = snap.history.reduce((a, h) => (h.income > a.income ? h : a), snap.history[0])
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(X(pk.age), Y(pk.income), 9, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = C.bg; ctx.lineWidth = 3; ctx.stroke()
      ctx.fillStyle = C.text; ctx.font = `700 26px ${SANS}`; ctx.textAlign = 'right'
      ctx.fillText(t('card.peak', { money: man(pk.income), age: pk.age }), gx + gw, y + 18); ctx.textAlign = 'left'
    }
    // 墓碑銘と呼びかけ
    ctx.fillStyle = C.text; ctx.font = `500 30px ${SERIF}`; wrap(ctx, `“${snap.epitaph}”`, M, H - 120, W - M * 2, 40, 1)
    ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(M, H - 90); ctx.lineTo(W - M, H - 90); ctx.stroke()
    ctx.fillStyle = C.accent; ctx.textAlign = 'right'; ctx.font = `700 26px ${SANS}`; ctx.fillText('oyajibuki.github.io/jobgame', W - M, H - 44); ctx.textAlign = 'left'
    const urlW = ctx.measureText('oyajibuki.github.io/jobgame').width
    ctx.fillStyle = C.text; fitText(ctx, t('card.cta'), M, H - 44, 700, 26, W - M * 2 - urlW - 24, SANS)
    return canvas
  }
  // ランキングに保存する、カードを描き直すための最小限のデータ
  function cardData(snap, extra = {}) {
    const d = snap.docs || {}
    const h = hs => (hs || []).map(x => [x.age, Math.round(x.income)])
    return {
      v: 1, id: snap.id, name: snap.name, sex: snap.sex, from: snap.from, to: snap.to, n: snap.workYears, place: snap.place || snap.home || '',
      honor: snap.honor || '', first: snap.firstJob, main: d.mainTitle || snap.firstJob, money: Math.round(snap.lifetime), rank: snap.peakRank,
      rare: snap.firstRare || 0, end: snap.endAge, ep: snap.epitaph, top: extra.top || '', peer: extra.peer || 0,
      h: h(snap.history), p: (snap.peers || []).map(q => h(q.history)),
      sc: { isco: d.mainIsco || '', sp: !!d.spouse, k: (d.kids || []).length, dog: String(snap.id).charCodeAt(0) % 3 === 0 },
    }
  }
  // 保存したデータからカードを描く（ランキングで人を押したとき）
  async function drawCardFromData(canvas, c, name) {
    const look = window.Pixel.lookFor(c.sc.isco)
    const scene = window.Pixel.scene(document.createElement('canvas'), {
      seed: c.id, place: look.place, home: c.sc.sp || c.sc.k > 0, dog: c.sc.dog,
      people: window.Pixel.cast({ seed: c.id, sex: c.sex, outfit: look.outfit, spouse: c.sc.sp, kids: c.sc.k, country: CT.code }),
    })
    const hist = hs => hs.map(([age, income]) => ({ age, income }))
    const snap = {
      id: c.id, name, sex: c.sex, from: c.from, to: c.to, workYears: c.n, place: c.place, honor: c.honor, firstJob: c.first,
      docs: { mainTitle: c.main }, lifetime: c.money, peakRank: c.rank, firstRare: c.rare, endAge: c.end, epitaph: c.ep,
      history: hist(c.h), peers: c.p.map(x => ({ history: hist(x) })),
    }
    return drawShareCard(canvas, snap, { scene, top: c.top, peer: c.peer })
  }

  // カードを画像つきで共有する。スマホは共有シートに画像と文章を渡す。
  // 共有シートが使えない（主にパソコン）ときは、画像を保存して、文章入りの X の投稿画面を開く
  async function shareCard(blob, text, url, fname) {
    const file = new File([blob], fname, { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: `${text}\n${url}` }); return 'shared' } catch (e) { if (e && e.name === 'AbortError') return 'cancel' }
    }
    download(blob, fname)
    window.Share.open('x', text, url)
    window.Share.toast(t('card.pcNote'))
    return 'saved'
  }

  // ---------- 画像・動画を SNS へ ----------
  // スマホでは共有シート（Instagram・TikTok・LINE などを選べる）にファイルごと渡す。
  // パソコンなど共有シートが使えないときは、保存してから各サービスの投稿画面を開き、文章はコピーしておく
  const UPLOAD = { yt: 'https://www.youtube.com/upload', ig: 'https://www.instagram.com/', tt: 'https://www.tiktok.com/upload', x: 'https://x.com/compose/post', line: 'https://line.me/R/', fb: 'https://www.facebook.com/' }
  async function shareFile(blob, fname, where) {
    const st = shortText(cur)
    const text = `${st.title}\n${'https://oyajibuki.github.io/jobgame/' + (CT.lang === 'ja' ? '' : `?lang=${CT.lang}`)}\n${t('short.tags')}`
    const file = new File([blob], fname, { type: blob.type })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text, title: st.title }); return } catch (e) { if (e && e.name === 'AbortError') return }
    }
    download(blob, fname)
    try { await navigator.clipboard.writeText(text) } catch {}
    window.open(UPLOAD[where] || UPLOAD.x, '_blank', 'noopener')
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-imgshare]'); if (!b) return
    const blob = await new Promise(r => $('passCanvas').toBlob(r, 'image/png'))
    shareFile(blob, `${t('pass.file', { name: cur.name.replace(/\s+/g, '_') })}.png`, b.dataset.imgshare)
  })

  // 書類セット：4枚を並べて、1枚ずつ／まとめて保存
  async function renderDocs(snap) {
    $('docsGrid').innerHTML = DOCS.map(([k]) => `<figure><canvas id="doc_${k}"></canvas><figcaption><span>${t('docs.name.' + k)}</span><button class="btn sm" data-doc="${k}">${t('docs.save')}</button></figcaption></figure>`).join('')
    for (const [k, fn] of DOCS) await fn($('doc_' + k), snap)
  }
  const docFile = k => `${t('pass.file', { name: cur.name.replace(/\s+/g, '_') })}_${t('docs.name.' + k)}.png`
  $('docsGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-doc]'); if (!b) return
    download($('doc_' + b.dataset.doc).toDataURL('image/png'), docFile(b.dataset.doc))
  })
  $('docsAll').addEventListener('click', async () => {
    for (const [k] of DOCS) { download($('doc_' + k).toDataURL('image/png'), docFile(k)); await new Promise(r => setTimeout(r, 400)) }
  })

  // ショート動画（物語）
  $('mkShort').addEventListener('click', async () => {
    const btn = $('mkShort')
    btn.disabled = true
    try {
      const { blob, ext } = await makeShort(cur, r => { $('shortStatus').textContent = t('pass.videoMaking', { p: Math.round(r * 100) }) })
      const url = URL.createObjectURL(blob)
      $('shortStatus').textContent = t('pass.videoDone')
      const fname = `${t('pass.file', { name: cur.name.replace(/\s+/g, '_') })}_short.${ext}`
      $('shortOut').innerHTML = `<video src="${url}" controls playsinline></video><div class="cta-row"><button class="btn primary" id="dlShort">${t('pass.videoSave')}</button><button class="btn share-yt" data-vshare="yt">YouTube ${t('share.shorts')}</button><button class="btn share-ig" data-vshare="ig">Instagram ${t('share.reels')}</button><button class="btn share-tt" data-vshare="tt">TikTok</button></div><div class="share-note">${t('share.videoNote')}</div>`
      $('dlShort').addEventListener('click', () => download(blob, fname))
      $('shortOut').querySelectorAll('[data-vshare]').forEach(b => b.addEventListener('click', () => shareFile(blob, fname, b.dataset.vshare)))
    } catch (e) {
      $('shortStatus').textContent = e.message
    } finally { btn.disabled = false }
  })
  $('dlThumb').addEventListener('click', async () => {
    const c = await drawShortThumb(document.createElement('canvas'), cur)
    download(c.toDataURL('image/png'), `${t('pass.file', { name: cur.name.replace(/\s+/g, '_') })}_thumb.png`)
  })
  $('shortCopy').addEventListener('click', async () => {
    const s = shortText(cur)
    try { await navigator.clipboard.writeText(`${s.title}\n\n${s.desc}`); $('shortCopy').textContent = t('short.copied') } catch {}
  })

  window.Pass = { snapshot, open, isOwned, resume, drawShareCard, shareCard, cardData, drawCardFromData, drawImage, makeVideo, makeShort, drawShortThumb, shortText, shortBeats, drawJirei, drawAward, drawCard, drawFarewell }
})()
