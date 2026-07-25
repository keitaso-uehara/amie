/* 人気のユーザー（下層）
   総合／ビューティー／ファッション／ライフスタイル をカテゴリ選択（ソートは無し）。
   人気度＝PV(想定ページビュー)順。初期10位→もっと見るで最大30位まで。
   クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };
  var GROUPS = ["ビューティー", "ファッション", "ライフスタイル"];
  var TABS = ["総合"].concat(GROUPS);
  var STEP = 10, MAX = 30;
  var all = [];   // PV順の全出品者
  var state = { sel: "総合", limit: STEP };

  function followerTotal(c) { var s = c.sns || {}; return (s.instagram || 0) + (s.tiktok || 0) + (s.youtube || 0) + (s.x || 0); }
  function pvOf(c) { var s = c.stats || {}; return s.pv != null ? s.pv : Math.round(followerTotal(c) / 40) + (s.sales || 0); }
  function groupOf(c) {
    var slug = c.mainCategory || (c.categories && c.categories[0]);
    var cat = TAX.categories.filter(function (x) { return x.slug === slug; })[0];
    return cat ? cat.group : null;
  }
  function fmtCount(n) {
    if (n >= 10000) return (Math.round(n / 1000) / 10).toString().replace(/\.0$/, "") + "万";
    if (n >= 1000) return (Math.round(n / 100) / 10).toString().replace(/\.0$/, "") + "千";
    return String(n);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var g = App.qs("group"); if (GROUPS.indexOf(g) !== -1) state.sel = g;
    api.getCreators({}).then(function (list) {
      all = (list || []).slice().sort(function (a, b) { return pvOf(b) - pvOf(a); });
      render();
    });
  });

  function render() {
    document.getElementById("main").innerHTML =
      '<div class="page-head"><h1>人気のユーザー</h1></div>' +
      groupTabs() +
      '<div class="section" style="padding-top:8px;" id="uk-body"></div>' +
      UI.siteFooter();
    updateBody();
    bindTabs();
  }

  function groupTabs() {
    return '<div class="section" style="padding-top:8px;padding-bottom:0;"><div class="cat-tabs">' +
      TABS.map(function (t) {
        return '<button class="cat-tab' + (t === state.sel ? " is-on" : "") + '" data-sel="' + esc(t) + '">' + esc(t) + "</button>";
      }).join("") + "</div></div>";
  }

  function currentList() {
    if (state.sel === "総合") return all;
    return all.filter(function (c) { return groupOf(c) === state.sel; });
  }

  function updateBody() {
    document.getElementById("uk-body").innerHTML = rankList(currentList());
    var m = document.getElementById("uk-more");
    if (m) m.addEventListener("click", function () { state.limit += STEP; updateBody(); });
  }

  function rankList(list) {
    if (!list.length) return UI.empty("このカテゴリのユーザーはまだいません。");
    var cap = Math.min(state.limit, MAX);
    var rows = list.slice(0, cap).map(function (c, i) {
      var ft = followerTotal(c);
      var follow = ft ? '<span class="urank-follow">' + UI.icon("users") + " " + fmtCount(ft) + "</span>" : "";
      var rate = (c.stats && c.stats.rating) ? '<span class="urank-rate">' + UI.icon("star-filled") + " " + c.stats.rating + "</span>" : "";
      return '<a class="rlist-row" href="' + h("creators/show.html?id=" + c.id) + '">' +
        '<span class="rlist-row__no rank-' + (i + 1) + '">' + (i + 1) + "</span>" +
        UI.avatar(c, "avatar--lg") +
        '<div class="rlist-row__body">' +
        '<p class="rlist-row__t">' + esc(c.name) + (c.verified ? UI.verified() : "") + "</p>" +
        '<p class="rlist-row__m">' + esc(c.typeLabel) + "</p>" +
        '<p class="rlist-row__stat urank-stat">' + follow + rate + "</p>" +
        "</div>" + UI.icon("chevron-right") + "</a>";
    }).join("");
    var label = state.sel === "総合" ? "総合" : state.sel;
    var foot = (cap < list.length && cap < MAX)
      ? '<button class="btn btn--outline btn--block" id="uk-more" style="margin-top:14px;">もっと見る</button>'
      : "";
    return '<p class="section__title">' + esc(label) + "ランキング</p>" + '<div class="rlist rlist--user">' + rows + "</div>" + foot;
  }

  function bindTabs() {
    var gt = document.querySelector(".cat-tabs");
    if (!gt) return;
    gt.addEventListener("click", function (e) {
      var b = e.target.closest("[data-sel]"); if (!b) return;
      state.sel = b.dataset.sel; state.limit = STEP;
      Array.prototype.forEach.call(gt.querySelectorAll(".cat-tab"), function (x) { x.classList.toggle("is-on", x === b); });
      updateBody();
    });
  }
})();
