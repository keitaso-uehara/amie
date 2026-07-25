/* 特集・ピックアップ（TOP掲載。運営CMS(A4)で編集する想定）。
   q は search のクエリ（cat= / concern= / q=）。tone は配色。 */
window.DB = window.DB || {};
window.DB.features = [
  { title: "垢抜けたい夏", sub: "はじめの一歩を、憧れの人と", q: "concern=akanuke", tone: "rose" },
  { title: "自分に似合う色", sub: "イエベ・ブルベから見つける", q: "concern=buruberu", tone: "gold" },
  { title: "新生活を整える", sub: "収納・インテリアのプロに相談", q: "cat=interior", tone: "life" },
  { title: "デート前の総仕上げ", sub: "メイク・コーデをまとめて", q: "concern=date", tone: "rose" }
];

/* NEWS/お知らせ（TOP掲載。運営CMSで編集する想定） */
window.DB.news = [
  { date: "2026.07.20", title: "特集「垢抜けたい夏」を公開しました" },
  { date: "2026.07.12", title: "パーソナルカラー・骨格診断カテゴリを追加しました" },
  { date: "2026.07.01", title: "ELLMIE 事前登録を開始しました" }
];
