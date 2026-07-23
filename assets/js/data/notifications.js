/* モック通知(仕様書 S14)。actorId は出品者/購入者ID。
   type: message / booking / complete / review / news
   将来は Supabase の notifications に対応。 */
window.DB = window.DB || {};
window.DB.notifications = [
  { id: "n001", type: "message", actorId: "c001", title: "MOEKAさんからメッセージが届きました", date: "10分前", read: false },
  { id: "n002", type: "booking", actorId: "c003", title: "kaoriさんとのビデオ予約が確定しました（7/25 20:00）", date: "1時間前", read: false },
  { id: "n003", type: "review", actorId: null, title: "受けたレッスンのレビューを投稿できます", date: "3時間前", read: false },
  { id: "n004", type: "complete", actorId: "c008", title: "「ダイエット習慣化の伴走」の取引が完了しました", date: "昨日", read: true },
  { id: "n005", type: "news", actorId: null, title: "【お知らせ】特集「垢抜けたい夏」を公開しました", date: "2日前", read: true }
];
