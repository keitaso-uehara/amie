/* モック購入者。u001 がログイン時の「自分」。
   購入者は表示名・悩みタグ・簡単な自己紹介を持つ(仕様書 S15)。
   ※ u001 はプロフィール(アイコン/自己紹介/悩みタグ)をマイページ編集(localStorage)で上書きできる。 */
window.DB = window.DB || {};
window.DB.users = [
  { id: "u001", name: "みな", isMe: true, since: "2026年7月",
    bio: "垢抜けたい社会人2年目。よろしくお願いします！",
    concerns: ["akanuke", "buruberu"] },
  { id: "u002", name: "さき", isMe: false, since: "2026年6月", bio: "骨格診断してもらいたい", concerns: ["kokkaku"] },
  { id: "u003", name: "あや", isMe: false, since: "2026年5月", bio: "オフィスコーデ迷子", concerns: ["office"] },
  { id: "u004", name: "りこ", isMe: false, since: "2026年6月", bio: "一人暮らしの部屋を整えたい", concerns: ["hitorigurashi"] },
  { id: "u005", name: "ゆき", isMe: false, since: "2026年4月", bio: "デートメイク研究中", concerns: ["date", "akanuke"] },
  { id: "u006", name: "なほ", isMe: false, since: "2026年7月", bio: "産後のおしゃれを取り戻したいママです", concerns: ["mama"] }
];
