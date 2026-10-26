/**
 * Threads の自動投稿を、決まった時間に GitHub Actions で動かす Cloudflare Worker。
 *
 * GitHub の予定実行（cron）は混んでいると遅れたり飛ばされたりする（2026-10-26 は 19:00・20:00 の投稿が出なかった）。
 * 頼まれた実行（workflow_dispatch）はすぐ動くので、時間どおりに動く Cloudflare の定期実行から頼む。
 * GitHub 側の予定実行も残してあり、どちらが先に動いても二重には出ない（投稿済みの予約は消える・ゲーム結果は今日出したか見る）。
 *
 * 定期実行（wrangler.toml の crons。時刻は UTC）:
 *   毎時 55 分 … threads-queue（ショートの予約。予約の15分前から出すので、7:00・19:00 の回が 6:55・18:55 に出る）
 *   10:55 UTC = 19:55 JST … jobgame-threads（7千万分の1 の今日の仕事人生）
 *
 * Secret: GH_TOKEN … GitHub の Fine-grained token（oyajibuki.github.io だけ・Actions の読み書きだけ）
 */
const REPO = 'oyajibuki/oyajibuki.github.io';
const JOBS = {
  '55 * * * *': ['threads-queue.yml'],
  '55 10 * * *': ['jobgame-threads.yml'],
};

async function dispatch(env, workflow) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'threads-cron',
    },
    // dry_run を false にしないと、投稿せずに試すだけになる
    body: JSON.stringify({ ref: 'main', inputs: { dry_run: 'false' } }),
  });
  if (res.status !== 204) throw new Error(`${workflow}: ${res.status} ${await res.text()}`);
  console.log(`dispatched ${workflow}`);
}

export default {
  async scheduled(event, env) {
    const workflows = JOBS[event.cron] || [];
    if (!workflows.length) console.log(`no job for cron "${event.cron}"`);
    for (const w of workflows) await dispatch(env, w);
  },
  // ブラウザで開いたときは何もしない（ここから実行はできない）
  async fetch() {
    return new Response('threads-cron: 定期実行だけで動きます\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
