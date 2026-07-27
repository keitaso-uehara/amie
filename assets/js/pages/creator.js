/* S3 出品者詳細（サービスの顔）
   ?id= の出品者を表示。SNSフォロワー数・認証・実績・プラン・集約レビュー。
   クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    var id = App.qs("id");
    api.getCreator(id).then(function (c) {
      if (!c) { main.innerHTML = UI.empty("出品者が見つかりませんでした。", "さがすへ", "search/index.html"); return; }
      document.title = c.name + " | ELLMIE";
      main.innerHTML =
        hero(c) +
        plansSection(c) +
        reviewsSection(c) +
        UI.siteFooter();
      bind(c);
    });
  });

  function hero(c) {
    var concerns = (c.concerns || []).map(function (slug) {
      var t = TAX.concerns.filter(function (x) { return x.slug === slug; })[0];
      return t ? '<a class="pill pill--rose" href="' + h("search/index.html?concern=" + slug) + '">#' + esc(t.label) + "</a>" : "";
    }).join("");
    return (
      '<div class="creator-hero">' +
      '<div class="creator-hero__cover"></div>' +
      '<div class="creator-hero__body">' +
      UI.avatar(c, "avatar--lg creator-hero__avatar") +
      '<p class="creator-hero__name">' + esc(c.name) + (c.verified ? UI.verified() : "") + "</p>" +
      '<p class="creator-hero__handle">@' + esc(c.handle) + "</p>" +
      '<div class="creator-hero__row">' + UI.typeBadge(c.type) + '<span class="muted">' + esc(c.typeLabel) + "</span></div>" +
      UI.snsFollowers(c) +
      followBtn(c) +
      '<p class="creator-hero__bio">' + esc(c.bio) + "</p>" +
      (concerns ? '<div class="tag-cloud" style="margin-top:12px;">' + concerns + "</div>" : "") +
      '<div class="creator-stats">' +
      UI.statTile("取引", c.stats.sales, "件") +
      UI.statTile("評価", c.stats.rating, "") +
      UI.statTile("リピート", c.stats.repeat, "%") +
      "</div>" +
      '<div class="creator-hero__mod">' +
      '<button class="report-link" id="report" type="button">' + UI.icon("flag") + " 通報する</button>" +
      '<button class="report-link" id="block" type="button">' + UI.icon("ban") + " " + (api.isBlocked(c.id) ? "ブロック解除" : "ブロックする") + "</button>" +
      "</div>" +
      "</div></div>"
    );
  }

  function followBtn(c) {
    var on = api.isFollowing(c.id);
    return '<button class="btn btn--sm creator-follow ' + (on ? "btn--outline" : "btn--rose") + '" id="follow">' +
      (on ? UI.icon("check") + " フォロー中" : UI.icon("plus") + " フォロー") + "</button>";
  }

  function plansSection(c) {
    return (
      '<div class="section hr">' +
      '<p class="section__title">' + esc(c.name) + "さんのプラン</p>" +
      '<div class="plan-list">' + c.plans.map(UI.planCard).join("") + "</div></div>"
    );
  }

  function reviewsSection(c) {
    if (!c.reviews.length) return "";
    return (
      '<div class="section hr">' +
      '<p class="section__title">レビュー <span class="muted" style="font-weight:500;font-size:13px;">' + c.reviews.length + "件</span></p>" +
      c.reviews.map(UI.reviewItem).join("") +
      "</div>"
    );
  }

  function bind(c) {
    var f = document.getElementById("follow");
    if (f) f.addEventListener("click", function () {
      api.toggleFollow(c.id).then(function (on) {
        f.className = "btn btn--sm creator-follow " + (on ? "btn--outline" : "btn--rose");
        f.innerHTML = on ? UI.icon("check") + " フォロー中" : UI.icon("plus") + " フォロー";
        UI.toast(on ? "フォローしました。新着やお知らせが届きます" : "フォローを解除しました");
      });
    });
    var r = document.getElementById("report");
    if (r) r.addEventListener("click", function () {
      var ov = UI.openSheet(
        '<p class="sheet__q">通報する</p>' +
        '<p class="lead" style="margin-bottom:12px;">ガイドライン違反（外部誘導・勧誘・不適切な言動など）にお気づきの点があればお知らせください。運営で確認します。</p>' +
        '<textarea class="field field--area" id="rp-body" placeholder="内容をご記入ください"></textarea>' +
        '<button class="btn btn--rose btn--block" id="rp-send" style="margin-top:14px;">送信する</button>'
      );
      ov.querySelector("#rp-send").addEventListener("click", function () {
        var body = ov.querySelector("#rp-body").value.trim();
        api.report({ target: "出品者 / " + c.name, reason: body || "（詳細なし）" }).then(function () {
          UI.closeSheet();
          UI.toast("通報を受け付けました。ご協力ありがとうございます");
        });
      });
    });
    var bl = document.getElementById("block");
    if (bl) bl.addEventListener("click", function () {
      api.toggleBlock(c.id).then(function (on) {
        UI.toast(on ? "ブロックしました。検索や一覧に表示されなくなります" : "ブロックを解除しました");
        bl.innerHTML = UI.icon("ban") + " " + (on ? "ブロック解除" : "ブロックする");
      });
    });
  }
})();
