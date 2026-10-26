# threads-cron（Cloudflare Worker）

Threads の自動投稿（`jobgame-threads`・`threads-queue`）を、決まった時間に GitHub Actions で動かす。

GitHub の予定実行（cron）は混んでいると遅れたり飛ばされたりする。2026-10-26 は30分おきのはずが2〜4時間に1回しか動かず、
19:00 の EP01 と 20:00 のゲーム結果が出なかった。Keepalive も同じ予定実行の上で動いていて、2時間おきの設定で1日4〜5回しか動いていなかった。
頼まれた実行（workflow_dispatch）はすぐ動くので、時間どおりに動く Cloudflare の定期実行から頼む。

| 時間（日本時間） | 動かすもの |
|---|---|
| 毎時 55 分 | threads-queue（ショートの予約。7:00・19:00 の回は 6:55・18:55 に出る） |
| 19:55 | jobgame-threads（7千万分の1） |

GitHub 側の予定実行も残してある。どちらが先に動いても二重には出ない。

## 最初に1回だけ
1. GitHub で Fine-grained token を作る：対象リポジトリは oyajibuki.github.io だけ、権限は「Actions: Read and write」だけ
2. Worker に登録する（聞かれたらトークンを貼る）
   ```
   cd tools/threads-cron && npx wrangler secret put GH_TOKEN
   ```

## 変えるとき
- 時間を変える：`wrangler.toml` の `crons` と `src/index.js` の `JOBS` を同じにして `npx wrangler deploy`
- 動いたかを見る：Cloudflare のダッシュボード → Workers → threads-cron → ログ、または GitHub の Actions で「workflow_dispatch」の実行
