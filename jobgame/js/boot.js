// 言語（＝国）を決めて、その国のデータパックとゲーム本体を順に読み込む
// ?lang=en → アメリカ。選んだ言語はこのブラウザに覚えておく。
(function () {
  // ファイルを更新したらここを変える（ブラウザのキャッシュで古いスクリプトが混ざらないように）
  const VERSION = '0.4.4'
  const q = new URLSearchParams(location.search)
  let lang = q.get('lang')
  try { lang = lang || localStorage.getItem('jg_lang') } catch {}
  if (!lang) lang = (navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en'
  const L = window.LANGS.find(l => l.lang === lang) || window.LANGS[0]
  try { localStorage.setItem('jg_lang', L.lang) } catch {}
  document.documentElement.lang = L.lang
  const dir = `data/countries/${L.country}`
  const files = ['data/isco.js', `${dir}/tree.js`, `${dir}/stats.js`, `${dir}/params.js`, 'js/engine.js', 'js/life.js', 'js/pixel.js', 'js/pass.js', 'js/ui.js']
  for (const f of files) {
    const s = document.createElement('script')
    s.src = `${f}?v=${VERSION}`; s.async = false
    document.body.appendChild(s)
  }
})()
