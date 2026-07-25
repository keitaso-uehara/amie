/* =========================================================
   app.js — 全ページ共通の初期化とユーティリティ(window.App)
   ページJSは「クエリ読取 → api呼び出し → 描画」の3層を守ること。
   ========================================================= */
window.App = (function () {
  var root = document.body.dataset.root || "./";

  function href(path) { return root + path; }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function goto(path) { location.href = href(path); }

  /* 金額表示(税込・カンマ区切り)。手数料は購入者に見せない(仕様書 0.3) */
  function money(n) { return "¥" + Number(n || 0).toLocaleString("ja-JP"); }

  /* 予約枠ラベル。"YYYY-MM-DDTHH:MM"(datetime-local) → "M/D(曜) HH:MM"。旧形式の自由文字列はそのまま */
  var _WD = ["日", "月", "火", "水", "木", "金", "土"];
  function slotLabel(v) {
    if (!v) return "";
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(v));
    if (!m) return String(v);
    var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return (d.getMonth() + 1) + "/" + d.getDate() + "(" + _WD[d.getDay()] + ") " + m[4] + ":" + m[5];
  }

  document.addEventListener("DOMContentLoaded", function () {
    var topbarEl = document.getElementById("topbar");
    if (topbarEl) {
      topbarEl.className = "topbar";
      topbarEl.innerHTML = UI.topbar();
      var backEl = document.getElementById("nav-back");
      if (backEl) {
        backEl.addEventListener("click", function () {
          if (history.length > 1) history.back();
          else goto("index.html");
        });
      }
      bindTopbarNav();
    }
    // 下部タブバー(あれば描画)
    var tabEl = document.getElementById("tabbar");
    if (tabEl) {
      var page = document.body.dataset.page;
      api.getUnreadCount().then(function (unread) {
        tabEl.className = "tabbar";
        tabEl.innerHTML = UI.tabbar(page, unread);
      });
    }
  });

  /* ヘッダー右のベル・検索・メニュー(全ページ共通の束ね) */
  function bindTopbarNav() {
    var menu = document.getElementById("nav-menu");
    var search = document.getElementById("nav-search");
    var notif = document.getElementById("nav-notif");
    if (menu) menu.addEventListener("click", UI.openMenu);
    if (search) search.addEventListener("click", function () { goto("search/index.html"); });
    if (notif) {
      notif.addEventListener("click", function () { goto("notifications/index.html"); });
      api.getUnreadCount().then(function (n) {
        var dot = document.getElementById("notif-dot");
        if (dot && n > 0) dot.hidden = false;
      });
    }
  }

  return { root: root, href: href, qs: qs, esc: esc, goto: goto, money: money, slotLabel: slotLabel };
})();
