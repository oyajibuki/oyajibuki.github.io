# ショート動画の Threads 予約投稿（断酒クエスト・ジオアラーム）

できあがったショート動画を Mac から予約に積むと、GitHub Actions が時間になったら Threads（@oyajibuki）に動画で投稿する。
Mac は予約するときだけ使う（投稿の時間に開いていなくてよい）。

```
Mac:     add.mjs … 動画と本文を threads-queue ブランチの queue/<ID>/ に積む
Actions: .github/workflows/threads-queue.yml（30分おき）
         run.mjs … 時間が来た予約を Threads に投稿 → queue から消して done.json に記録
         → ブランチを1コミットに作り直す（動画が履歴にたまらない）→ アクセストークンを延長
```

## 予約する
```
node tools/threads-queue/add.mjs "<動画.mp4>"            # 中身を見るだけ
node tools/threads-queue/add.mjs "<動画.mp4>" --yes      # 次の枠に予約
node tools/threads-queue/add.mjs "<動画.mp4>" --at "2026-10-27 19:00" --yes
node tools/threads-queue/add.mjs "<EP01.mp4>" "<EP02.mp4>" … --at "2026-10-26 19:00" --yes   # まとめて（2本目からは次の枠に続く）
node tools/threads-queue/add.mjs --list                  # 予約の一覧
node tools/threads-queue/add.mjs --remove <ID>           # 取り消し
```

- **次の枠**：断酒クエストは毎日 19:00、ジオアラームは月・水・金の 7:00（日本時間）。すでに予約してある回の次に入る。設定は `apps.mjs` の `slot`
- **本文**：動画と同じフォルダの `*_投稿文.md` の「Instagram リール」のキャプションを直したもの
  - ハッシュタグの行を消して、トピックタグを1つだけ付ける（断酒クエスト `#断酒`、ジオアラーム `#寝過ごし`）
  - 「プロフィールのリンクから」を、本文の App Store リンク（Threads 用の計測リンク `ct=threads` / `ct=threads_geo`）に置き換える
  - 別の本文にしたいときは `--text 本文.txt`（500文字まで）
- 予約の15分前から投稿してよいことにしている（Actions は30分おきで、遅れることがあるため）。12時間以上過ぎた予約は出さずに `done.json` に `missed` で残す

## 試す
Actions → threads-queue → Run workflow
- `dry_run`（初期値オン）：Threads が動画を取り込めるかまで試して、公開はしない
- `only` に予約IDを入れると、時間に関係なくその予約だけを扱う

## メモ
- 動画は GitHub に置く都合で 95MB まで（ショートは 10〜15MB くらい）
- Threads の動画の条件：MP4（H.264・AAC）、5分まで、1GB まで
- アクセストークンは `jobgame-threads` と共通（`THREADS_TOKEN`・`SECRETS_PAT`）
