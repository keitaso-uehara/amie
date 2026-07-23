// sns-sync — 定期実行(cron・週次)。連携SNSのフォロワー数を更新する（仕様書 5.2(1) 週次同期）。
// 各プラットフォームの Graph/API を叩いて follower_count を更新。ここでは骨格のみ。
// pg_cron 例: select cron.schedule('sns-sync','0 3 * * 1', ...); // 毎週月曜3時
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(async () => {
  const db = adminClient();
  const { data: accounts } = await db.from("sns_accounts").select("*");
  let updated = 0;
  for (const a of accounts ?? []) {
    const count = await fetchFollowerCount(a.provider, a.handle);
    if (count != null) {
      await db.from("sns_accounts")
        .update({ follower_count: count, synced_at: new Date().toISOString() })
        .eq("id", a.id);
      updated++;
    }
  }
  return new Response(JSON.stringify({ updated }), { headers: { "Content-Type": "application/json" } });
});

// 各SNSのAPI呼び出し（実装差し込み）。Instagram Graph API / TikTok Display API / YouTube Data API など。
async function fetchFollowerCount(provider: string, handle: string): Promise<number | null> {
  switch (provider) {
    case "instagram": /* Instagram Graph API: /{ig-user-id}?fields=followers_count */ return null;
    case "tiktok":    /* TikTok Display API: /user/info/ */ return null;
    case "youtube":   /* YouTube Data API: channels?part=statistics */ return null;
    case "x":         /* X API v2: /users/by/username/{handle}?user.fields=public_metrics */ return null;
    default: return null;
  }
}
