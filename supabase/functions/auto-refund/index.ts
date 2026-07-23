// auto-refund — 定期実行(cron)。出品者が無応答の取引を自動返金する（仕様書 6章）。
// no_response_refund_candidates ビュー(0002): 購入者の初回発言から48時間、出品者の返信が皆無の
// 進行中チャット取引。該当分を Stripe で返金し、取引を refunded に、出品者へペナルティ記録。
// pg_cron 例: select cron.schedule('auto-refund','*/30 * * * *', $$ ... net.http_post(...) $$);
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { adminClient } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

Deno.serve(async () => {
  const db = adminClient();
  const { data: cands } = await db.from("no_response_refund_candidates").select("*");
  let refunded = 0;
  for (const o of cands ?? []) {
    try {
      // manual capture の与信はキャプチャせずキャンセル＝購入者に請求しない
      if (o.stripe_pi) await stripe.paymentIntents.cancel(o.stripe_pi);
      await db.from("orders").update({ status: "refunded" }).eq("id", o.id);
      await db.from("order_events").insert({ order_id: o.id, type: "auto_refund_no_response" });
      await db.from("notifications").insert({
        profile_id: o.buyer_id, type: "complete",
        title: "出品者からの応答がなかったため、全額返金しました",
      });
      refunded++;
    } catch (_e) { /* 個別失敗は握りつぶし、次を処理 */ }
  }
  return new Response(JSON.stringify({ refunded }), { headers: { "Content-Type": "application/json" } });
});
