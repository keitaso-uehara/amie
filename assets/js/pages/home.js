/* S1 TOP（箱型マーケットプレイス型・出品×購入の2軸）
   並び: 検索バー → カテゴリ(タブ) → 注目の出品者 → 特集 → 人気のプラン
        → 新着プラン → 出品者募集 → フッター
   実サイト調査(MENTA/ココナラ/Creema)を反映: 人(注目の出品者)を上位、人気→新着の順。
   ELLMIEは「憧れの人に相談」＝人が主役なので注目を高い位置に。
   クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  var GROUP_CLASS = { "ビューティー": "beauty", "ファッション": "fashion", "ライフスタイル": "life" };

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    Promise.all([
      api.getFeaturedCreators(8),
      api.getPopularPlans(6),
      api.getNewPlans(6)
    ]).then(function (res) {
      var creators = res[0], popular = res[1], newest = res[2];
      main.innerHTML =
        searchBar() +
        categorySection() +
        featuredShelf(creators) +
        featuresShelf() +
        plansShelf(popular) +
        newPlansShelf(newest) +
        recruitSection() +
        UI.siteFooter();
      bindSearch();
      bindCategoryTabs();
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

  /* ② カテゴリから探す（グループをタブで切替＋1行スクロールでコンパクトに） */
  var GROUPS = ["ビューティー", "ファッション", "ライフスタイル"];
  function categorySection() {
    var tabs = GROUPS.map(function (gname, i) {
      return '<button class="cat-tab' + (i === 0 ? " is-on" : "") + '" data-g="' + esc(gname) + '">' + esc(gname) + "</button>";
    }).join("");
    return (
      '<div class="section">' +
      '<p class="section__title">カテゴリから探す</p>' +
      '<div class="cat-tabs" id="cat-tabs">' + tabs + "</div>" +
      '<div class="cat-scroll-g" id="cat-tiles">' + catTiles(GROUPS[0]) + "</div></div>"
    );
  }
  function catTiles(gname) {
    var g = GROUP_CLASS[gname] || "life";
    return TAX.categories.filter(function (c) { return c.group === gname; }).map(function (c) {
      return '<a class="cat-tile cat-tile--' + g + '" href="' + h("search/index.html?cat=" + c.slug) + '">' +
        '<span class="cat-tile__ic">' + UI.icon(c.icon) + "</span>" +
        '<span class="cat-tile__l">' + esc(c.label) + "</span></a>";
    }).join("");
  }
  function bindCategoryTabs() {
    var tabs = document.getElementById("cat-tabs");
    if (!tabs) return;
    tabs.addEventListener("click", function (e) {
      var b = e.target.closest("[data-g]"); if (!b) return;
      Array.prototype.forEach.call(tabs.querySelectorAll(".cat-tab"), function (x) { x.classList.toggle("is-on", x === b); });
      document.getElementById("cat-tiles").innerHTML = catTiles(b.dataset.g);
    });
  }

  /* ③ 特集・ピックアップ（運営CMSで編集する想定のバナー棚） */
  function featuresShelf() {
    var items = window.DB.features || [];
    if (!items.length) return "";
    return (
      '<div class="section">' +
      '<p class="section__title">特集・ピックアップ</p>' +
      '<div class="feature-scroll">' + items.map(function (f) {
        return '<a class="feature-card feature-card--' + esc(f.tone || "rose") + '" href="' + h("search/index.html?" + f.q) + '">' +
          '<p class="feature-card__title">' + esc(f.title) + "</p>" +
          '<p class="feature-card__sub">' + esc(f.sub) + "</p>" +
          '<span class="feature-card__go">見る ' + UI.icon("arrow-right") + "</span></a>";
      }).join("") + "</div></div>"
    );
  }

  /* ④ 注目の出品者の棚 */
  function featuredShelf(creators) {
    return (
      '<div class="section">' +
      '<p class="section__title">注目の出品者' +
      '<a class="more" href="' + h("search/index.html?tab=creators") + '">もっと見る ' + UI.icon("chevron-right") + "</a></p>" +
      '<div class="creator-scroll">' + creators.map(UI.creatorMini).join("") + "</div></div>"
    );
  }

  /* ⑤ 人気のプランの棚 */
  function plansShelf(plans) {
    return (
      '<div class="section">' +
      '<p class="section__title">人気のプラン' +
      '<a class="more" href="' + h("search/index.html") + '">もっと見る ' + UI.icon("chevron-right") + "</a></p>" +
      '<div class="plan-scroll">' + plans.map(UI.planCard).join("") + "</div></div>"
    );
  }

  /* ⑦ 新着プランの棚 */
  function newPlansShelf(plans) {
    if (!plans.length) return "";
    return (
      '<div class="section">' +
      '<p class="section__title">新着プラン' +
      '<a class="more" href="' + h("search/index.html") + '">もっと見る ' + UI.icon("chevron-right") + "</a></p>" +
      '<div class="plan-scroll">' + plans.map(UI.planCard).join("") + "</div></div>"
    );
  }

  /* ⑧ 出品者募集（購入者ファーストなので小さく下部に） */
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
