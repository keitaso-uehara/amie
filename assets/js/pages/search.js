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
    sort: App.qs("sort") || "popular"
  };

  document.addEventListener("DOMContentLoaded", render);

  function render() {
    var main = document.getElementById("main");
    main.innerHTML = head() + '<div id="results"></div>';
    bindHead();
    load();
  }

  function head() {
    var catLabel = state.cat ? label(TAX.categories, state.cat) : "";
    var concernLabel = state.concern ? label(TAX.concerns, state.concern) : "";
    var contextChips = [];
    if (catLabel) contextChips.push('<span class="filter-chip is-on" data-clear="cat">' + UI.icon("x") + " " + esc(catLabel) + "</span>");
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
        box.innerHTML = list.length
          ? '<p class="result-count">' + list.length + "名の出品者</p>" +
            '<div class="section stack">' + list.map(UI.creatorCard).join("") + "</div>"
          : UI.empty("条件に合う出品者が見つかりませんでした。", "条件をリセット", "search/index.html");
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

  function label(list, slug) {
    var hit = list.filter(function (x) { return x.slug === slug; })[0];
    return hit ? hit.label : slug;
  }
})();
