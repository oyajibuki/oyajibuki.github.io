# 7千万分の1 — Threads 毎日自動投稿

毎日 20:00 ごろ（日本時間）に GitHub Actions が「7千万分の1」をおまかせで1回遊び、ゲーム内と同じシェア用カード（1080×1350）と結果の文章を Threads に投稿する。

```
GitHub Actions（.github/workflows/jobgame-threads.yml）
  1. play.mjs  … リポジトリをローカル配信して jobgame/?bot=1 を開き、window.JGBot.run() でおまかせ早送り → out/card.png・out/post.txt
  2. カード画像を jobgame-threads ブランチに置く（毎回その日の1枚だけに上書き）→ raw.githubusercontent.com の公開URL
  3. post.mjs  … Threads API で画像つき投稿
  4. アクセストークンを60日延長して Secret を上書き
```

## 最初に1回だけやること

### 1. Threads のアクセストークンをつくる（無料）
1. https://developers.facebook.com/apps でアプリを作成し、ユースケース「Threads API にアクセス」を選ぶ
2. 権限 `threads_basic` と `threads_content_publish` を追加
3. 「アプリの役割」→「Threads テスター」に投稿したい Threads アカウントを追加し、Threads アプリの「設定 → アカウント → ウェブサイトのアクセス許可 → 招待」で承認
4. ユースケースの設定画面の「ユーザートークン生成ツール」でトークンを発行
   - 1時間で切れる短期トークンだったら、60日の長期トークンに交換する:
     `curl "https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=<アプリシークレット>&access_token=<短期トークン>"`

アプリは開発モードのままで、自分（テスター）のアカウントには投稿できる。

### 2. GitHub の Secrets に入れる
リポジトリ oyajibuki.github.io の Settings → Secrets and variables → Actions:

| 名前 | 中身 |
|---|---|
| `THREADS_TOKEN` | 1 の長期トークン |
| `SECRETS_PAT` | （任意）トークンを自動で延長するための Fine-grained token。対象リポジトリは oyajibuki.github.io だけ、権限は「Secrets: Read and write」だけ。無ければ60日ごとに `THREADS_TOKEN` を手で入れ直す |

### 3. 試す
Actions → jobgame-threads → Run workflow
- `dry_run` にチェック（初期値）: カードと文章をつくるだけ。実行結果の Artifacts「jobgame-card」で確認できる
- チェックを外す: 実際に Threads に投稿する

## 手元で試す
```
cd tools/jobgame-threads && npm install && npx playwright install chromium && cd ../..
node tools/jobgame-threads/play.mjs                                   # out/ にカードと文章
IMAGE_URL=https://example.com/x.png DRY_RUN=1 node tools/jobgame-threads/post.mjs
```

## メモ
- 投稿の時間は `jobgame-threads.yml` の cron（UTC）。止めたいときは Actions の画面でワークフローを Disable
- 投稿文を変えたいときは `play.mjs` の `text`（500文字まで）
- ゲーム側の入口 `?bot=1` は `jobgame/js/ui.js` の最後。ふつうに遊ぶ人には何も変わらない
