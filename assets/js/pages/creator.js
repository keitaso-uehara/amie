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
      '<p class="creator-hero__bio">' + esc(c.bio) + "</p>" +
      (concerns ? '<div class="tag-cloud" style="margin-top:12px;">' + concerns + "</div>" : "") +
      '<div class="creator-stats">' +
      UI.statTile("取引", c.stats.sales, "件") +
      UI.statTile("評価", c.stats.rating, "") +
      UI.statTile("リピート", c.stats.repeat, "%") +
      "</div>" +
      '<button class="report-link" id="report" type="button">' + UI.icon("flag") + " この出品者を通報する</button>" +
      "</div></div>"
    );
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
    var r = document.getElementById("report");
    if (r) r.addEventListener("click", function () {
      var ov = UI.openSheet(
        '<p class="sheet__q">通報する</p>' +
        '<p class="lead" style="margin-bottom:12px;">ガイドライン違反（外部誘導・勧誘・不適切な言動など）にお気づきの点があればお知らせください。運営で確認します。</p>' +
        '<textarea class="field field--area" id="rp-body" placeholder="内容をご記入ください"></textarea>' +
        '<button class="btn btn--rose btn--block" id="rp-send" style="margin-top:14px;">送信する</button>'
      );
      ov.querySelector("#rp-send").addEventListener("click", function () {
        UI.closeSheet();
        UI.toast("通報を受け付けました。ご協力ありがとうございます");
      });
    });
  }
})();
