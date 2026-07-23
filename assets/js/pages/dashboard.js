/* S11 出品者ダッシュボード（デモ）
   プロトでは出品者 c001(MOEKA) を「あなた」として売上・取引・プラン・宣伝リンク・上限を表示。
   手数料20%(仕様書 8.2)で受取額を算出。将来は自分の出品者アカウントに紐づく。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };
  var FEE = 0.20;  // 販売手数料(税抜20%)

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    api.getCreator("c001").then(function (c) {
      // デモ用の当月売上(プラン価格×直近販売の想定)
      var gross = 184000, pending = 46000;
      var net = Math.round(gross * (1 - FEE));
      main.innerHTML =
        head(gross, net) +
        cards(pending, c) +
        limitBox() +
        plansSection(c) +
        promoSection(c) +
        UI.siteFooter();
      bind();
    });
  });

  function head(gross, net) {
    return (
      '<div class="dash-head">' +
      '<p class="dash-head__label">' + UI.icon("sparkles") + " 出品者ダッシュボード（デモ）</p>" +
      '<p class="dash-sales">' + App.money(net) + "<small>今月の受取見込み</small></p>" +
      '<p class="dash-head__label" style="margin-top:6px;">売上 ' + App.money(gross) + " － 手数料20% ＝ 受取 " + App.money(net) + "</p>" +
      "</div>"
    );
  }

  function cards(pending, c) {
    return (
      '<div class="dash-cards">' +
      card(App.money(pending), "確定待ち(エスクロー)") +
      card("3", "取引中") +
      card("2", "未返信メッセージ") +
      card(c.stats.rating, "平均評価") +
      "</div>"
    );
  }
  function card(v, l) { return '<div class="dash-card"><p class="dash-card__v">' + esc(String(v)) + '</p><p class="dash-card__l">' + esc(l) + "</p></div>"; }

  function limitBox() {
    return (
      '<div class="dash-limit">' + UI.icon("shield-check") +
      " 現在の価格上限：<b>10万円</b>（本人確認と取引実績で解除できます）" +
      '<button class="btn btn--sm btn--gold" id="limit" style="margin-top:10px;">上限解除を申請する</button></div>'
    );
  }

  function plansSection(c) {
    return (
      '<div class="section">' +
      '<p class="section__title">プラン管理' +
      '<button class="more" id="new-plan">＋ 新規出品</button></p>' +
      '<div class="plan-list">' + c.plans.map(function (p) {
        return '<div style="position:relative;">' + UI.planCard(p) +
          '<p class="field-note" style="padding:0 4px 8px;">閲覧 ' + (p.stats.sales * 6) + " ・ 購入 " + p.stats.sales + "</p></div>";
      }).join("") + "</div></div>"
    );
  }

  function promoSection(c) {
    var url = "https://amie.app/@" + c.handle;
    return (
      '<div class="section hr">' +
      '<p class="section__title">宣伝リンク</p>' +
      '<p class="lead" style="margin-bottom:10px;">SNSのプロフィールやストーリーズに貼って、ファンを呼び込みましょう。経由の流入・購入を計測できます。</p>' +
      '<div class="search-bar" style="background:var(--cream);"><span class="muted" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(url) + "</span>" +
      '<button class="btn btn--sm btn--rose" id="copy">コピー</button></div>' +
      '<div class="stat-row" style="margin-top:14px;">' +
      UI.statTile("今月の流入", "1,240", "") + UI.statTile("経由購入", "38", "件") + UI.statTile("転換率", "3.1", "%") +
      "</div></div>"
    );
  }

  function bind() {
    var copy = document.getElementById("copy");
    if (copy) copy.addEventListener("click", function () { UI.toast("宣伝リンクをコピーしました"); });
    var np = document.getElementById("new-plan");
    if (np) np.addEventListener("click", function () { UI.toast("プラン作成はデモでは準備中です"); });
    var lm = document.getElementById("limit");
    if (lm) lm.addEventListener("click", function () { UI.toast("本人確認(eKYC)へ進みます（デモ）"); });
  }
})();
