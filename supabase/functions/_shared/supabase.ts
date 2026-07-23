// 共通: サービスロールの Supabase クライアント（RLSをバイパスしてサーバー処理を行う）
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const FEE_RATE = 0.20; // 一律20%（仕様書 8.2）
