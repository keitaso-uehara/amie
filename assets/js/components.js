/* =========================================================
   components.js — 共通コンポーネントの描画関数(window.UI)
   HTML文字列を返す。Next.js移行時はそのままコンポーネント化する。
   ========================================================= */
window.UI = (function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };
  var money = function (n) { return App.money(n); };

  function icon(name) { return '<i class="ti ti-' + name + '"></i>'; }

  /* 形式バッジ(チャット/ビデオ/月額) */
  var FORMAT = {
    chat:    { label: "チャット", icon: "message-2", cls: "fmt--chat" },
    video:   { label: "ビデオ",   icon: "video",     cls: "fmt--video" },
    monthly: { label: "月額",     icon: "calendar-heart", cls: "fmt--monthly" }
  };
  function formatBadge(format) {
    var f = FORMAT[format] || FORMAT.chat;
    return '<span class="fmt ' + f.cls + '">' + icon(f.icon) + " " + f.label + "</span>";
  }
  /* プランの価格サフィックス(月額は /月) */
  function priceLabel(plan) {
    return '<span class="price">' + money(plan.price) + (plan.format === "monthly" ? '<small> /月</small>' : "") + "</span>";
  }
  /* 形式ごとの補足(相談期間/時間/月の回数) */
  function formatDetail(plan) {
    if (plan.format === "chat") return "相談し放題 " + plan.chatDays + "日間";
    if (plan.format === "video") return "ビデオ通話 " + plan.minutes + "分";
    if (plan.format === "monthly") {
      var v = plan.monthlyVideos > 0 ? "・月" + plan.monthlyVideos + "回ビデオ" : "";
      return "チャット相談し放題" + v;
    }
    return "";
  }

  /* 認証バッジ(eKYC済) */
  function verified() { return '<span class="verified" title="本人確認済み">' + icon("rosette-discount-check-filled") + "</span>"; }

  /* 星評価 */
  function stars(n) {
    var full = Math.round(n);
    var out = "";
    for (var i = 1; i <= 5; i++) out += icon(i <= full ? "star-filled" : "star");
    return '<span class="stars">' + out + "</span>";
  }

  /* SNSフォロワー数(連携済のみ・週次更新の想定)。オープン出品でも信頼を判断できる中核表示 */
  function fmtCount(n) {
    if (n >= 10000) return (Math.round(n / 1000) / 10).toString().replace(/\.0$/, "") + "万";
    if (n >= 1000) return (Math.round(n / 100) / 10).toString().replace(/\.0$/, "") + "千";
    return String(n);
  }
  function snsFollowers(creator, opts) {
    opts = opts || {};
    var s = creator.sns || {};
    var order = [["instagram", "brand-instagram", "ig"], ["tiktok", "brand-tiktok", "tiktok"],
                 ["youtube", "brand-youtube", "youtube"], ["x", "brand-x", "x"]];
    var items = order.filter(function (o) { return s[o[0]]; }).map(function (o) {
      return '<span class="sns-follow sns-follow--' + o[2] + '">' + icon(o[1]) + " <b>" + fmtCount(s[o[0]]) + "</b></span>";
    });
    if (!items.length) return "";
    return '<div class="sns-follows' + (opts.compact ? " sns-follows--compact" : "") + '">' + items.join("") + "</div>";
  }

  /* 出品者のアバター(頭文字。実装では画像URL) */
  function avatar(creator, cls) {
    return '<span class="avatar ' + (cls || "") + '">' + esc((creator.name || "?").charAt(0)) + "</span>";
  }

  /* ---------- トップバー ---------- */
  function topbar() {
    var session = api.getSession();
    var right = session
      ? '<a class="topbar__avatar" href="' + h("me/index.html") + '" aria-label="マイページ">' + icon("user") + "</a>"
      : '<a class="topbar__icon" href="' + h("login/index.html") + '" aria-label="ログイン">' + icon("user-circle") + "</a>";

    if (document.body.dataset.page === "home") {
      return (
        '<button class="topbar__icon" id="nav-menu" type="button" aria-label="メニュー">' + icon("menu-2") + "</button>" +
        '<a class="topbar__logo" href="' + h("index.html") + '">ELLMIE</a>' +
        '<span class="topbar__right">' +
        '<button class="topbar__icon topbar__icon--bell" id="nav-notif" type="button" aria-label="通知">' +
        icon("bell") + '<span class="topbar__dot" id="notif-dot" hidden></span></button>' +
        right + "</span>"
      );
    }
    return (
      '<button class="topbar__back" id="nav-back" type="button" aria-label="戻る">' + icon("chevron-left") + "</button>" +
      '<a class="topbar__logo topbar__logo--center" href="' + h("index.html") + '">ELLMIE</a>' +
      '<span class="topbar__user">' + right + "</span>"
    );
  }

  /* ---------- 下部タブバー(仕様書 0.1: ホーム/さがす/メッセージ/マイページ) ---------- */
  function tabbar(activePage, unread) {
    var items = [
      { key: "home",     label: "ホーム",    icon: "home",       href: "index.html" },
      { key: "search",   label: "さがす",    icon: "search",     href: "search/index.html" },
      { key: "messages", label: "メッセージ", icon: "message-2",  href: "messages/index.html" },
      { key: "me",       label: "マイページ", icon: "user",       href: "me/index.html" }
    ];
    return items.map(function (it) {
      var active = it.key === activePage ? " is-active" : "";
      var dot = it.key === "messages" && unread > 0 ? '<span class="tabbar__dot"></span>' : "";
      return '<a class="tabbar__item' + active + '" href="' + h(it.href) + '">' + dot + icon(it.icon) + "<p>" + it.label + "</p></a>";
    }).join("");
  }

  /* ---------- 出品者カード ---------- */
  function creatorCard(c) {
    var url = h("creators/show.html?id=" + c.id);
    return (
      '<a class="creator-card" href="' + url + '">' +
      '<span class="creator-card__cover"></span>' +
      avatar(c, "avatar--lg creator-card__avatar") +
      '<div class="creator-card__body">' +
      '<p class="creator-card__name">' + esc(c.name) + (c.verified ? verified() : "") + "</p>" +
      '<p class="creator-card__type">' + esc(c.typeLabel) + "</p>" +
      snsFollowers(c, { compact: true }) +
      '<p class="creator-card__tagline">' + esc(c.tagline) + "</p>" +
      "</div></a>"
    );
  }

  /* 横スクロール用の小さめ出品者カード */
  function creatorMini(c) {
    return (
      '<a class="creator-mini" href="' + h("creators/show.html?id=" + c.id) + '">' +
      avatar(c, "avatar--lg") +
      '<p class="creator-mini__name">' + esc(c.name) + (c.verified ? verified() : "") + "</p>" +
      '<p class="creator-mini__type">' + esc(c.typeLabel) + "</p>" +
      snsFollowers(c, { compact: true }) +
      "</a>"
    );
  }

  /* ---------- プランカード ---------- */
  function planCard(p) {
    var c = p.creator || {};
    return (
      '<a class="plan-card" href="' + h("plans/show.html?id=" + p.id) + '">' +
      '<div class="plan-card__cover">' + formatBadge(p.format) + "</div>" +
      '<div class="plan-card__body">' +
      '<p class="plan-card__title">' + esc(p.title) + "</p>" +
      '<p class="plan-card__creator">' + avatar(c, "avatar--xs") + esc(c.name) + (c.verified ? verified() : "") + "</p>" +
      '<p class="plan-card__detail">' + icon("clock-hour-4") + " " + esc(formatDetail(p)) + "</p>" +
      '<div class="plan-card__foot">' + priceLabel(p) +
      '<span class="plan-card__rating">' + icon("star-filled") + " " + p.stats.rating + " <small>(" + p.stats.sales + ")</small></span>" +
      "</div></div></a>"
    );
  }

  /* ---------- レビュー項目 ---------- */
  function reviewItem(r) {
    var u = window.DB.users.filter(function (x) { return x.id === r.userId; })[0] || { name: "利用者" };
    return (
      '<div class="review">' +
      '<div class="review__head"><span class="avatar avatar--xs">' + esc(u.name.charAt(0)) + "</span>" +
      "<b>" + esc(u.name) + "</b>" + stars(r.rating) + '<span class="review__date">' + esc(r.date) + "</span></div>" +
      '<p class="review__body">' + esc(r.body) + "</p>" +
      "</div>"
    );
  }

  /* ---------- 数値タイル ---------- */
  function statTile(label, value, unit) {
    return (
      '<div class="stat-tile"><p class="stat-tile__value">' + esc(String(value)) +
      (unit ? '<span class="stat-tile__unit"> ' + esc(unit) + "</span>" : "") + "</p>" +
      '<p class="stat-tile__label">' + esc(label) + "</p></div>"
    );
  }

  /* ---------- 出品者タイプのバッジ(一覧/詳細) ---------- */
  var TYPE = {
    celebrity:  { label: "芸能人・著名人", cls: "type--celebrity" },
    influencer: { label: "インフルエンサー", cls: "type--influencer" },
    pro:        { label: "プロ", cls: "type--pro" },
    general:    { label: "一般", cls: "type--general" }
  };
  function typeBadge(type) {
    var t = TYPE[type] || TYPE.general;
    return '<span class="type-badge ' + t.cls + '">' + esc(t.label) + "</span>";
  }

  /* ---------- ボトムシート ---------- */
  function openSheet(html) {
    closeSheet();
    var ov = document.createElement("div");
    ov.className = "sheet";
    ov.innerHTML = '<div class="sheet__panel">' + html + "</div>";
    ov.addEventListener("click", function (e) { if (e.target === ov) closeSheet(); });
    document.body.appendChild(ov);
    return ov;
  }
  function closeSheet() { var ov = document.querySelector(".sheet"); if (ov) ov.remove(); }

  /* ---------- トースト ---------- */
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  /* ---------- 空状態 ---------- */
  function empty(message, ctaLabel, ctaHref) {
    return (
      '<div class="empty">' + icon("sparkles") + "<p>" + esc(message) + "</p>" +
      (ctaLabel ? '<a class="btn btn--rose" href="' + h(ctaHref) + '">' + esc(ctaLabel) + "</a>" : "") +
      "</div>"
    );
  }

  /* ---------- ドロワーメニュー ---------- */
  function openMenu() {
    if (document.getElementById("menu-drawer")) return;
    var links = [
      ["さがす", "search/index.html"],
      ["メッセージ", "messages/index.html"],
      ["マイページ", "me/index.html"],
      ["出品者ダッシュボード", "dashboard/index.html"],
      ["ELLMIEとは", "about.html"],
      ["出品者ガイド", "guide.html"],
      ["ヘルプ", "help.html"],
      ["ログイン / 新規登録", "login/index.html"]
    ];
    var ov = document.createElement("div");
    ov.id = "menu-drawer";
    ov.className = "drawer";
    ov.innerHTML =
      '<div class="drawer__panel">' +
      '<div class="drawer__head"><span class="drawer__logo">ELLMIE</span>' +
      '<button class="drawer__x" type="button" id="menu-close" aria-label="閉じる">' + icon("x") + "</button></div>" +
      '<nav class="menu-list">' + links.map(function (l) {
        return '<a href="' + h(l[1]) + '">' + esc(l[0]) + icon("chevron-right") + "</a>";
      }).join("") + "</nav>" +
      '<p class="drawer__note">憧れの人と、友達のような距離感で。</p>' +
      "</div>";
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
    ov.querySelector("#menu-close").addEventListener("click", function () { ov.remove(); });
  }

  /* ---------- サイトフッター ---------- */
  function footerCol(title, links) {
    return (
      '<div class="site-footer__col"><p class="site-footer__col-title">' + esc(title) + "</p>" +
      links.map(function (l) { return '<a href="' + h(l[1]) + '">' + esc(l[0]) + "</a>"; }).join("") + "</div>"
    );
  }
  function siteFooter() {
    return (
      '<footer class="site-footer">' +
      '<p class="site-footer__logo">ELLMIE</p>' +
      '<p class="site-footer__tag">憧れの人が、そばに。</p>' +
      '<div class="site-footer__cols">' +
      footerCol("さがす", [["カテゴリから探す", "search/index.html"], ["出品者一覧", "search/index.html?tab=creators"]]) +
      footerCol("使う", [["ログイン / 新規登録", "login/index.html"], ["マイページ", "me/index.html"], ["メッセージ", "messages/index.html"]]) +
      footerCol("出品する", [["出品者ダッシュボード", "dashboard/index.html"], ["出品者ガイド", "guide.html"]]) +
      footerCol("サポート", [["ELLMIEとは", "about.html"], ["ヘルプ", "help.html"], ["利用規約", "terms.html"], ["プライバシー", "privacy.html"], ["特定商取引法に基づく表記", "tokusho.html"]]) +
      "</div>" +
      '<div class="site-footer__sns">' + icon("brand-instagram") + icon("brand-tiktok") + icon("brand-x") + "</div>" +
      '<p class="site-footer__copy">© 2026 ELLMIE</p>' +
      "</footer>"
    );
  }

  return {
    icon: icon, topbar: topbar, tabbar: tabbar,
    formatBadge: formatBadge, priceLabel: priceLabel, formatDetail: formatDetail,
    verified: verified, stars: stars, snsFollowers: snsFollowers, avatar: avatar,
    creatorCard: creatorCard, creatorMini: creatorMini, planCard: planCard,
    reviewItem: reviewItem, statTile: statTile, typeBadge: typeBadge,
    openSheet: openSheet, closeSheet: closeSheet, toast: toast, empty: empty,
    openMenu: openMenu, siteFooter: siteFooter
  };
})();
