// ドット絵の場面を、画像ファイルを使わずコードで描く（職場・家・人物）
// 低い解像度（1マス＝1ドット）で描いて、CSS の image-rendering: pixelated で拡大する
(function () {
  const W = 192, H = 64

  // ---------- 乱数（同じ人生なら同じ絵になる） ----------
  function rng(seed) {
    let h = 2166136261
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    return () => { h += 0x6D2B79F5; let x = h; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
  }
  const pick = (r, a) => a[Math.floor(r() * a.length)]

  // ---------- 職業（ISCO の中分類）→ 服装と職場 ----------
  // ISCO はどの国でも共通なので、日本・アメリカの両方で同じ対応が使える
  function lookFor(isco) {
    const s = String(isco || '')
    const m = (outfit, place) => ({ outfit, place })
    if (/^0/.test(s)) return m('army', 'road')
    if (/^1[1-4]/.test(s)) return m('suit', 'office')
    if (s === '21') return m('lab', 'office')
    if (s === '22' || s === '32') return m('white', 'hospital')
    if (s === '23') return m('teacher', 'school')
    if (s === '24' || s === '26' || s === '33') return m('suit', 'office')
    if (s === '25' || s === '35') return m('casual', 'office')
    if (s === '31' || s === '74') return m('helmet', 'site')
    if (s === '34') return m('casual', 'shop')
    if (/^4/.test(s)) return m('suit', 'office')
    if (s === '51') return m('chef', 'shop')
    if (s === '52' || s === '94') return m('apron', 'shop')
    if (s === '53') return m('care', 'hospital')
    if (s === '54') return m('police', 'road')
    if (/^6/.test(s) || s === '92') return m('farm', 'farm')
    if (s === '71' || s === '93') return m('helmet', 'site')
    if (/^7/.test(s) || s === '81' || s === '82') return m('overall', 'factory')
    if (s === '83') return m('driver', 'road')
    if (s === '91' || s === '95' || s === '96') return m('work', 'road')
    return m('casual', 'office')
  }

  // ---------- 色 ----------
  const SKIN = { jp: ['#f3cba5', '#eec09a', '#f6d4b3'], us: ['#f3cba5', '#e2b48c', '#c68c5e', '#8d5a3b', '#f6d4b3'] }
  const HAIR = ['#2b2420', '#3b2a1e', '#4a3526', '#1e1a18', '#6b4a2e']
  const OUT = {
    suit: { body: '#34405a', leg: '#2a3346', acc: '#c24d5e' },
    lab: { body: '#e9ecef', leg: '#4a5568', acc: '#7fa7c9' },
    white: { body: '#f1f3f5', leg: '#f1f3f5', acc: '#d9708a', hat: 'nurse' },
    care: { body: '#e8a3b5', leg: '#4a5568', acc: '#ffffff' },
    teacher: { body: '#7b6d8d', leg: '#3b3f4a', acc: '#e7d7a8' },
    casual: { body: '#5b8bb0', leg: '#3b4250', acc: '#e9e1c8' },
    apron: { body: '#d97b3f', leg: '#3b4250', acc: '#f4efe4' },
    chef: { body: '#f4f4f4', leg: '#3b3f4a', acc: '#d9d9d9', hat: 'chef' },
    police: { body: '#2c3e66', leg: '#22304f', acc: '#d9b866', hat: 'cap' },
    army: { body: '#5e6b3e', leg: '#4a5531', acc: '#3c4426', hat: 'cap2' },
    farm: { body: '#6f8f4e', leg: '#4b5d7a', acc: '#e0c27a', hat: 'straw' },
    helmet: { body: '#e8902f', leg: '#3c4b66', acc: '#f2d14b', hat: 'helmet' },
    overall: { body: '#4f6fa3', leg: '#4f6fa3', acc: '#cfd6e2', hat: 'cap3' },
    driver: { body: '#3f6e5a', leg: '#2f3b46', acc: '#e7d7a8', hat: 'cap' },
    work: { body: '#7d8b6a', leg: '#4b5563', acc: '#f2d14b', hat: 'cap3' },
    kid: { body: '#6b8fd6', leg: '#3b4250', acc: '#ffffff' },
    kid2: { body: '#d97b9a', leg: '#3b4250', acc: '#ffffff' },
    home: { body: '#a8746a', leg: '#4b4f5a', acc: '#e9e1c8' },
    home2: { body: '#4f8a83', leg: '#3b4250', acc: '#e9e1c8' },
  }

  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h) }

  // ---------- 人物（大人 7×15、子ども 5×10） ----------
  // (x, y) は足もと中央
  function person(ctx, x, y, o) {
    const out = OUT[o.outfit] || OUT.casual
    const kid = o.age === 'kid'
    const w = kid ? 5 : 7, h = kid ? 10 : 15
    const L = Math.round(x - w / 2), T = y - h
    const hair = o.age === 'old' ? '#cfcfcf' : o.hair
    const skin = o.skin
    const step = o.step ? 1 : 0
    if (kid) {
      px(ctx, L + 1, T, 3, 1, hair)
      px(ctx, L, T + 1, 5, 3, skin); px(ctx, L, T + 1, 5, 1, hair)
      if (o.sex === 'f') { px(ctx, L - 1, T + 1, 1, 3, hair); px(ctx, L + 5, T + 1, 1, 3, hair) }
      px(ctx, L + 1, T + 2, 1, 1, '#2b2420'); px(ctx, L + 3, T + 2, 1, 1, '#2b2420')
      px(ctx, L, T + 4, 5, 3, out.body)
      px(ctx, L + (step ? 1 : 0), T + 7, 1, 3, out.leg); px(ctx, L + (step ? 3 : 4), T + 7, 1, 3, out.leg)
      return
    }
    // 髪・頭
    px(ctx, L + 1, T, 5, 2, hair)
    px(ctx, L + 1, T + 2, 5, 3, skin)
    px(ctx, L + 1, T + 2, 5, 1, hair)
    if (o.sex === 'f') { px(ctx, L, T + 1, 1, 5, hair); px(ctx, L + 6, T + 1, 1, 5, hair) }
    px(ctx, L + 2, T + 3, 1, 1, '#2b2420'); px(ctx, L + 4, T + 3, 1, 1, '#2b2420')
    // 帽子
    const hat = OUT[o.outfit] && OUT[o.outfit].hat
    if (hat === 'helmet') { px(ctx, L, T - 1, 7, 2, out.acc); px(ctx, L + 1, T - 2, 5, 1, out.acc) }
    if (hat === 'chef') { px(ctx, L + 1, T - 3, 5, 3, '#ffffff'); px(ctx, L + 1, T, 5, 1, '#e6e6e6') }
    if (hat === 'nurse') { px(ctx, L + 1, T - 1, 5, 2, '#ffffff'); px(ctx, L + 3, T - 1, 1, 1, out.acc) }
    if (hat === 'cap' || hat === 'cap2' || hat === 'cap3') { px(ctx, L + 1, T - 1, 5, 2, hat === 'cap3' ? out.acc : out.body); px(ctx, L + 5, T, 2, 1, out.leg); if (hat === 'cap') px(ctx, L + 3, T - 1, 1, 1, out.acc) }
    if (hat === 'straw') { px(ctx, L - 1, T, 9, 1, out.acc); px(ctx, L + 1, T - 2, 5, 2, out.acc) }
    // からだ
    px(ctx, L, T + 5, 7, 6, out.body)
    px(ctx, L - 0, T + 9, 1, 2, skin); px(ctx, L + 6, T + 9, 1, 2, skin)
    if (o.outfit === 'suit') { px(ctx, L + 2, T + 5, 3, 1, '#f4f4f4'); px(ctx, L + 3, T + 5, 1, 4, out.acc) }
    if (o.outfit === 'apron' || o.outfit === 'chef') px(ctx, L + 1, T + 7, 5, 4, out.acc)
    if (o.outfit === 'lab' || o.outfit === 'white') px(ctx, L + 3, T + 5, 1, 6, out.acc)
    if (o.outfit === 'overall') px(ctx, L + 1, T + 5, 1, 3, out.acc), px(ctx, L + 5, T + 5, 1, 3, out.acc)
    if (o.outfit === 'helmet' || o.outfit === 'work') px(ctx, L, T + 8, 7, 1, out.acc)
    if (o.outfit === 'police' || o.outfit === 'driver') px(ctx, L + 1, T + 6, 1, 1, out.acc)
    // 脚
    if (o.sex === 'f' && (o.outfit === 'white' || o.outfit === 'home' || o.outfit === 'care')) {
      px(ctx, L + 1, T + 11, 5, 2, out.leg); px(ctx, L + 2, T + 13, 1, 2, skin); px(ctx, L + 4, T + 13, 1, 2, skin)
    } else {
      px(ctx, L + 1 + step, T + 11, 2, 4, out.leg); px(ctx, L + 4 - step, T + 11, 2, 4, out.leg)
      px(ctx, L + 1 + step, T + 14, 2, 1, '#22201e'); px(ctx, L + 4 - step, T + 14, 2, 1, '#22201e')
    }
  }
  function dog(ctx, x, y) {
    px(ctx, x, y - 4, 6, 3, '#a8784e'); px(ctx, x + 5, y - 6, 3, 3, '#a8784e'); px(ctx, x + 7, y - 5, 1, 1, '#2b2420')
    px(ctx, x, y - 1, 1, 1, '#7a5537'); px(ctx, x + 4, y - 1, 1, 1, '#7a5537'); px(ctx, x - 1, y - 5, 1, 2, '#a8784e')
  }

  // ---------- 背景 ----------
  function sky(ctx, time) {
    const bands = time === 'dusk' ? ['#f2b8a0', '#f4c6a8', '#f6d4b6', '#f7e0c6'] : ['#a9cde3', '#bcd8e8', '#cfe2ec', '#e0ebef']
    bands.forEach((c, i) => px(ctx, 0, i * 12, W, 12, c))
    px(ctx, 0, 48, W, 16, bands[3])
  }
  function sun(ctx, x, y, time) { const c = time === 'dusk' ? '#f7a96b' : '#f5d77a'; px(ctx, x - 3, y - 2, 7, 5, c); px(ctx, x - 2, y - 3, 5, 7, c) }
  function cloud(ctx, x, y) { px(ctx, x, y, 14, 3, '#ffffff'); px(ctx, x + 3, y - 2, 7, 2, '#ffffff'); px(ctx, x + 1, y + 3, 12, 1, '#eef3f6') }
  function mountains(ctx, r) {
    for (let k = 0; k < 3; k++) {
      const cx = 20 + k * 70 + r() * 20, hgt = 14 + r() * 10, base = 46
      for (let i = 0; i < hgt; i++) px(ctx, cx - i * 2, base - hgt + i, i * 4 + 1, 1, k % 2 ? '#a9bfae' : '#9fb7a6')
    }
  }
  function city(ctx, r) {
    for (let x = 0; x < W; x += 10 + Math.floor(r() * 8)) {
      const h = 10 + Math.floor(r() * 18), w = 8 + Math.floor(r() * 6)
      px(ctx, x, 46 - h, w, h, '#b9c7d2')
      for (let yy = 46 - h + 2; yy < 44; yy += 3) for (let xx = x + 2; xx < x + w - 1; xx += 3) px(ctx, xx, yy, 1, 1, '#dde6ec')
    }
  }
  function ground(ctx, kind) {
    if (kind === 'road') {
      px(ctx, 0, 52, W, 12, '#8f8a7c'); px(ctx, 0, 52, W, 1, '#a39e90')
      for (let x = 4; x < W; x += 14) px(ctx, x, 58, 7, 1, '#d8d3c4')
    } else {
      px(ctx, 0, 52, W, 12, '#8db36a'); px(ctx, 0, 52, W, 1, '#a3c77f')
      for (let x = 2; x < W; x += 5) px(ctx, x, 53 + (x % 3), 1, 1, '#7aa45a')
    }
  }
  function house(ctx, x) {
    px(ctx, x, 36, 30, 16, '#efe7da')
    for (let i = 0; i < 7; i++) px(ctx, x - 3 + i, 29 + i, 36 - i * 2, 1, '#3f4a5c')
    px(ctx, x - 4, 35, 38, 2, '#36404f')
    px(ctx, x + 4, 41, 8, 11, '#8a6a4a'); px(ctx, x + 7, 41, 1, 11, '#c9b79a'); px(ctx, x + 4, 46, 8, 1, '#c9b79a')
    px(ctx, x + 18, 40, 8, 6, '#b7cfe0'); px(ctx, x + 21, 40, 1, 6, '#8a6a4a'); px(ctx, x + 18, 42, 8, 1, '#8a6a4a')
  }
  function office(ctx, x) {
    px(ctx, x, 14, 30, 38, '#cfd7de'); px(ctx, x, 14, 30, 2, '#9fabb6')
    for (let yy = 18; yy < 46; yy += 4) for (let xx = x + 3; xx < x + 28; xx += 5) px(ctx, xx, yy, 3, 2, '#86a6c2')
    px(ctx, x + 12, 44, 6, 8, '#5d6b78')
  }
  function factory(ctx, x) {
    px(ctx, x, 30, 40, 22, '#c9bfae')
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) px(ctx, x + i * 10 + j, 30 - j, 1, j, '#9a8f7e')
    px(ctx, x + 32, 12, 4, 18, '#9a8f7e'); px(ctx, x + 31, 10, 6, 2, '#7d735f')
    px(ctx, x + 30, 6, 4, 3, '#e6e6e6'); px(ctx, x + 26, 3, 5, 3, '#eeeeee')
    px(ctx, x + 6, 42, 8, 10, '#6e6556'); for (let xx = x + 18; xx < x + 38; xx += 5) px(ctx, xx, 36, 3, 3, '#86a6c2')
  }
  function hospital(ctx, x) {
    px(ctx, x, 20, 36, 32, '#f4f6f7'); px(ctx, x, 20, 36, 2, '#c9d3da')
    px(ctx, x + 15, 23, 6, 2, '#d9534f'); px(ctx, x + 17, 21, 2, 6, '#d9534f')
    for (let yy = 30; yy < 46; yy += 5) for (let xx = x + 3; xx < x + 34; xx += 6) px(ctx, xx, yy, 3, 3, '#a9c4d8')
    px(ctx, x + 14, 44, 8, 8, '#8fb1c9')
  }
  function school(ctx, x) {
    px(ctx, x, 26, 44, 26, '#efe1c8'); px(ctx, x + 16, 16, 12, 10, '#efe1c8'); px(ctx, x + 19, 18, 6, 6, '#ffffff'); px(ctx, x + 21, 19, 1, 3, '#333'); px(ctx, x + 21, 21, 2, 1, '#333')
    for (let xx = x + 3; xx < x + 42; xx += 6) px(ctx, xx, 32, 4, 4, '#9cc1d9'), px(ctx, xx, 40, 4, 4, '#9cc1d9')
    px(ctx, x + 19, 44, 6, 8, '#8a6a4a')
  }
  function shop(ctx, x) {
    px(ctx, x, 30, 34, 22, '#f2ead9')
    for (let i = 0; i < 34; i += 4) px(ctx, x + i, 28, 2, 5, '#d9708a'), px(ctx, x + i + 2, 28, 2, 5, '#ffffff')
    px(ctx, x + 3, 37, 18, 10, '#b7cfe0'); px(ctx, x + 24, 38, 7, 14, '#8a6a4a')
    px(ctx, x + 4, 44, 4, 3, '#f2d14b'); px(ctx, x + 10, 44, 4, 3, '#e8902f')
  }
  function farm(ctx, x) {
    px(ctx, x, 32, 26, 20, '#b5533c'); for (let i = 0; i < 6; i++) px(ctx, x - 2 + i, 26 + i, 30 - i * 2, 1, '#7d3a2a')
    px(ctx, x + 9, 40, 8, 12, '#efe7da'); px(ctx, x + 12, 40, 2, 12, '#7d3a2a')
    for (let r = 0; r < 3; r++) for (let xx = x + 32; xx < x + 80; xx += 4) px(ctx, xx, 44 + r * 3, 2, 2, '#5f8f3f')
  }
  function site(ctx, x) {
    px(ctx, x + 2, 8, 2, 44, '#e8b23a'); px(ctx, x + 2, 8, 40, 2, '#e8b23a'); px(ctx, x + 36, 10, 1, 14, '#555'); px(ctx, x + 34, 24, 5, 3, '#888')
    for (let yy = 30; yy < 52; yy += 6) px(ctx, x + 14, yy, 26, 1, '#9a8f7e')
    px(ctx, x + 14, 30, 1, 22, '#9a8f7e'); px(ctx, x + 39, 30, 1, 22, '#9a8f7e')
    for (let i = 0; i < 4; i++) px(ctx, x + 44 + i * 4, 48, 3, 4, i % 2 ? '#ffffff' : '#e8902f')
  }
  function pole(ctx, x) {
    px(ctx, x, 14, 2, 38, '#6b5a4a'); px(ctx, x - 4, 16, 10, 1, '#6b5a4a'); px(ctx, x - 3, 19, 8, 1, '#6b5a4a')
    for (let xx = 0; xx < W; xx += 2) { const y = 17 + Math.round(Math.sin((xx - x) / 40) * 2 + Math.abs(xx - x) / 60); if (Math.abs(xx - x) > 3) px(ctx, xx, y, 2, 1, 'rgba(70,70,70,.55)') }
  }
  function tree(ctx, x) { px(ctx, x, 40, 2, 12, '#6b4a2e'); px(ctx, x - 4, 30, 10, 11, '#6f9e5a'); px(ctx, x - 2, 28, 6, 2, '#6f9e5a'); px(ctx, x - 2, 32, 3, 3, '#86b56f') }
  function truck(ctx, x) { px(ctx, x, 42, 20, 9, '#e7e2d6'); px(ctx, x + 20, 45, 7, 6, '#3f6e5a'); px(ctx, x + 22, 46, 4, 2, '#b7cfe0'); px(ctx, x + 3, 51, 3, 2, '#333'); px(ctx, x + 21, 51, 3, 2, '#333') }

  const PLACE = { office, factory, hospital, school, shop, farm, site }

  // ---------- 場面 ----------
  // opts: { seed, place, time, people: [{ outfit, sex, age, skin, hair }], country, home: true/false, dog }
  function scene(canvas, opts) {
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false
    const r = rng(opts.seed || 'x')
    sky(ctx, opts.time || (r() < 0.35 ? 'dusk' : 'day'))
    sun(ctx, 150 + Math.floor(r() * 30), 10, opts.time)
    cloud(ctx, 20 + Math.floor(r() * 30), 8); cloud(ctx, 90 + Math.floor(r() * 30), 12)
    if (opts.place === 'farm' || r() < 0.4) mountains(ctx, r); else city(ctx, r)
    const place = opts.place || 'office'
    ground(ctx, place === 'farm' ? 'grass' : 'road')
    if (opts.home) { house(ctx, 10); tree(ctx, 52) }
    if (place === 'road') { pole(ctx, 168); truck(ctx, opts.home ? 140 : 20) } else (PLACE[place] || office)(ctx, opts.home ? 140 : 14)
    if (!opts.home && place !== 'road') tree(ctx, 70)
    const people = opts.people || []
    const start = opts.home ? 78 : 96, gap = 11
    people.forEach((p, i) => person(ctx, start + i * gap, 52, p))
    if (opts.dog) dog(ctx, start + people.length * gap, 52)
    return canvas
  }

  // 人生の情報から、登場人物をつくる
  function cast(o) {
    const r = rng(o.seed + 'cast')
    const skins = SKIN[o.country] || SKIN.jp
    const mk = (sex, outfit, age) => ({ sex, outfit, age, skin: pick(r, skins), hair: pick(r, HAIR) })
    const main = mk(o.sex, o.outfit, o.old ? 'old' : 'adult')
    const out = [main]
    if (o.spouse) out.push(mk(o.sex === 'm' ? 'f' : 'm', r() < 0.5 ? 'home' : 'home2', o.old ? 'old' : 'adult'))
    for (let i = 0; i < Math.min(3, o.kids || 0); i++) out.push(mk(r() < 0.5 ? 'm' : 'f', r() < 0.5 ? 'kid' : 'kid2', o.old ? 'adult' : 'kid'))
    return out
  }

  // ---------- ホームの動く場面：働きはじめる人が職場へ、離れる人が家へ ----------
  function live(canvas, country) {
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H
    const b = bg.getContext('2d'); b.imageSmoothingEnabled = false
    const r = rng('home' + country)
    sky(b, 'day'); sun(b, 170, 10, 'day'); city(b, r); ground(b, 'road'); house(b, 8); tree(b, 48); office(b, 150); pole(b, 120)
    const looks = ['suit', 'white', 'helmet', 'apron', 'chef', 'casual', 'farm', 'overall', 'police', 'care', 'driver', 'teacher']
    const skins = SKIN[country] || SKIN.jp
    const walkers = []
    let clouds = [[20, 8], [100, 12], [160, 6]]
    function spawn(dir) {
      const w = { x: dir > 0 ? 40 : 150, dir, step: 0, p: { sex: r() < 0.5 ? 'm' : 'f', outfit: pick(r, looks), age: dir < 0 && r() < 0.6 ? 'old' : 'adult', skin: pick(r, skins), hair: pick(r, HAIR) } }
      walkers.push(w)
    }
    let last = 0
    function draw(ts) {
      if (ts - last > 90) {
        last = ts
        ctx.drawImage(bg, 0, 0)
        clouds = clouds.map(([x, y]) => [x > W + 10 ? -20 : x + 0.15, y])
        clouds.forEach(([x, y]) => cloud(ctx, x, y))
        for (const w of walkers) { w.x += w.dir * 0.8; w.step = (w.step + 1) % 4 }
        for (let i = walkers.length - 1; i >= 0; i--) if (walkers[i].x > 162 || walkers[i].x < 28) walkers.splice(i, 1)
        walkers.forEach(w => person(ctx, w.x, 58, { ...w.p, step: w.step < 2 }))
      }
      if (canvas.isConnected) requestAnimationFrame(draw)
    }
    requestAnimationFrame(draw)
    return { hire: () => spawn(1), leave: () => spawn(-1) }
  }

  window.Pixel = { scene, cast, lookFor, live }
})()
