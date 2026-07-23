// create-order — 購入(S5)。Stripe PaymentIntent を manual capture(=エスクロー与信)で作成し、
// orders を pending で作る。実際の売上確定(capture)は取引完了時(complete-order)。
// 手数料20%・価格ルール・18歳未満制限はDBトリガ側で最終担保(0002)。
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { adminClient, cors } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { planId, buyerId, slot, promoCode } = await req.json();
    const db = adminClient();

    const { data: plan } = await db.from("plans").select("*, creators(*)").eq("id", planId).single();
    if (!plan) return json({ error: "plan not found" }, 404);

    // 宣伝リンク(SNS流入計測・5.2(2))
    let promoId: string | null = null;
    if (promoCode) {
      const { data: pl } = await db.from("promo_links").select("id").eq("code", promoCode).single();
      if (pl) { promoId = pl.id; await db.rpc("increment_promo_conversion", { p_id: pl.id }); }
    }

    // 月額はサブスク、単発は都度課金。ここでは PaymentIntent(manual capture)でエスクロー与信。
    const pi = await stripe.paymentIntents.create({
      amount: plan.price,
      currency: "jpy",
      capture_method: "manual", // 取引完了までキャプチャしない = 前払いエスクロー(4.4)
      metadata: { planId, buyerId },
      // 5万円超は3Dセキュア必須(6章)
      payment_method_options: plan.price > 50000 ? { card: { request_three_d_secure: "any" } } : undefined,
    });

    const { data: order, error } = await db.from("orders").insert({
      plan_id: planId, buyer_id: buyerId, creator_id: plan.creator_id,
      format: plan.format, price: plan.price,
      status: plan.format === "monthly" ? "active" : "pending",
      slot: slot ?? null, stripe_pi: pi.id, promo_id: promoId,
    }).select().single();
    if (error) return json({ error: error.message }, 400); // 価格・年齢トリガの例外もここに来る

    return json({ order, clientSecret: pi.client_secret });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
