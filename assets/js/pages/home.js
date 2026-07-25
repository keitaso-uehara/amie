/* S1 TOP（箱型マーケットプレイス型・出品×購入の2軸）
   並び: 検索 → 特集バナー → 人気のユーザー → カテゴリ → オススメ
        → カテゴリ別ランキング → ELLMIEの説明 → NEWS → フッター
   クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  var GROUP_CLASS = { "ビューティー": "beauty", "ファッション": "fashion", "ライフスタイル": "life" };
  var GROUPS = ["ビューティー", "ファッション", "ライフスタイル"];
  var usersSorted = [];   // 人気のユーザー（フォロワー数順・グループ切替用）

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    Promise.all([
      api.getCreators({}),
      api.getPlans()
    ]).then(function (res) {
      var creators = res[0] || [], plans = res[1] || [];
      var popular = plans.slice().sort(function (a, b) { return (b.stats.sales || 0) - (a.stats.sales || 0); });
      main.innerHTML =
        searchBar() +
        featuresShelf() +
        usersSection(creators) +
        categorySection() +
        recommendShelf(popular.slice(0, 8)) +
        rankingSection(plans) +
        aboutSection() +
        newsSection() +
        UI.siteFooter();
      bindSearch();
      bindCategoryTabs();
      bindUsers();
    });
  });

  /* ① 検索バー */
  function searchBar() {
    return (
      '<div class="home-search-wrap">' +
      '<form id="home-search" class="home-search">' + UI.icon("search") +
      '<input name="q" type="search" placeholder="やりたいこと・お名前で探す" autocomplete="off">' +
      "</form></div>"
    );
  }

  /* ② 特集・ピックアップ（スライドバナー） */
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

  /* ③ 人気のユーザー（総合ランキング＋グループ選択ランキング。人気度＝PV順） */
  function followerTotal(c) { var s = c.sns || {}; return (s.instagram || 0) + (s.tiktok || 0) + (s.youtube || 0) + (s.x || 0); }
  function pvOf(c) { var s = c.stats || {}; return s.pv != null ? s.pv : Math.round(followerTotal(c) / 40) + (s.sales || 0); }
  function catGroup(slug) { var c = TAX.categories.filter(function (x) { return x.slug === slug; })[0]; return c ? c.group : null; }
  function usersRow(sorted, moreHref) {
    var cards = sorted.slice(0, 5).map(function (c, i) {
      return '<div class="rank-user"><span class="rank-badge rank-' + (i + 1) + '">' + (i + 1) + "</span>" + UI.creatorMini(c) + "</div>";
    }).join("");
    var more = sorted.length > 5
      ? '<a class="rank-more-card" href="' + h(moreHref) + '"><span class="rank-more-card__ic">' + UI.icon("arrow-right") + "</span>もっと見る</a>"
      : "";
    return cards + more;
  }
  function groupUsersRow(group) {
    var slugs = TAX.categories.filter(function (c) { return c.group === group; }).map(function (c) { return c.slug; });
    var inGroup = usersSorted.filter(function (c) { return slugs.indexOf(c.mainCategory || (c.categories && c.categories[0])) !== -1; });
    return usersRow(inGroup, "users.html?group=" + encodeURIComponent(group));
  }
  function usersSection(creators) {
    usersSorted = creators.slice().sort(function (a, b) { return pvOf(b) - pvOf(a); });
    var tabs = GROUPS.map(function (g, i) {
      return '<button class="cat-tab' + (i === 0 ? " is-on" : "") + '" data-ug="' + esc(g) + '">' + esc(g) + "</button>";
    }).join("");
    return (
      '<div class="section">' +
      '<p class="section__title">人気のユーザー</p>' +
      '<p class="rank-group__label">総合</p>' +
      '<div class="rank-scroll">' + usersRow(usersSorted, "users.html") + "</div>" +
      '<div class="cat-tabs" id="user-tabs" style="margin-top:18px;">' + tabs + "</div>" +
      '<div class="rank-scroll" id="user-group-row">' + groupUsersRow(GROUPS[0]) + "</div>" +
      "</div>"
    );
  }
  function bindUsers() {
    var tabs = document.getElementById("user-tabs");
    if (!tabs) return;
    tabs.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ug]"); if (!b) return;
      Array.prototype.forEach.call(tabs.querySelectorAll(".cat-tab"), function (x) { x.classList.toggle("is-on", x === b); });
      document.getElementById("user-group-row").innerHTML = groupUsersRow(b.dataset.ug);
    });
  }

  /* ④ カテゴリ（グループタブ＋1行スクロール） */
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

  /* ⑤ オススメ（人気の相談プランをスライド） */
  function recommendShelf(plans) {
    if (!plans.length) return "";
    return (
      '<div class="section">' +
      '<p class="section__title">オススメの相談' +
      '<a class="more" href="' + h("search/index.html") + '">もっと見る ' + UI.icon("chevron-right") + "</a></p>" +
      '<div class="plan-scroll">' + plans.map(UI.planCard).join("") + "</div></div>"
    );
  }

  /* ⑥ カテゴリ別ランキング（3グループ縦積み・各グループ横スクロール・もっと見るで下層へ） */
  function rankingSection(plans) {
    var catGroup = {};
    TAX.categories.forEach(function (c) { catGroup[c.slug] = c.group; });
    var byGroup = {};
    GROUPS.forEach(function (g) { byGroup[g] = []; });
    plans.forEach(function (p) { var g = catGroup[p.category]; if (byGroup[g]) byGroup[g].push(p); });
    var blocks = GROUPS.map(function (gname) {
      var gp = byGroup[gname].sort(function (a, b) { return (b.stats.sales || 0) - (a.stats.sales || 0); });
      if (!gp.length) return "";
      return '<div class="rank-group">' +
        '<p class="rank-group__label">' + esc(gname) +
        '<a class="more" href="' + h("ranking.html?group=" + encodeURIComponent(gname)) + '">もっと見る ' + UI.icon("chevron-right") + "</a></p>" +
        '<div class="rank-scroll">' + rankItems(gp, gname) + "</div></div>";
    }).join("");
    if (!blocks) return "";
    return '<div class="section"><p class="section__title">カテゴリ別ランキング</p>' + blocks + "</div>";
  }
  /* 1〜5位のカード＋6枚目に「もっと見る」カード（残りがあれば） */
  function rankItems(plans, group) {
    var cards = plans.slice(0, 5).map(function (p, i) {
      return '<div class="rank-item"><span class="rank-badge rank-' + (i + 1) + '">' + (i + 1) + "</span>" + UI.planCard(p) + "</div>";
    }).join("");
    var more = plans.length > 5
      ? '<a class="rank-more-card" href="' + h("ranking.html?group=" + encodeURIComponent(group)) + '"><span class="rank-more-card__ic">' + UI.icon("arrow-right") + "</span>もっと見る</a>"
      : "";
    return cards + more;
  }

  /* ⑦ ELLMIEの説明 */
  function aboutSection() {
    return (
      '<div class="section">' +
      '<div class="about-band">' +
      '<p class="about-band__logo">ELLMIE</p>' +
      '<p class="about-band__lead">憧れの人に、相談できる。</p>' +
      '<p class="about-band__sub">メイク・コーデ・暮らしを、憧れの人が1対1で直接アドバイス。チャットやビデオで、あなたに合わせて。</p>' +
      '<a class="btn btn--outline btn--sm" href="' + h("about.html") + '">ELLMIEについて</a>' +
      "</div></div>"
    );
  }

  /* ⑧ NEWS */
  function newsSection() {
    var items = window.DB.news || [];
    if (!items.length) return "";
    return (
      '<div class="section">' +
      '<p class="section__title">NEWS<a class="more" href="' + h("about.html") + '">一覧 ' + UI.icon("chevron-right") + "</a></p>" +
      '<div class="news-list">' + items.map(function (n) {
        return '<div class="news-row"><span class="news-row__date">' + esc(n.date) + "</span>" +
          '<span class="news-row__t">' + esc(n.title) + "</span></div>";
      }).join("") + "</div></div>"
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
