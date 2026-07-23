/* =========================================================
   config.js — バックエンド切替
   backend: "mock"     … store.js（localStorage・既定・オフライン可）
            "supabase" … store.supabase.js（実バックエンド）
   Supabase を使う場合は URL / anon key を設定し、各HTMLで
   store.js の代わりに store.supabase.js を読み込む。
   ========================================================= */
window.AMIE_CONFIG = {
  // "mock"=localStorage / "supabase"=Supabase(下記)
  backend: "supabase",

  // 本番 Supabase（info@blue-co.jp's Project・東京リージョン）
  // anonキーは公開キー（RLSで保護）。service_roleキーはここに置かないこと。
  supabaseUrl: "https://qfsfsxlpqmqcdobdqnvu.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmc2ZzeGxwcW1xY2RvYmRxbnZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MDkzNTUsImV4cCI6MjEwMDM4NTM1NX0.EuX9ugiVvRZKKTp4KJSDtyIDd0B0azzPnPEicnPA9S8",
  functionsBase: "https://qfsfsxlpqmqcdobdqnvu.supabase.co/functions/v1"

  // ローカルに戻す場合: url=http://127.0.0.1:54321, anon=`supabase start`の出力値
};
