/* カテゴリ・悩みタグの共通マスタ。home(ピッカー)と search(絞り込み)で共有。
   categories: slug は search?cat= に対応。group でカテゴリ分け。
   concerns:  slug は search?concern= に対応(悩みタグ)。
   仕様書 第5.3 の検索カテゴリ/悩みタグに準拠。 */
window.TAX = {
  categories: [
    /* ビューティー */
    { slug: "makeup",       label: "メイク",             group: "ビューティー",   icon: "brush" },
    { slug: "skincare",     label: "スキンケア",          group: "ビューティー",   icon: "droplet" },
    { slug: "hair",         label: "ヘア",               group: "ビューティー",   icon: "scissors" },
    { slug: "nail",         label: "ネイル",             group: "ビューティー",   icon: "sparkles" },
    { slug: "eyelash",      label: "まつ毛・眉",          group: "ビューティー",   icon: "eye" },
    { slug: "cosme",        label: "コスメ・デパコス選び",   group: "ビューティー",   icon: "color-swatch" },
    { slug: "fragrance",    label: "香り・フレグランス",     group: "ビューティー",   icon: "perfume" },
    /* ファッション */
    { slug: "fashion",      label: "コーデ・着回し",        group: "ファッション",   icon: "hanger" },
    { slug: "personalcolor",label: "パーソナルカラー・骨格", group: "ファッション",   icon: "palette" },
    { slug: "bodystyle",    label: "体型カバー・スタイルアップ", group: "ファッション", icon: "ruler-2" },
    { slug: "goods",        label: "靴・バッグ・小物",       group: "ファッション",   icon: "shopping-bag" },
    { slug: "accessory",    label: "アクセサリー・ジュエリー", group: "ファッション",   icon: "diamond" },
    { slug: "petitprice",   label: "プチプラ・高見え",       group: "ファッション",   icon: "tag" },
    { slug: "brand",        label: "ブランド・古着",         group: "ファッション",   icon: "shirt" },
    { slug: "closet",       label: "クローゼット整理・断捨離", group: "ファッション",   icon: "archive" },
    /* ライフスタイル */
    { slug: "diet",         label: "ダイエット・ボディメイク", group: "ライフスタイル", icon: "run" },
    { slug: "cooking",      label: "料理・レシピ",         group: "ライフスタイル", icon: "tools-kitchen-2" },
    { slug: "interior",     label: "インテリア・収納",      group: "ライフスタイル", icon: "sofa" },
    { slug: "travel",       label: "旅行",               group: "ライフスタイル", icon: "plane" },
    { slug: "love",         label: "恋愛・婚活",          group: "ライフスタイル", icon: "heart" },
    { slug: "kids",         label: "子育て",             group: "ライフスタイル", icon: "baby-carriage" },
    { slug: "career",       label: "キャリア・働き方",      group: "ライフスタイル", icon: "briefcase" }
  ],
  concerns: [
    { slug: "akanuke",   label: "垢抜け" },
    { slug: "buruberu",  label: "イエベ・ブルベ" },
    { slug: "kokkaku",   label: "骨格" },
    { slug: "office",    label: "オフィス" },
    { slug: "date",      label: "デート" },
    { slug: "mama",      label: "ママ" },
    { slug: "hitorigurashi", label: "一人暮らし" }
  ]
};
