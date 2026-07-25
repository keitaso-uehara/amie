/* カテゴリ別ランキング（下層）
   大カテゴリ(グループ)タブ → グループ総合ランキング。小カテゴリ(チップ)でさらに絞り込み。
   初期は10件表示＋「もっと見る」で展開。販売数順。
   クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };
  var GROUPS = ["ビューティー", "ファッション", "ライフスタイル"];
  var FMT_ICON = { chat: "message-2", video: "video", monthly: "calendar-heart" };
  var STEP = 10, MAX = 30;   // 初期10件→もっと見るで最大30位まで。以降は検索へ
  var byCat = {};
  var state = { group: GROUPS[0], sub: null, limit: STEP };

  document.addEventListener("DOMContentLoaded", function () {
    var g = App.qs("group"); if (GROUPS.indexOf(g) !== -1) state.group = g;
    api.getPlans().then(function (plans) {
      byCat = {};
      plans.forEach(function (p) { (byCat[p.category] = byCat[p.category] || []).push(p); });
      Object.keys(byCat).forEach(function (k) {
        byCat[k].sort(function (a, b) { return (b.stats.sales || 0) - (a.stats.sales || 0); });
      });
      var cat = App.qs("cat");
      var t = TAX.categories.filter(function (c) { return c.slug === cat; })[0];
      if (t && t.group === state.group && byCat[cat]) state.sub = cat;
      render();
    });
  });

  function render() {
    document.getElementById("main").innerHTML =
      '<div class="page-head"><h1>カテゴリ別ランキング</h1></div>' +
      groupTabs() +
      subChips() +
      '<div class="section" style="padding-top:8px;" id="rk-body"></div>' +
      UI.siteFooter();
    updateBody();
    bindTabs();
  }

  function updateBody() {
    document.getElementById("rk-body").innerHTML = rankList(currentPlans());
    var m = document.getElementById("rk-more");
    if (m) m.addEventListener("click", function () { state.limit += STEP; updateBody(); });
  }

  /* 小カテゴリ指定なら小カテゴリ内、なければグループ総合 */
  function currentPlans() {
    if (state.sub) return (byCat[state.sub] || []).slice();
    var all = [];
    TAX.categories.filter(function (c) { return c.group === state.group; }).forEach(function (c) {
      if (byCat[c.slug]) all = all.concat(byCat[c.slug]);
    });
    return all.sort(function (a, b) { return (b.stats.sales || 0) - (a.stats.sales || 0); });
  }

  function groupTabs() {
    return '<div class="section" style="padding-top:8px;padding-bottom:0;"><div class="cat-tabs">' +
      GROUPS.map(function (g) {
        return '<button class="cat-tab' + (g === state.group ? " is-on" : "") + '" data-g="' + esc(g) + '">' + esc(g) + "</button>";
      }).join("") + "</div></div>";
  }

  function subChips() {
    var cats = TAX.categories.filter(function (c) { return c.group === state.group && byCat[c.slug]; });
    var chips = '<button class="pill sub-chip' + (state.sub === null ? " is-on" : "") + '" data-sub="">すべて</button>' +
      cats.map(function (c) {
        return '<button class="pill sub-chip' + (state.sub === c.slug ? " is-on" : "") + '" data-sub="' + esc(c.slug) + '">' + esc(c.label) + "</button>";
      }).join("");
    return '<div class="sub-chips">' + chips + "</div>";
  }

  function rankList(plans) {
    if (!plans.length) return UI.empty("このカテゴリのランキングはまだありません。");
    var label = state.sub ? (TAX.categories.filter(function (c) { return c.slug === state.sub; })[0] || {}).label : state.group + "・総合";
    var cap = Math.min(state.limit, MAX);
    var rows = plans.slice(0, cap).map(function (p, i) {
      var c = p.creator || {};
      return '<a class="rlist-row" href="' + h("plans/show.html?id=" + p.id) + '">' +
        '<span class="rlist-row__no rank-' + (i + 1) + '">' + (i + 1) + "</span>" +
        '<span class="rlist-row__cover rlist-row__cover--' + p.format + '">' + UI.icon(FMT_ICON[p.format] || "message-2") + "</span>" +
        '<div class="rlist-row__body">' +
        '<p class="rlist-row__t">' + esc(p.title) + "</p>" +
        '<p class="rlist-row__m">' + UI.avatar(c, "avatar--xs") + esc(c.name) + (c.verified ? UI.verified() : "") + "</p>" +
        '<p class="rlist-row__stat">' + UI.icon("star-filled") + " " + p.stats.rating + " (" + p.stats.sales + ") ・ " + App.money(p.price) + "</p>" +
        "</div></a>";
    }).join("");
    // 30位で終了。それ未満で残りがあれば「もっと見る」
    var foot = (cap < plans.length && cap < MAX)
      ? '<button class="btn btn--outline btn--block" id="rk-more" style="margin-top:14px;">もっと見る</button>'
      : "";
    return '<p class="section__title">' + esc(label) + "ランキング</p>" + '<div class="rlist">' + rows + "</div>" + foot;
  }

  function bindTabs() {
    var gt = document.querySelector(".cat-tabs");
    if (gt) gt.addEventListener("click", function (e) {
      var b = e.target.closest("[data-g]"); if (!b) return;
      state.group = b.dataset.g; state.sub = null; state.limit = STEP; render();
    });
    var sc = document.querySelector(".sub-chips");
    if (sc) sc.addEventListener("click", function (e) {
      var b = e.target.closest("[data-sub]"); if (!b) return;
      state.sub = b.dataset.sub || null; state.limit = STEP;
      Array.prototype.forEach.call(sc.querySelectorAll(".sub-chip"), function (x) { x.classList.toggle("is-on", x === b); });
      updateBody();
    });
  }
})();
