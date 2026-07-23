// stripe-webhook — Stripe からのイベントを受けて注文状態を更新する。
// payment_intent.amount_capturable_updated: 与信確定 → 取引を progress へ（S5→S6）。
// invoice.paid: 月額の自動更新 → 当月分の売上計上（4.3）。
// charge.refunded: 返金 → 取引を refunded へ。
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { adminClient } from "../_shared/supabase.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const WH_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature")!;
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, WH_SECRET);
  } catch (e) {
    return new Response(`invalid signature: ${e}`, { status: 400 });
  }

  const db = adminClient();
  switch (event.type) {
    case "payment_intent.amount_capturable_updated": {
      const pi = event.data.object as Stripe.PaymentIntent;
      // 与信が確定 → 取引開始。単発は progress、月額は create-order 時点で active。
      await db.from("orders").update({ status: "progress", started_at: new Date().toISOString() })
        .eq("stripe_pi", pi.id).eq("status", "pending");
      break;
    }
    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      // 月額の更新決済 → order_events に計上（当月分の売上）
      const orderId = inv.metadata?.orderId;
      if (orderId) await db.from("order_events").insert({ order_id: orderId, type: "monthly_renewed" });
      break;
    }
    case "charge.refunded": {
      const ch = event.data.object as Stripe.Charge;
      await db.from("orders").update({ status: "refunded" }).eq("stripe_pi", ch.payment_intent as string);
      break;
    }
  }
  return new Response("ok", { status: 200 });
});
