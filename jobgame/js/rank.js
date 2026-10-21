// ランキング：引退画面で「載せる」を選んだ人生だけを集め、3つのランキングにする
// 集計は Google Apps Script（gas/ranking.gs）。URL が空ならこの機能ごと出さない

// SNS への共有（引退画面の結果とランキングの両方で使う）
// - X は twitter.com/intent/tweet のほうが、スマホで X アプリに渡りやすい
// - LINE は line.me/R/share に文章ごと渡す（lineit/share は文章を無視してリンクだけになる）
// - Facebook は文章を受け取れないので、文章をコピーしてから開く
window.Share = (function () {
  const enc = encodeURIComponent
  const urls = {
    x: (tx, u) => `https://twitter.com/intent/tweet?text=${enc(tx)}&url=${enc(u)}`,
    line: (tx, u) => `https://line.me/R/share?text=${enc(tx + '\n' + u)}`,
    fb: (tx, u) => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}`,
    threads: (tx, u) => `https://www.threads.net/intent/post?text=${enc(tx + '\n' + u)}`,
  }
  function toast(msg) {
    const el = document.createElement('div')
    el.className = 'toast'; el.textContent = msg
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 3500)
  }
  function open(k, tx, u) {
    if (!urls[k]) return
    if (k === 'fb' && navigator.clipboard) navigator.clipboard.writeText(tx + '\n' + u).then(() => toast(t('share.fbCopied'))).catch(() => {})
    window.open(urls[k](tx, u), '_blank', 'noopener')
  }
  return { open, toast }
})();

(function () {
  const RANK_URL = 'https://script.google.com/macros/s/AKfycbztjZWRO5m15MzLne1irfwyoKcujGB0Nx6kz8RP4xhKh2C-3f58S6oXKCSsPd6A8sr2jw/exec'
  const C = window.COUNTRY
  const $ = id => document.getElementById(id)
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const BOARDS = ['money', 'moves', 'rare']
  const SHARE_URL = 'https://oyajibuki.github.io/jobgame/' + (C.lang === 'ja' ? '' : `?lang=${C.lang}`)
  const KEY = `jg_${C.code}_ranked`
  const mine = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }
  const remember = (id, r) => { try { const m = mine(); m[id] = r; localStorage.setItem(KEY, JSON.stringify(m)) } catch {} }

  // 値の見せ方
  const fmt = (b, v) => b === 'money' ? C.money.fmt(v) : b === 'moves' ? t('rank.movesV', { n: v }) : t('rank.rareV', { n: Number(v).toLocaleString() })
  const who = n => n || t('rank.anon')

  async function getTop() {
    const r = await fetch(`${RANK_URL}?country=${C.code}`)
    return r.json()
  }
  async function post(entry) {
    // text/plain で送ると事前確認（CORS のプリフライト）が起きない
    const r = await fetch(RANK_URL, { method: 'POST', body: JSON.stringify(entry), headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
    return r.json()
  }

  // ---------- ホームのランキング表 ----------
  let board = 'money', top = null
  function drawHome() {
    const box = $('rankList')
    if (!top) return
    $('rankTabs').innerHTML = BOARDS.map(b => `<button class="${b === board ? 'on' : ''}" data-b="${b}">${t('rank.b.' + b)}</button>`).join('')
    const rows = top[board] || []
    const my = mine()
    const li = (e, i) => `<li class="${my[e.id] ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="nm">${esc(who(e.name))}<small>${esc(e.job || '')}${e.honor ? ' · ' + esc(e.honor) : ''}</small></span><b>${esc(fmt(board, e.value))}</b></li>`
    // 10位までは見せて、11位から先はたたむ
    box.innerHTML = rows.length ? rows.slice(0, 10).map(li).join('') : `<li class="empty">${t('rank.empty')}</li>`
    const rest = rows.slice(10)
    $('rankMoreBox').classList.toggle('hidden', !rest.length)
    $('rankMoreSum').textContent = t('rank.more', { n: rows.length })
    $('rankMore').innerHTML = rest.map((e, i) => li(e, i + 10)).join('')
    $('rankNote').textContent = t('rank.note', { n: (top.total || 0).toLocaleString() })
  }
  async function renderHome() {
    const sec = $('ranking')
    if (!RANK_URL || !sec) return
    try {
      top = await getTop(); sec.classList.remove('hidden'); drawHome()
      // シェアされたリンク（#ranking）から来た人には、ランキングを見せる
      if (location.hash === '#ranking') sec.scrollIntoView({ block: 'start' })
    } catch { sec.classList.add('hidden') }
  }
  $('rankAnon') && $('rankAnon').addEventListener('change', e => { $('rankName').disabled = e.target.checked })
  document.addEventListener('click', e => {
    const b = e.target.closest('#rankTabs [data-b]'); if (!b) return
    board = b.dataset.b; drawHome()
  })

  // ---------- 引退画面：載せる → 順位 → シェア ----------
  let cur = null, shareText = ''
  function offer(entry) {
    const box = $('eRank')
    if (!RANK_URL || !box) return
    cur = entry
    box.classList.remove('hidden')
    $('rankMine').innerHTML = BOARDS.map(b => `<div><span>${t('rank.b.' + b)}</span><b>${esc(fmt(b, entry[{ money: 'lifetime', moves: 'moves', rare: 'rare' }[b]]))}</b></div>`).join('')
    $('rankName').value = entry.name || ''
    $('rankAnon').checked = false; $('rankName').disabled = false
    const done = mine()[entry.id]
    if (done) showResult(done)
    else { $('rankForm').classList.remove('hidden'); $('rankResult').classList.add('hidden'); $('rankSend').disabled = false; $('rankStatus').textContent = '' }
  }
  function showResult(r) {
    $('rankForm').classList.add('hidden')
    $('rankResult').classList.remove('hidden')
    // いちばん上位のランキングを主役にする（同じなら生涯年収を優先）
    const best = BOARDS.slice().sort((a, b) => r.ranks[a] - r.ranks[b])[0]
    $('rankResult').querySelector('.rank-ranks').innerHTML = BOARDS.map(b => `<div class="${b === best ? 'best' : ''}"><span>${t('rank.b.' + b)}</span><b>${t('rank.pos', { n: r.ranks[b] })}</b><small>${t('rank.of', { n: r.total.toLocaleString() })}</small></div>`).join('')
    const key = { money: 'lifetime', moves: 'moves', rare: 'rare' }[best]
    shareText = t('rank.share', { board: t('rank.b.' + best), n: r.ranks[best], total: r.total.toLocaleString(), value: fmt(best, cur[key]), job: cur.job })
    $('rankShareText').textContent = shareText
  }
  $('rankSend') && $('rankSend').addEventListener('click', async () => {
    const btn = $('rankSend')
    btn.disabled = true; $('rankStatus').textContent = t('rank.sending')
    try {
      // 匿名にチェックしたときだけ名前を送らない
      const name = $('rankAnon').checked ? '' : $('rankName').value.replace(/[<>&"'`\\]/g, '').trim().slice(0, 12)
      const r = await post({ ...cur, name })
      if (!r.ok) throw new Error(r.error || 'error')
      const res = { ranks: r.ranks, total: r.total }
      remember(cur.id, res)
      top = r.top; drawHome()
      showResult(res)
    } catch {
      $('rankStatus').textContent = t('rank.fail'); btn.disabled = false
    }
  })
  document.addEventListener('click', e => {
    const b = e.target.closest('#rankResult [data-rshare]'); if (!b) return
    const k = b.dataset.rshare
    if (k === 'more' && navigator.share) { navigator.share({ text: shareText, url: SHARE_URL + '#ranking' }).catch(() => {}); return }
    window.Share.open(k, shareText, SHARE_URL + '#ranking')
  })

  window.Rank = { enabled: !!RANK_URL, offer, renderHome }
})()
