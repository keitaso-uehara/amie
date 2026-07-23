/* モック出品者(教える側)。仕様書 3.1 の4類型を網羅。
   type: celebrity(芸能人) / influencer(インフルエンサー) / pro(各分野のプロ) / general(一般)
   verified: eKYC済(認証バッジ)。sns: 連携済SNSのフォロワー数(週次自動更新の想定値)。
   将来は Supabase の creators + sns_accounts に対応。 */
window.DB = window.DB || {};
window.DB.creators = [
  {
    id: "c001", name: "MOEKA", handle: "moeka_beauty",
    type: "influencer", typeLabel: "インフルエンサー", verified: true,
    tagline: "垢抜けメイクの伝道師",
    bio: "元美容部員のメイクインフルエンサー。「地味顔さんの垢抜け」をテーマに毎日発信しています。あなたの顔立ちに本当に似合うを一緒に見つけましょう。",
    categories: ["makeup", "skincare"], concerns: ["akanuke", "buruberu"],
    sns: { instagram: 128000, tiktok: 342000, youtube: 56000 },
    stats: { sales: 214, rating: 4.9, repeat: 68 },
    planIds: ["p001", "p002", "p003"]
  },
  {
    id: "c002", name: "有村 さゆり", handle: "sayuri_official",
    type: "celebrity", typeLabel: "タレント・モデル", verified: true,
    tagline: "雑誌専属モデル / 女優",
    bio: "ファッション誌の専属モデルをしています。撮影現場で培った「写真映え」と「日常に落とし込むコーデ」の両立を、あなたのクローゼットからご提案します。",
    categories: ["fashion", "personalcolor"], concerns: ["date", "office"],
    sns: { instagram: 892000, tiktok: 210000, youtube: 0 },
    stats: { sales: 96, rating: 5.0, repeat: 54 },
    planIds: ["p004", "p005"]
  },
  {
    id: "c003", name: "kaori", handle: "kaori_color",
    type: "pro", typeLabel: "パーソナルカラーアナリスト", verified: true,
    tagline: "骨格 × パーソナルカラー診断歴8年",
    bio: "サロンで年間500名以上を診断してきたアナリストです。オンラインでも対面と変わらない精度でお似合いをお伝えします。手持ち服の活かし方までしっかりと。",
    categories: ["personalcolor", "fashion"], concerns: ["buruberu", "kokkaku"],
    sns: { instagram: 34000, tiktok: 0, youtube: 12000 },
    stats: { sales: 340, rating: 4.8, repeat: 41 },
    planIds: ["p006", "p007"]
  },
  {
    id: "c004", name: "RINA", handle: "rina_nail",
    type: "influencer", typeLabel: "ネイリスト・インフルエンサー", verified: true,
    tagline: "セルフネイルで垢抜ける",
    bio: "サロン級のセルフネイルを教えています。不器用さんこそ変われる。あなたの指先の悩み、チャットで気軽に相談してください。",
    categories: ["nail"], concerns: ["akanuke"],
    sns: { instagram: 76000, tiktok: 145000, youtube: 0 },
    stats: { sales: 158, rating: 4.9, repeat: 60 },
    planIds: ["p008"]
  },
  {
    id: "c005", name: "はるな", handle: "haruna_hair",
    type: "pro", typeLabel: "現役ヘアメイク", verified: true,
    tagline: "不器用さんの朝ヘアを3分に",
    bio: "広告・PVの現場で活動するヘアメイクです。おうちでできる再現性重視のヘアアレンジを、あなたの髪質・顔型に合わせてレッスンします。",
    categories: ["hair", "makeup"], concerns: ["akanuke", "office"],
    sns: { instagram: 45000, tiktok: 88000, youtube: 8000 },
    stats: { sales: 122, rating: 4.7, repeat: 38 },
    planIds: ["p009"]
  },
  {
    id: "c006", name: "mari", handle: "mari_kurashi",
    type: "influencer", typeLabel: "暮らし系インフルエンサー", verified: true,
    tagline: "小さな部屋を心地よく",
    bio: "1LDKの賃貸暮らしを発信しています。お金をかけずに垢抜ける部屋づくり、収納の仕組み化を、あなたの間取り写真を見ながら一緒に考えます。",
    categories: ["interior", "cooking"], concerns: ["hitorigurashi"],
    sns: { instagram: 168000, tiktok: 52000, youtube: 94000 },
    stats: { sales: 187, rating: 4.9, repeat: 72 },
    planIds: ["p010", "p011"]
  },
  {
    id: "c007", name: "あき", handle: "aki_recipe",
    type: "pro", typeLabel: "料理家・栄養士", verified: true,
    tagline: "作りおきと時短の栄養設計",
    bio: "共働き家庭のための時短ごはんを提案する料理家です。あなたの1週間の献立、栄養バランスから一緒に組み立てます。",
    categories: ["cooking"], concerns: ["mama"],
    sns: { instagram: 58000, tiktok: 0, youtube: 31000 },
    stats: { sales: 143, rating: 4.8, repeat: 55 },
    planIds: ["p012"]
  },
  {
    id: "c008", name: "ゆず", handle: "yuzu_diet",
    type: "general", typeLabel: "ダイエット記録発信中", verified: false,
    tagline: "-12kgのリアル記録",
    bio: "無理な食事制限なしで1年かけて12kg落としました。同じように頑張りたい人に、私が続けられた習慣づくりを伴走します。※資格保有者ではありません。",
    categories: ["diet"], concerns: ["akanuke"],
    sns: { instagram: 9200, tiktok: 21000, youtube: 0 },
    stats: { sales: 47, rating: 4.6, repeat: 44 },
    planIds: ["p013"]
  },
  {
    id: "c009", name: "SAKI", handle: "saki_lovecoach",
    type: "influencer", typeLabel: "恋愛・婚活コーチ", verified: true,
    tagline: "自分を好きになる恋愛のはなし",
    bio: "婚活・恋愛の発信をしています。うまくいかないのはあなたのせいじゃない。プロフィールの言葉選びからデートの振る舞いまで、二人三脚で。",
    categories: ["love"], concerns: ["date"],
    sns: { instagram: 214000, tiktok: 118000, youtube: 0 },
    stats: { sales: 201, rating: 4.9, repeat: 63 },
    planIds: ["p014", "p015"]
  },
  {
    id: "c010", name: "eri", handle: "eri_career",
    type: "pro", typeLabel: "キャリアコンサルタント", verified: true,
    tagline: "私らしい働き方の見つけ方",
    bio: "国家資格キャリアコンサルタント。転職・復職・独立の分かれ道で迷う女性の、次の一歩の言語化をお手伝いします。",
    categories: ["career"], concerns: ["office"],
    sns: { instagram: 27000, tiktok: 0, youtube: 15000 },
    stats: { sales: 88, rating: 4.9, repeat: 49 },
    planIds: ["p016"]
  }
];
