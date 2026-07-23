/* =========================================================
   config.js — バックエンド切替
   backend: "mock"     … store.js（localStorage・既定・オフライン可）
            "supabase" … store.supabase.js（実バックエンド）
   Supabase を使う場合は URL / anon key を設定し、各HTMLで
   store.js の代わりに store.supabase.js を読み込む。
   ========================================================= */
window.AMIE_CONFIG = {
  // "mock"=localStorage / "supabase"=ローカルSupabase(下記)
  backend: "supabase",

  // ローカル Supabase（`supabase start` の出力値。anonキーはローカル専用の公開既定値）
  supabaseUrl: "http://127.0.0.1:54321",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  functionsBase: "http://127.0.0.1:54321/functions/v1"

  // 本番はここを本番プロジェクトのURL/anonキーに差し替える。Studio: http://127.0.0.1:54323
};
