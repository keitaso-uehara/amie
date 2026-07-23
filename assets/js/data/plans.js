/* モックプラン(出品単位)。仕様書 第4章の3形式。
   format: chat(チャット単発) / video(単発ビデオ) / monthly(月額メンター)
   形式別フィールド: chatDays / minutes / monthlyVideos+chatIncluded
   price は税込表示のベース(最低1,000円〜上限なし。仕様書 4.5)。
   将来は Supabase の plans に対応。 */
window.DB = window.DB || {};
window.DB.plans = [
  /* c001 MOEKA */
  { id: "p001", creatorId: "c001", title: "あなた専用・垢抜けメイクレッスン", format: "video",
    price: 8000, minutes: 60, category: "makeup", concerns: ["akanuke", "buruberu"],
    desc: "お顔を見ながら、今の垢抜けポイントを一緒に探すマンツーマンレッスン。眉・アイメイク・ベースの3点を、あなたの手持ちコスメで再現できるところまで落とし込みます。",
    stats: { rating: 4.9, sales: 132 } },
  { id: "p002", creatorId: "c001", title: "メイク写真を送るだけ添削（3日相談し放題）", format: "chat",
    price: 3000, chatDays: 3, category: "makeup", concerns: ["akanuke"],
    desc: "すっぴん・メイク後の写真を送ってもらえれば、直すべき順に具体的にお返事します。3日間チャットし放題なので、やり直した結果もまた見せてくださいね。",
    stats: { rating: 4.8, sales: 210 } },
  { id: "p003", creatorId: "c001", title: "垢抜け3ヶ月伴走プラン（月額）", format: "monthly",
    price: 12000, monthlyVideos: 2, chatIncluded: true, category: "makeup", concerns: ["akanuke"],
    desc: "毎日のメイクをチャットで添削し放題＋月2回の60分ビデオレッスン。3ヶ月で「盛れる自分の型」を作りきる本気プランです。",
    stats: { rating: 5.0, sales: 41 } },

  /* c002 有村さゆり（芸能人・高単価） */
  { id: "p004", creatorId: "c002", title: "モデルが選ぶ・パーソナルスタイリング60分", format: "video",
    price: 30000, minutes: 60, category: "fashion", concerns: ["date", "office"],
    desc: "あなたのクローゼットをカメラ越しに拝見し、写真映えと日常使いを両立するコーデを組みます。買い足すべき1着のアドバイス付き。",
    stats: { rating: 5.0, sales: 62 } },
  { id: "p005", creatorId: "c002", title: "コーデ写真を送って相談（7日）", format: "chat",
    price: 6000, chatDays: 7, category: "fashion", concerns: ["office"],
    desc: "その日の予定を教えてもらえれば、手持ち服でのコーデをご提案。7日間、何度でも相談OKです。",
    stats: { rating: 4.9, sales: 88 } },

  /* c003 kaori プロ診断 */
  { id: "p006", creatorId: "c003", title: "パーソナルカラー＋骨格診断（90分・徹底）", format: "video",
    price: 15000, minutes: 90, category: "personalcolor", concerns: ["buruberu", "kokkaku"],
    desc: "自然光の下で撮った写真とビデオ通話で、パーソナルカラー4分類・骨格3タイプを診断。似合う色・素材・シルエットを、買い物で使えるメモにしてお渡しします。",
    stats: { rating: 4.9, sales: 176 } },
  { id: "p007", creatorId: "c003", title: "手持ち服・お買い物同行の月額サポート", format: "monthly",
    price: 9800, monthlyVideos: 1, chatIncluded: true, category: "fashion", concerns: ["kokkaku"],
    desc: "診断後の「で、何を買えばいい？」に答える月額プラン。オンライン試着チェックをチャットで、月1回はビデオでじっくり。",
    stats: { rating: 4.8, sales: 34 } },

  /* c004 RINA ネイル */
  { id: "p008", creatorId: "c004", title: "セルフネイルお悩み相談（3日）", format: "chat",
    price: 1500, chatDays: 3, category: "nail", concerns: ["akanuke"],
    desc: "ムラになる・すぐ剥がれる・色選びが分からない。写真を送ってもらえれば原因と直し方をお返事します。まずはお試しに。",
    stats: { rating: 4.9, sales: 240 } },

  /* c005 はるな ヘア */
  { id: "p009", creatorId: "c005", title: "朝3分ヘアアレンジ・マンツーマン30分", format: "video",
    price: 5000, minutes: 30, category: "hair", concerns: ["akanuke", "office"],
    desc: "あなたの髪の長さ・クセ・顔型に合わせて、忙しい朝でも決まるアレンジを一緒に練習します。使うアイテムも最小限で。",
    stats: { rating: 4.7, sales: 96 } },

  /* c006 mari 暮らし */
  { id: "p010", creatorId: "c006", title: "お部屋づくり相談（7日チャット）", format: "chat",
    price: 2500, chatDays: 7, category: "interior", concerns: ["hitorigurashi"],
    desc: "間取りとお部屋の写真を送ってください。今あるもので垢抜ける配置換え、買い足すなら何か、7日間じっくり相談できます。",
    stats: { rating: 4.9, sales: 130 } },
  { id: "p011", creatorId: "c006", title: "暮らしを整える月額サポート", format: "monthly",
    price: 4000, monthlyVideos: 1, chatIncluded: true, category: "interior", concerns: ["hitorigurashi"],
    desc: "収納の仕組み化・家事の習慣づくりを月単位で伴走。チャットで日々の相談、月1回のビデオで模様替え会議を。",
    stats: { rating: 4.9, sales: 57 } },

  /* c007 あき 料理 */
  { id: "p012", creatorId: "c007", title: "1週間の献立づくり相談（5日）", format: "chat",
    price: 2000, chatDays: 5, category: "cooking", concerns: ["mama"],
    desc: "家族構成と苦手食材、冷蔵庫の中身を教えてください。栄養バランスを見た1週間の献立と作りおき案をご提案します。",
    stats: { rating: 4.8, sales: 143 } },

  /* c008 ゆず ダイエット（一般） */
  { id: "p013", creatorId: "c008", title: "ダイエット習慣化の伴走（月額）", format: "monthly",
    price: 3000, monthlyVideos: 0, chatIncluded: true, category: "diet", concerns: ["akanuke"],
    desc: "毎日の食事・体重をチャットで報告し合いながら、続けられる習慣を一緒に作ります。※医療・栄養指導ではなく、経験に基づく伴走です。",
    stats: { rating: 4.6, sales: 47 } },

  /* c009 SAKI 恋愛 */
  { id: "p014", creatorId: "c009", title: "マッチングアプリ プロフィール添削（3日）", format: "chat",
    price: 2500, chatDays: 3, category: "love", concerns: ["date"],
    desc: "写真と自己紹介文を送ってください。「いいね」が増える見せ方に、言葉選びから一緒に整えます。",
    stats: { rating: 4.9, sales: 168 } },
  { id: "p015", creatorId: "c009", title: "恋愛のもやもや相談・60分ビデオ", format: "video",
    price: 7000, minutes: 60, category: "love", concerns: ["date"],
    desc: "今の関係の悩み、これからのこと。否定せずに聴きます。あなたが自分で答えを見つけられるよう並走する60分です。",
    stats: { rating: 4.9, sales: 74 } },

  /* c010 eri キャリア */
  { id: "p016", creatorId: "c010", title: "キャリアの棚卸し・60分ビデオ", format: "video",
    price: 9000, minutes: 60, category: "career", concerns: ["office"],
    desc: "転職・復職・独立で迷っているあなたと、これまでの経験を一緒に言語化。次の一歩を決めるための60分です。",
    stats: { rating: 4.9, sales: 88 } }
];
