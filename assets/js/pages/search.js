/* S2 検索・一覧
   ?tab=plans|creators / ?cat= / ?concern= / ?format= / ?q= / ?type=
   クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  var state = {
    tab: App.qs("tab") === "creators" ? "creators" : "plans",
    cat: App.qs("cat") || "",
    concern: App.qs("concern") || "",
    format: App.qs("format") || "",
    type: App.qs("type") || "",
    q: App.qs("q") || "",
    sort: App.qs("sort") || "popular",
    csort: App.qs("csort") || "popular"
  };

  var GROUPS = ["ビューティー", "ファッション", "ライフスタイル"];
  function groupOf(slug) {
    var c = TAX.categories.filter(function (x) { return x.slug === slug; })[0];
    return c ? c.group : GROUPS[0];
  }
  function groupCatSlugs(group) {
    return TAX.categories.filter(function (c) { return c.group === group; }).map(function (c) { return c.slug; });
  }

  /* カテゴリ下層で他カテゴリへ切り替えるナビ（大カテゴリ segmented ＋ 小カテゴリ chips） */
  function categoryNav() {
    if (!state.cat) return "";
    var first = state.cat.split(",")[0];
    var group = groupOf(first);
    var isAll = state.cat.indexOf(",") !== -1;   // カンマ = グループ総合（すべて）
    var gTabs = GROUPS.map(function (g) {
      return '<button class="cat-tab' + (g === group ? " is-on" : "") + '" data-navg="' + esc(g) + '">' + esc(g) + "</button>";
    }).join("");
    var chips = '<button class="pill sub-chip' + (isAll ? " is-on" : "") + '" data-navcat="__all__">すべて</button>' +
      TAX.categories.filter(function (c) { return c.group === group; }).map(function (c) {
        return '<button class="pill sub-chip' + (!isAll && c.slug === first ? " is-on" : "") + '" data-navcat="' + esc(c.slug) + '">' + esc(c.label) + "</button>";
      }).join("");
    return '<div class="cat-nav"><div class="cat-tabs">' + gTabs + "</div>" + '<div class="sub-chips">' + chips + "</div></div>";
  }

  document.addEventListener("DOMContentLoaded", render);

  function render() {
    var main = document.getElementById("main");
    main.innerHTML = head() + '<div id="results"></div>';
    bindHead();
    load();
  }

  function head() {
    // カテゴリは下のカテゴリナビで切替（悩みタグのみ context chip に残す）
    var concernLabel = state.concern ? label(TAX.concerns, state.concern) : "";
    var contextChips = [];
    if (concernLabel) contextChips.push('<span class="filter-chip is-on" data-clear="concern">' + UI.icon("x") + " #" + esc(concernLabel) + "</span>");

    var formats = [["", "すべて"], ["chat", "チャット"], ["video", "ビデオ"], ["monthly", "月額"]];
    var formatChips = formats.map(function (f) {
      var on = state.format === f[0] ? " is-on" : "";
      return '<button class="filter-chip' + on + '" data-format="' + f[0] + '">' + esc(f[1]) + "</button>";
    }).join("");

    return (
      '<div class="search-head">' +
      '<form id="s-form" class="search-bar">' + UI.icon("search") +
      '<input name="q" type="search" placeholder="やりたいこと・お名前で探す" value="' + esc(state.q) + '" autocomplete="off"></form>' +
      '<div class="tabs">' +
      '<button class="tab' + (state.tab === "plans" ? " is-on" : "") + '" data-tab="plans">プラン</button>' +
      '<button class="tab' + (state.tab === "creators" ? " is-on" : "") + '" data-tab="creators">出品者</button>' +
      "</div></div>" +
      categoryNav() +
      (state.tab === "plans"
        ? '<div class="filter-row">' + contextChips.join("") + formatChips + "</div>"
        : (contextChips.length ? '<div class="filter-row">' + contextChips.join("") + "</div>" : ""))
    );
  }

  function load() {
    var box = document.getElementById("results");
    if (state.tab === "plans") {
      api.getPlans(params()).then(function (list) {
        if (!list.length) { box.innerHTML = UI.empty("条件に合うプランが見つかりませんでした。", "条件をリセット", "search/index.html"); return; }
        list = sortPlans(list, state.sort);
        box.innerHTML =
          '<div class="sort-row"><p class="result-count">' + list.length + "件のプラン</p>" + sortSelect() + "</div>" +
          '<div class="section"><div class="plan-grid">' + list.map(UI.planCard).join("") + "</div></div>";
        var s = document.getElementById("sort");
        if (s) s.addEventListener("change", function () { state.sort = this.value; load(); });
      });
    } else {
      api.getCreators(params()).then(function (list) {
        if (!list.length) { box.innerHTML = UI.empty("条件に合う出品者が見つかりませんでした。", "条件をリセット", "search/index.html"); return; }
        list = sortCreators(list, state.csort);
        box.innerHTML =
          '<div class="sort-row"><p class="result-count">' + list.length + "名の出品者</p>" + creatorSortSelect() + "</div>" +
          '<div class="section stack">' + list.map(UI.creatorCard).join("") + "</div>";
        var s = document.getElementById("sort");
        if (s) s.addEventListener("change", function () { state.csort = this.value; load(); });
      });
    }
  }

  function params() {
    var p = {};
    if (state.cat) p.cat = state.cat;
    if (state.concern) p.concern = state.concern;
    if (state.q) p.q = state.q;
    if (state.tab === "plans" && state.format) p.format = state.format;
    if (state.tab === "creators" && state.type) p.type = state.type;
    return p;
  }

  function bindHead() {
    document.getElementById("s-form").addEventListener("submit", function (e) {
      e.preventDefault();
      state.q = this.q.value.trim();
      load();
    });
    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () { state.tab = t.dataset.tab; render(); });
    });
    document.querySelectorAll("[data-format]").forEach(function (b) {
      b.addEventListener("click", function () { state.format = b.dataset.format; render(); });
    });
    document.querySelectorAll("[data-clear]").forEach(function (b) {
      b.addEventListener("click", function () { state[b.dataset.clear] = ""; render(); });
    });
    document.querySelectorAll("[data-navg]").forEach(function (b) {
      b.addEventListener("click", function () { state.cat = groupCatSlugs(b.dataset.navg).join(","); render(); });
    });
    document.querySelectorAll("[data-navcat]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.cat = b.dataset.navcat === "__all__"
          ? groupCatSlugs(groupOf(state.cat.split(",")[0])).join(",")
          : b.dataset.navcat;
        render();
      });
    });
  }

  /* 並び替え（ココナラ等のカテゴリ内ソートに倣う） */
  function sortSelect() {
    var opts = [["popular", "人気順"], ["new", "新着順"], ["trend", "急上昇"], ["price_asc", "価格が安い順"], ["rating", "評価が高い順"]];
    return '<select class="sort-select" id="sort" aria-label="並び替え">' + opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (state.sort === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
    }).join("") + "</select>";
  }
  function sortPlans(list, sort) {
    var a = list.slice();
    if (sort === "new") return a.reverse();                                   // 新着(配列後方=新しい)
    if (sort === "trend") return a.sort(function (x, y) { return trend(y) - trend(x); });   // 急上昇(PV)
    if (sort === "price_asc") return a.sort(function (x, y) { return x.price - y.price; });
    if (sort === "rating") return a.sort(function (x, y) { return (y.stats.rating || 0) - (x.stats.rating || 0) || (y.stats.sales || 0) - (x.stats.sales || 0); });
    return a.sort(function (x, y) { return (y.stats.sales || 0) - (x.stats.sales || 0); });  // 人気(販売数)
  }
  function trend(p) { return p.stats.pv != null ? p.stats.pv : Math.round((p.stats.sales || 0) * 1.6 + (p.price % 40) * 4); }

  /* 出品者の並び替え（ココナラ等の実績・評価・フォロワーに倣う） */
  function creatorSortSelect() {
    var opts = [["popular", "人気順"], ["followers", "フォロワーが多い順"], ["rating", "評価が高い順"], ["sales", "実績が多い順"], ["new", "新着順"]];
    return '<select class="sort-select" id="sort" aria-label="並び替え">' + opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (state.csort === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
    }).join("") + "</select>";
  }
  function followers(c) { var s = c.sns || {}; return (s.instagram || 0) + (s.tiktok || 0) + (s.youtube || 0) + (s.x || 0); }
  function sortCreators(list, sort) {
    var a = list.slice();
    if (sort === "new") return a.reverse();
    if (sort === "followers") return a.sort(function (x, y) { return followers(y) - followers(x); });
    if (sort === "rating") return a.sort(function (x, y) { return (y.stats.rating || 0) - (x.stats.rating || 0) || (y.stats.sales || 0) - (x.stats.sales || 0); });
    if (sort === "sales") return a.sort(function (x, y) { return (y.stats.sales || 0) - (x.stats.sales || 0); });
    return a.sort(function (x, y) { return followers(y) - followers(x) || (y.stats.sales || 0) - (x.stats.sales || 0); });  // 人気(フォロワー＋実績)
  }

  function label(list, slug) {
    var hit = list.filter(function (x) { return x.slug === slug; })[0];
    return hit ? hit.label : slug;
  }
})();
