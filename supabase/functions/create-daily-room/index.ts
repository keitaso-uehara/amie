// create-daily-room — ビデオ取引の予約時刻に Daily.co ルームを作成する（S7）。
// 録画は無効(仕様書 6章)。ルームは予約時刻の前後のみ有効。
import { adminClient, cors } from "../_shared/supabase.ts";

const DAILY_KEY = Deno.env.get("DAILY_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { orderId } = await req.json();
    const db = adminClient();
    const { data: order } = await db.from("orders").select("*, plans(minutes)").eq("id", orderId).single();
    if (!order || order.format !== "video") return json({ error: "video order not found" }, 404);

    const start = order.slot ? Math.floor(new Date(order.slot).getTime() / 1000) : undefined;
    const minutes = order.plans?.minutes ?? 60;

    const res = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: { Authorization: `Bearer ${DAILY_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        privacy: "private",
        properties: {
          enable_recording: false,          // 録画しない(6章)
          nbf: start ? start - 300 : undefined,          // 5分前から入室可
          exp: start ? start + (minutes + 10) * 60 : undefined, // 満了10分後に失効
          max_participants: 2,              // 1対1
        },
      }),
    });
    const room = await res.json();
    await db.from("orders").update({ daily_room: room.url }).eq("id", orderId);
    return json({ url: room.url });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
