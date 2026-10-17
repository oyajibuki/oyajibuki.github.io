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
  function snapshot(p, peers = []) {
    const E = window.Engine, J = E.JOBS, R = window.RANKS
    const keep = ['change', 'up', 'life', 'bad', 'ai', 'end', 'leave', 'reflect']
    const milestones = p.log.filter((l, i) => i === 0 || keep.includes(l.kind)).map(l => ({ age: l.age, year: l.year, text: l.text, kind: l.kind }))
    return {
      id: p.id, name: p.name, sex: p.sex,
      from: E.START_YEAR, to: p.year, startAge: p.startAge, endAge: p.age,
      epitaph: E.epitaph(p), endReason: p.endReason,
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
  function chart(ctx, snap, x, y, w, h, progress = 1) {
    const all = [snap.history, ...snap.peers.map(q => q.history)]
    const a0 = Math.min(...all.map(hs => hs[0] ? hs[0].age : 99)), a1 = Math.max(70, ...all.map(hs => hs.length ? hs[hs.length - 1].age : 0))
    const vmax = Math.max(CT.money.ticks[0] * 0.8, ...all.flat().map(h => h.income)) * 1.1
    const X = a => x + (a - a0) / (a1 - a0) * w, Y = v => y + h - v / vmax * h
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.setLineDash([6, 8])
    for (const v of CT.money.ticks.slice(0, 3)) if (v < vmax) { ctx.beginPath(); ctx.moveTo(x, Y(v)); ctx.lineTo(x + w, Y(v)); ctx.stroke(); ctx.fillStyle = C.muted; ctx.font = `22px ${SANS}`; ctx.fillText(man(v), x + w - 110, Y(v) - 8) }
    ctx.setLineDash([])
    const line = (hs, color, lw, part) => {
      const n = Math.max(1, Math.floor(hs.length * part))
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.beginPath()
      hs.slice(0, n).forEach((pt, i) => i ? ctx.lineTo(X(pt.age), Y(pt.income)) : ctx.moveTo(X(pt.age), Y(pt.income)))
      ctx.stroke()
    }
    ctx.globalAlpha = 0.4; for (const q of snap.peers) line(q.history, C.muted, 2, progress); ctx.globalAlpha = 1
    line(snap.history, C.accent, 6, progress)
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
    ctx.font = `500 40px ${SERIF}`; let y = wrap(ctx, snap.epitaph, 56, 320, W - 112, 54, 2)
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
      <p class="pr-epitaph">${esc(snap.epitaph)}</p>
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
  }
  async function showWorks(snap) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'pass'))
    window.scrollTo(0, 0)
    $('passTitle').textContent = t('pass.works', { name: snap.name })
    $('videoStatus').textContent = ''
    $('videoOut').innerHTML = ''
    await drawImage($('passCanvas'), snap)
  }
  $('buyClose').addEventListener('click', () => $('buyModal').classList.add('hidden'))
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

  window.Pass = { snapshot, open, isOwned, resume, drawImage, makeVideo }
})()
