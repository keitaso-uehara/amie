// complete-order — 取引完了(別紙0.2)。エスクローをキャプチャし、
// Stripe Connect で出品者へ受取額(price - 20%手数料)を送金。売上確定。
// 呼び出し: 購入者の完了操作 / ビデオ実施後72時間の自動確定 / チャット期間満了。
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { adminClient, cors, FEE_RATE } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { orderId } = await req.json();
    const db = adminClient();

    const { data: order } = await db.from("orders")
      .select("*, creators(stripe_account)").eq("id", orderId).single();
    if (!order) return json({ error: "order not found" }, 404);
    if (order.status !== "progress") return json({ error: "not in progress" }, 409);

    // エスクロー与信をキャプチャ（実売上化）
    if (order.stripe_pi) await stripe.paymentIntents.capture(order.stripe_pi);

    // 出品者の Connect アカウントへ受取額を送金（手数料20%控除）
    const net = order.price - Math.round(order.price * FEE_RATE);
    const acct = order.creators?.stripe_account;
    if (acct) {
      await stripe.transfers.create({ amount: net, currency: "jpy", destination: acct, metadata: { orderId } });
    }

    await db.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", orderId);
    await db.from("order_events").insert({ order_id: orderId, type: "completed" });
    // 購入者へレビュー依頼通知(S9)
    await db.from("notifications").insert({
      profile_id: order.buyer_id, type: "review", title: "受けたレッスンのレビューを投稿できます",
    });

    return json({ ok: true, net });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
