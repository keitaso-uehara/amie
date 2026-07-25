/* S1 TOP（箱型マーケットプレイス型）
   並び: 検索バー → カテゴリ(グループ別カラーの2段グリッド) → 注目の出品者
        → お悩みから探す → 人気のプラン → 出品者募集 → フッター
   （ココナラ/メルカリ型の"見慣れた箱型"。詳細は beauty-mentor-spec/画面構成メモ_プレローンチ.md）
   クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  var GROUP_CLASS = { "ビューティー": "beauty", "ファッション": "fashion", "ライフスタイル": "life" };

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    Promise.all([
      api.getFeaturedCreators(8),
      api.getNewPlans(6)
    ]).then(function (res) {
      var creators = res[0], plans = res[1];
      main.innerHTML =
        searchBar() +
        categoryGrid() +
        featuredShelf(creators) +
        concernShelf() +
        plansShelf(plans) +
        recruitSection() +
        UI.siteFooter();
      bindSearch();
    });
  });

  /* ① 検索バー（目的が明確な人の主導線） */
  function searchBar() {
    return (
      '<div class="home-search-wrap">' +
      '<form id="home-search" class="home-search">' + UI.icon("search") +
      '<input name="q" type="search" placeholder="やりたいこと・お名前で探す" autocomplete="off">' +
      "</form></div>"
    );
  }

  /* ② カテゴリ（グループ別カラーの2段グリッド・横スクロール。ブラウズ派の主導線） */
  function categoryGrid() {
    var tiles = TAX.categories.map(function (c) {
      var g = GROUP_CLASS[c.group] || "life";
      return '<a class="cat-tile cat-tile--' + g + '" href="' + h("search/index.html?cat=" + c.slug) + '">' +
        '<span class="cat-tile__ic">' + UI.icon(c.icon) + "</span>" +
        '<span class="cat-tile__l">' + esc(c.label) + "</span></a>";
    }).join("");
    var all = '<a class="cat-tile cat-tile--all" href="' + h("search/index.html") + '">' +
      '<span class="cat-tile__ic">' + UI.icon("dots") + "</span>" +
      '<span class="cat-tile__l">すべて</span></a>';
    return '<div class="cat-grid2">' + tiles + all + "</div>";
  }

  /* ③ 注目の出品者の棚 */
  function featuredShelf(creators) {
    return (
      '<div class="section">' +
      '<p class="section__title">注目の出品者' +
      '<a class="more" href="' + h("search/index.html?tab=creators") + '">もっと見る ' + UI.icon("chevron-right") + "</a></p>" +
      '<div class="creator-scroll">' + creators.map(UI.creatorMini).join("") + "</div></div>"
    );
  }

  /* ④ お悩みから探す（相談サービスならではの入口。悩みタグで絞り込み） */
  function concernShelf() {
    var chips = TAX.concerns.map(function (c) {
      return '<a class="concern-chip" href="' + h("search/index.html?concern=" + c.slug) + '">#' + esc(c.label) + "</a>";
    }).join("");
    return (
      '<div class="section">' +
      '<p class="section__title">お悩みから探す</p>' +
      '<div class="concern-row">' + chips + "</div></div>"
    );
  }

  /* ⑤ 人気のプランの棚 */
  function plansShelf(plans) {
    return (
      '<div class="section">' +
      '<p class="section__title">人気のプラン' +
      '<a class="more" href="' + h("search/index.html") + '">もっと見る ' + UI.icon("chevron-right") + "</a></p>" +
      '<div class="plan-grid">' + plans.map(UI.planCard).join("") + "</div></div>"
    );
  }

  /* ⑥ 出品者募集（購入者ファーストなので小さく下部に） */
  function recruitSection() {
    return (
      '<div class="section">' +
      '<a class="recruit" href="' + h("guide.html") + '">' +
      '<p class="recruit__label">' + UI.icon("sparkles") + " 出品者募集</p>" +
      '<p class="recruit__lead">あなたの「好き」を、<br>次の収入に。</p>' +
      '<span class="recruit__cta">出品者ガイドを見る ' + UI.icon("arrow-right") + "</span>" +
      "</a></div>"
    );
  }

  function bindSearch() {
    var f = document.getElementById("home-search");
    if (f) f.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = this.q.value.trim();
      App.goto("search/index.html" + (q ? "?q=" + encodeURIComponent(q) : ""));
    });
  }
})();
