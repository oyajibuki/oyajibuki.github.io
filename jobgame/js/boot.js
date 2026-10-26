// 言語（＝国）を決めて、その国のデータパックとゲーム本体を順に読み込む
// 言語ごとにページが分かれている（日本語 = /jobgame/、英語 = /jobgame/en/。<html data-page> がそのページの言語）。
// 古いリンクの ?lang=en や、言語タブで選んで覚えた言語が今のページと違えば、その言語のページへ移る。
(function () {
  // ファイルを更新したらここを変える（ブラウザのキャッシュで古いスクリプトが混ざらないように）
  const VERSION = '0.8.9'
  const q = new URLSearchParams(location.search)
  const page = document.documentElement.dataset.page || 'ja'
  let lang = q.get('lang')
  // 覚えた言語を使うのは日本語のページ（入口）だけ。/en/ を開いた人には英語を出す
  if (!lang && page === 'ja') try { lang = localStorage.getItem('jg_lang') } catch {}
  const L = window.LANGS.find(l => l.lang === lang) || window.LANGS.find(l => l.lang === page)
  if (L.lang !== page) {
    q.delete('lang')
    location.replace(new URL((L.path || './') + (q.toString() ? `?${q}` : '') + location.hash, document.baseURI))
    return
  }
  document.documentElement.lang = L.lang
  const dir = `data/countries/${L.country}`
  const files = ['data/isco.js', `${dir}/tree.js`, `${dir}/stats.js`, `${dir}/params.js`, 'js/engine.js', 'js/life.js', 'js/pixel.js', 'js/pass.js', 'js/rank.js', 'js/ui.js']
  for (const f of files) {
    const s = document.createElement('script')
    s.src = `${f}?v=${VERSION}`; s.async = false
    document.body.appendChild(s)
  }
})()
