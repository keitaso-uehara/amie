/* =========================================================
   config.js — バックエンド切替
   backend: "mock"     … store.js（localStorage・既定・オフライン可）
            "supabase" … store.supabase.js（実バックエンド）
   Supabase を使う場合は URL / anon key を設定し、各HTMLで
   store.js の代わりに store.supabase.js を読み込む。
   ========================================================= */
window.AMIE_CONFIG = {
  backend: "mock",
  supabaseUrl: "https://xxxxxxxxxxxx.supabase.co",
  supabaseAnonKey: "eyJhbGciOi...",   // 公開anonキー（RLSで保護）
  functionsBase: "https://xxxxxxxxxxxx.supabase.co/functions/v1"
};
