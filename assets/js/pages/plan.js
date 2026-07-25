/* S4 プラン詳細
   ?id= のプランを表示。形式別スペック・出品者・レビュー・下部購入バー。
   診断系カテゴリには医療行為ではない旨の免責を自動表示(仕様書 S4)。
   クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  /* 免責を自動付与するカテゴリ(診断・ボディ系) */
  var DISCLAIM = { personalcolor: 1, diet: 1, skincare: 1 };

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    var id = App.qs("id");
    api.getPlan(id).then(function (p) {
      if (!p) { main.innerHTML = UI.empty("プランが見つかりませんでした。", "さがすへ", "search/index.html"); return; }
      document.title = p.title + " | ELLMIE";
      main.innerHTML = view(p) + UI.siteFooter();
      mountBuybar(p);
    });
  });

  function view(p) {
    var c = p.creator || {};
    return (
      '<div class="plan-hero__cover">' + UI.formatBadge(p.format) + "</div>" +
      '<div class="plan-detail">' +
      '<p class="plan-detail__title">' + esc(p.title) + "</p>" +
      '<div class="plan-detail__meta">' +
      "<span>" + UI.icon("star-filled") + " <b>" + p.stats.rating + "</b> (" + p.stats.sales + "件)</span>" +
      "<span>" + UI.icon("clock-hour-4") + " " + esc(UI.formatDetail(p)) + "</span>" +
      "</div>" +

      /* 出品者インライン */
      '<a class="creator-inline" href="' + h("creators/show.html?id=" + c.id) + '">' +
      UI.avatar(c, "avatar--lg") +
      '<div class="creator-inline__body">' +
      '<p class="creator-inline__name">' + esc(c.name) + (c.verified ? UI.verified() : "") + "</p>" +
      '<p class="creator-inline__type">' + esc(c.typeLabel) + "</p>" +
      UI.snsFollowers(c, { compact: true }) +
      "</div>" + UI.icon("chevron-right") +
      "</a>" +

      /* スペック表 */
      specList(p) +

      '<p class="plan-desc">' + esc(p.desc) + "</p>" +

      (DISCLAIM[p.category]
        ? '<div class="notice-box">' + UI.icon("info-circle") + " 本プランは美容・ライフスタイル上のアドバイスであり、医療行為・医学的診断ではありません。体調やお肌のトラブルは医療機関にご相談ください。</div>"
        : "") +

      /* キャンセルポリシー */
      '<div class="notice-box" style="background:var(--cream);color:var(--ink-soft);">' + UI.icon("shield-check") +
      " " + cancelPolicy(p) + "</div>" +

      reviews(p) +
      "</div>"
    );
  }

  function specList(p) {
    var rows = [];
    rows.push(row("形式", formatName(p.format)));
    if (p.format === "chat") rows.push(row("相談期間", p.chatDays + "日間 チャットし放題"));
    if (p.format === "video") rows.push(row("ビデオ通話", p.minutes + "分（予約制）"));
    if (p.format === "monthly") {
      rows.push(row("チャット", p.chatIncluded ? "相談し放題" : "なし"));
      rows.push(row("ビデオ通話", p.monthlyVideos > 0 ? "月" + p.monthlyVideos + "回" : "なし"));
      rows.push(row("契約", "いつでも解約可（現期間末まで有効）"));
    }
    var cat = TAX.categories.filter(function (x) { return x.slug === p.category; })[0];
    if (cat) rows.push(row("カテゴリ", cat.label));
    rows.push(row("料金", App.money(p.price) + (p.format === "monthly" ? " / 月（税込）" : "（税込）")));
    return '<div class="spec-list">' + rows.join("") + "</div>";
  }
  function row(k, v) { return '<div class="spec-row"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + "</span></div>"; }
  function formatName(f) { return f === "chat" ? "チャット単発" : f === "video" ? "単発ビデオレッスン" : "月額メンター"; }

  function cancelPolicy(p) {
    if (p.format === "video") return "ビデオは開始24時間前まで無料でキャンセル・日時変更（1回まで）が可能です。";
    if (p.format === "monthly") return "いつでも解約できます。解約後も現在の請求期間の終わりまでご利用いただけます。";
    return "出品者が48時間以内に一度も応答しない場合、全額返金を申請できます。";
  }

  function reviews(p) {
    if (!p.reviews.length) return "";
    return (
      '<div style="margin-top:24px;">' +
      '<p class="section__title" style="margin-bottom:8px;">このプランのレビュー</p>' +
      p.reviews.map(UI.reviewItem).join("") +
      "</div>"
    );
  }

  /* 下部固定の購入バー */
  function mountBuybar(p) {
    var fav = api.isFavorite("plan", p.id);
    var bar = document.createElement("div");
    bar.className = "buybar";
    bar.innerHTML =
      '<button class="buybar__fav' + (fav ? " is-on" : "") + '" id="fav" aria-label="お気に入り">' +
      UI.icon(fav ? "heart-filled" : "heart") + "</button>" +
      '<div class="buybar__price"><small>' + (p.format === "monthly" ? "月額" : "料金") + '</small>' +
      '<span class="price">' + App.money(p.price) + (p.format === "monthly" ? '<small> /月</small>' : "") + "</span></div>" +
      '<button class="btn btn--rose" id="buy">' + (p.format === "monthly" ? "申し込む" : "購入する") + "</button>";
    document.querySelector(".app").appendChild(bar);

    bar.querySelector("#fav").addEventListener("click", function () {
      var btn = this;
      api.toggleFavorite("plan", p.id).then(function (on) {
        btn.classList.toggle("is-on", on);
        btn.innerHTML = UI.icon(on ? "heart-filled" : "heart");
        UI.toast(on ? "お気に入りに追加しました" : "お気に入りから外しました");
      });
    });

    bar.querySelector("#buy").addEventListener("click", function () {
      if (!api.getSession()) { App.goto("login/index.html?next=" + encodeURIComponent("plans/show.html?id=" + p.id)); return; }
      App.goto("checkout/index.html?plan=" + p.id);
    });
  }
})();
