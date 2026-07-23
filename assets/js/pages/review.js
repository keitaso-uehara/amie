/* S9 レビュー投稿
   ?order= の完了取引にレビュー。星(必須)＋コメント(任意)。1取引1回・投稿後編集不可。
   クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };
  var rating = 0;

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    if (!api.getSession()) { App.goto("login/index.html"); return; }
    var orderId = App.qs("order");
    api.getOrder(orderId).then(function (o) {
      if (!o) { main.innerHTML = UI.empty("取引が見つかりませんでした。", "マイページへ", "me/index.html"); return; }
      if (!api.canReview(orderId)) { main.innerHTML = done(o); return; }
      var c = o.creator || {};
      main.innerHTML =
        '<div class="section">' +
        '<p class="section__title">レビューを書く</p>' +
        '<div class="creator-inline" style="margin-top:0;">' + UI.avatar(c, "avatar--lg") +
        '<div class="creator-inline__body"><p class="creator-inline__name">' + esc(c.name) + (c.verified ? UI.verified() : "") + "</p>" +
        '<p class="creator-inline__type">' + esc(o.plan ? o.plan.title : "") + "</p></div></div>" +

        '<div class="form-row"><label class="field-label">評価</label>' +
        '<div class="star-input" id="stars">' + [1,2,3,4,5].map(function (i) {
          return '<button type="button" data-v="' + i + '" aria-label="' + i + '">' + UI.icon("star") + "</button>";
        }).join("") + "</div></div>" +

        '<div class="form-row"><label class="field-label">コメント（任意・500字）</label>' +
        '<textarea class="field field--area" id="body" maxlength="500" placeholder="どんなところが良かったですか？"></textarea></div>' +

        '<p class="field-note" style="margin-bottom:14px;">※ 投稿後の編集はできません。公開されます。</p>' +
        '<button class="btn btn--rose btn--block" id="submit" disabled>投稿する</button>' +
        "</div>";
      bind(o);
    });
  });

  function bind(o) {
    var box = document.getElementById("stars");
    var submit = document.getElementById("submit");
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-v]"); if (!b) return;
      rating = Number(b.dataset.v);
      Array.prototype.forEach.call(box.querySelectorAll("button"), function (btn, i) {
        btn.querySelector("i").className = "ti ti-" + (i < rating ? "star-filled" : "star");
        btn.classList.toggle("is-on", i < rating);
      });
      submit.disabled = rating === 0;
    });
    submit.addEventListener("click", function () {
      if (!rating) return;
      var body = document.getElementById("body").value.trim();
      api.postReview(o.id, o.planId, rating, body).then(function () {
        UI.toast("レビューを投稿しました");
        setTimeout(function () { App.goto("plans/show.html?id=" + o.planId); }, 600);
      });
    });
  }

  function done(o) {
    return '<div class="done"><div class="done__icon">' + UI.icon("circle-check-filled") + "</div>" +
      '<p class="done__title">レビュー投稿済み</p>' +
      '<p class="lead">この取引のレビューは投稿済みです。</p>' +
      '<div class="stack" style="margin-top:24px;"><a class="btn btn--rose btn--block" href="' + h("plans/show.html?id=" + o.planId) + '">プランを見る</a></div></div>';
  }
})();
