/* S11 出品者ダッシュボード（デモ）
   プロトでは出品者 c001(MOEKA) を「あなた」として売上・取引・プラン・宣伝リンク・上限を表示。
   手数料20%(仕様書 8.2)で受取額を算出。将来は自分の出品者アカウントに紐づく。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };
  var FEE = 0.20;  // 販売手数料(税抜20%)

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    if (!api.getSession()) { main.innerHTML = UI.empty("ログインすると出品者ダッシュボードが使えます。", "ログイン", "login/index.html"); return; }
    // サンプル実績は注目トップ出品者を動的に取得（固定IDに依存しない）
    api.getFeaturedCreators(1).then(function (top) {
      return Promise.all([top[0] ? api.getCreator(top[0].id) : Promise.resolve(null), api.getMyPlans(), api.getMySeller()]);
    }).then(function (res) {
      var sample = res[0] || { plans: [], stats: { rating: 0 }, name: "", handle: "creator" }, myPlans = res[1] || [], mySeller = res[2];
      if (!mySeller) { main.innerHTML = notSellerYet() + UI.siteFooter(); return; }
      main.innerHTML =
        head(mySeller) +
        cards(mySeller) +
        limitBox() +
        myPlansSection(myPlans, mySeller) +
        sampleSection(sample) +
        promoSection(mySeller) +
        UI.siteFooter();
      bind(mySeller);
    });
  });

  /* 自分の出品プラン(S12で作成したもの) */
  function myPlansSection(myPlans, mySeller) {
    var inner = myPlans.length
      ? '<div class="plan-list">' + myPlans.map(UI.planCard).join("") + "</div>"
      : '<p class="lead">まだ出品プランがありません。最初のプランを作ってみましょう。</p>';
    return (
      '<div class="section">' +
      '<p class="section__title">あなたの出品プラン' +
      '<a class="more" href="' + h("plans/new.html") + '">＋ 新規出品</a></p>' +
      (mySeller ? '<div class="dash-limit" style="background:var(--cream);color:var(--ink-soft);">' + UI.icon("user") +
        " 出品者プロフィール：" + esc(mySeller.name) +
        ' <button class="btn btn--sm btn--outline" id="edit-seller" style="margin-left:8px;">編集</button></div>' : "") +
      inner + "</div>"
    );
  }

  /* まだ出品者プロフィールが無い場合の入口 */
  function notSellerYet() {
    return (
      '<div class="section" style="padding-top:28px;text-align:center;">' +
      '<div class="onb-done__badge" style="margin:8px auto 16px;">' + UI.icon("sparkles") + "</div>" +
      '<p class="onb-h" style="text-align:center;">まだ出品者ではありません</p>' +
      '<p class="lead" style="margin-bottom:18px;">プロフィールと最初のプランを作れば、今日から出品できます。登録は無料、手数料は売れた時だけ。</p>' +
      '<a class="btn btn--rose btn--block" href="' + h("sell/index.html") + '">出品者になる（無料）</a>' +
      "</div>"
    );
  }

  function head(seller) {
    return (
      '<div class="dash-head">' +
      '<p class="dash-head__label">' + UI.icon("sparkles") + " 出品者ダッシュボード</p>" +
      '<p class="dash-sales">' + App.money(0) + "<small>" + esc(seller.name) + "さんの今月の受取見込み</small></p>" +
      '<p class="dash-head__label" style="margin-top:6px;">売上が発生すると、手数料20%を引いた受取額がここに表示されます。</p>' +
      "</div>"
    );
  }

  function cards(seller) {
    var rating = seller.stats && seller.stats.rating ? seller.stats.rating : "—";
    return (
      '<div class="dash-cards">' +
      card(App.money(0), "確定待ち(エスクロー)") +
      card("0", "取引中") +
      card("0", "未返信メッセージ") +
      card(rating, "平均評価") +
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

  function sampleSection(c) {
    if (!c.plans || !c.plans.length) return "";
    return (
      '<div class="section hr">' +
      '<p class="section__title">参考：人気出品者の実績' + (c.name ? "（" + esc(c.name) + "さん）" : "") + "</p>" +
      '<p class="lead" style="margin-bottom:10px;">売れている出品者のプランと数字です。あなたのプラン作りの参考に。</p>' +
      '<div class="plan-list">' + c.plans.map(function (p) {
        return '<div style="position:relative;">' + UI.planCard(p) +
          '<p class="field-note" style="padding:0 4px 8px;">閲覧 ' + (p.stats.sales * 6) + " ・ 購入 " + p.stats.sales + "</p></div>";
      }).join("") + "</div></div>"
    );
  }

  function promoSection(seller) {
    var url = "https://ellmie.com/@" + (seller.handle || "you");
    return (
      '<div class="section hr">' +
      '<p class="section__title">宣伝リンク</p>' +
      '<p class="lead" style="margin-bottom:10px;">SNSのプロフィールやストーリーズに貼って、ファンを呼び込みましょう。経由の流入・購入を計測できます。</p>' +
      '<div class="search-bar" style="background:var(--cream);"><span class="muted" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(url) + "</span>" +
      '<button class="btn btn--sm btn--rose" id="copy">コピー</button></div>' +
      '<div class="stat-row" style="margin-top:14px;">' +
      UI.statTile("今月の流入", "0", "") + UI.statTile("経由購入", "0", "件") + UI.statTile("転換率", "—", "") +
      "</div></div>"
    );
  }

  function bind(mySeller) {
    var copy = document.getElementById("copy");
    if (copy) copy.addEventListener("click", function () { UI.toast("宣伝リンクをコピーしました"); });
    var lm = document.getElementById("limit");
    if (lm) lm.addEventListener("click", function () { UI.toast("本人確認(eKYC)へ進みます（デモ）"); });
    var es = document.getElementById("edit-seller");
    if (es) es.addEventListener("click", function () { openSellerEdit(mySeller); });
  }

  /* S15 出品者プロフィール編集 */
  function openSellerEdit(seller) {
    seller = seller || {};
    var cats = TAX.categories.map(function (c) {
      var on = (seller.categories || []).indexOf(c.slug) !== -1 ? " is-on" : "";
      return '<button type="button" class="pill' + on + '" data-cat="' + c.slug + '">' + esc(c.label) + "</button>";
    }).join("");
    var s = seller.sns || {};
    var ov = UI.openSheet(
      '<p class="sheet__q">出品者プロフィール編集</p>' +
      '<div class="form-row"><label class="field-label">表示名</label><input class="field" id="s-name" value="' + esc(seller.name || "") + '"></div>' +
      '<div class="form-row"><label class="field-label">ひとこと</label><input class="field" id="s-tag" value="' + esc(seller.tagline || "") + '" placeholder="例）垢抜けメイクの伝道師"></div>' +
      '<div class="form-row"><label class="field-label">自己紹介・経歴</label><textarea class="field field--area" id="s-bio">' + esc(seller.bio || "") + "</textarea></div>" +
      '<div class="form-row"><label class="field-label">カテゴリ（最大3）</label><div class="tag-cloud" id="s-cats">' + cats + "</div></div>" +
      '<div class="form-row"><label class="field-label">SNS連携（フォロワー数）</label>' +
      '<input class="field" id="s-ig" type="number" inputmode="numeric" placeholder="Instagram フォロワー数" value="' + (s.instagram || "") + '" style="margin-bottom:8px;">' +
      '<input class="field" id="s-tt" type="number" inputmode="numeric" placeholder="TikTok フォロワー数" value="' + (s.tiktok || "") + '">' +
      '<p class="field-note">実装では各SNSのOAuth連携で自動取得し、認証バッジを付与します。</p></div>' +
      '<button class="btn btn--rose btn--block" id="s-save">保存する</button>'
    );
    ov.querySelectorAll("[data-cat]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!b.classList.contains("is-on") && ov.querySelectorAll("[data-cat].is-on").length >= 3) { UI.toast("カテゴリは最大3つまでです"); return; }
        b.classList.toggle("is-on");
      });
    });
    ov.querySelector("#s-save").addEventListener("click", function () {
      var sns = {};
      var ig = Number(ov.querySelector("#s-ig").value); if (ig) sns.instagram = ig;
      var tt = Number(ov.querySelector("#s-tt").value); if (tt) sns.tiktok = tt;
      api.setMySeller({
        name: ov.querySelector("#s-name").value.trim() || "あなた",
        tagline: ov.querySelector("#s-tag").value.trim(),
        bio: ov.querySelector("#s-bio").value.trim(),
        categories: Array.prototype.map.call(ov.querySelectorAll("[data-cat].is-on"), function (b) { return b.dataset.cat; }),
        sns: sns
      }).then(function () {
        UI.closeSheet(); UI.toast("保存しました");
        setTimeout(function () { location.reload(); }, 400);
      });
    });
  }
})();
