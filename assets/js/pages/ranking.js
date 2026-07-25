/* カテゴリ別ランキング（下層）
   ?group= のグループ内の各カテゴリを、順位カード（サムネイル＋バッジ）で表示。
   グループはタブで切替。各カテゴリの「すべて」で検索へ。
   クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };
  var GROUPS = ["ビューティー", "ファッション", "ライフスタイル"];
  var byCat = {};

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    var group = App.qs("group");
    if (GROUPS.indexOf(group) === -1) group = GROUPS[0];
    api.getPlans().then(function (plans) {
      byCat = {};
      plans.forEach(function (p) { (byCat[p.category] = byCat[p.category] || []).push(p); });
      Object.keys(byCat).forEach(function (k) {
        byCat[k].sort(function (a, b) { return (b.stats.sales || 0) - (a.stats.sales || 0); });
      });
      main.innerHTML =
        '<div class="page-head"><h1>カテゴリ別ランキング</h1></div>' +
        groupTabs(group) +
        '<div id="rk-body">' + groupBody(group) + "</div>" +
        UI.siteFooter();
      bindTabs();
    });
  });

  function groupTabs(active) {
    return '<div class="section" style="padding-top:8px;padding-bottom:0;"><div class="cat-tabs">' +
      GROUPS.map(function (g) {
        return '<button class="cat-tab' + (g === active ? " is-on" : "") + '" data-g="' + esc(g) + '">' + esc(g) + "</button>";
      }).join("") + "</div></div>";
  }

  function groupBody(group) {
    var cats = TAX.categories.filter(function (c) { return c.group === group && byCat[c.slug]; });
    if (!cats.length) return UI.empty("このグループのランキングはまだありません。");
    return cats.map(function (c) {
      return '<div class="section">' +
        '<p class="section__title">' + esc(c.label) +
        '<a class="more" href="' + h("search/index.html?cat=" + c.slug) + '">すべて ' + UI.icon("chevron-right") + "</a></p>" +
        '<div class="rank-scroll">' + rankItems(byCat[c.slug]) + "</div></div>";
    }).join("");
  }

  function rankItems(plans) {
    return plans.slice(0, 6).map(function (p, i) {
      return '<div class="rank-item"><span class="rank-badge rank-' + (i + 1) + '">' + (i + 1) + "</span>" + UI.planCard(p) + "</div>";
    }).join("");
  }

  function bindTabs() {
    var tabs = document.querySelector(".cat-tabs");
    if (!tabs) return;
    tabs.addEventListener("click", function (e) {
      var b = e.target.closest("[data-g]"); if (!b) return;
      Array.prototype.forEach.call(tabs.querySelectorAll(".cat-tab"), function (x) { x.classList.toggle("is-on", x === b); });
      document.getElementById("rk-body").innerHTML = groupBody(b.dataset.g);
    });
  }
})();
