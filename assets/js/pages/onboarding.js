/* 出品者オンボーディング（3ステップ）: プロフィール → 最初のプラン → 完了
   参考: ココナラ/MENTA の「無料で始められ、売れた時だけ手数料」型。
   誰でも簡単・審査を待たずに公開。本人確認は出金時のみ。
   クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };
  var MIN = 1000, CAP = 100000;   // 4.5 価格ルール

  var step = 1;
  var createdPlan = null;
  var draft = {
    name: "", tagline: "", bio: "", categories: [], sns: {},
    format: "chat", title: "", category: "", price: "", desc: ""
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (!api.getSession()) {
      App.goto("login/index.html?next=" + encodeURIComponent("sell/index.html"));
      return;
    }
    Promise.all([api.getMySeller(), api.getMyPlans()]).then(function (res) {
      var seller = res[0], myPlans = res[1] || [];
      if (seller && myPlans.length) { App.goto("dashboard/index.html"); return; }  // オンボ済み
      if (seller) {  // プロフィールだけ済み → 引き継ぐ
        draft.name = seller.name || "";
        draft.tagline = seller.tagline || "";
        draft.bio = seller.bio || "";
        draft.categories = (seller.categories || []).slice(0, 3);
        draft.sns = seller.sns || {};
      }
      render();
    });
  });

  function render() {
    var main = document.getElementById("main");
    main.innerHTML = stepsBar() + (step === 1 ? step1() : step === 2 ? step2() : step3());
    window.scrollTo(0, 0);
    if (step === 1) bind1();
    else if (step === 2) bind2();
  }

  /* 進捗インジケータ */
  function stepsBar() {
    var labels = ["プロフィール", "最初のプラン", "完了"];
    var out = "";
    for (var i = 0; i < labels.length; i++) {
      var n = i + 1;
      if (i) out += '<span class="onb-steps__bar' + (n <= step ? " is-done" : "") + '"></span>';
      var cls = n < step ? " is-done" : n === step ? " is-on" : "";
      out += '<span class="onb-steps__item' + cls + '"><span class="onb-steps__dot">' +
        (n < step ? UI.icon("check") : n) + '</span><span class="onb-steps__label">' + esc(labels[i]) + "</span></span>";
    }
    return '<div class="onb-steps">' + out + "</div>";
  }

  /* ===== STEP 1 プロフィール ===== */
  function step1() {
    var cats = TAX.categories.map(function (c) {
      var on = draft.categories.indexOf(c.slug) !== -1 ? " is-on" : "";
      return '<button type="button" class="pill' + on + '" data-cat="' + c.slug + '">' + esc(c.label) + "</button>";
    }).join("");
    var s = draft.sns || {};
    return (
      '<div class="section onb">' +
      '<div class="onb-hero">' +
      '<p class="onb-hero__title">あなたの「好き」を、収入に。</p>' +
      '<p class="onb-hero__sub">憧れられる側へ。ELLMIEは審査を待たず、今すぐ始められます。</p>' +
      '<div class="onb-values">' +
      onbValue("gift", "登録は無料") +
      onbValue("percentage", "手数料は売れた時だけ") +
      onbValue("bolt", "今すぐ公開・審査待ちなし") +
      "</div></div>" +

      '<p class="onb-h">まず、あなたのことを教えてください</p>' +

      '<div class="form-row"><label class="field-label">表示名 <span class="req">必須</span></label>' +
      '<input class="field" id="o-name" maxlength="30" placeholder="例）MOEKA" value="' + esc(draft.name) + '"></div>' +

      '<div class="form-row"><label class="field-label">ひとこと肩書き</label>' +
      '<input class="field" id="o-tag" maxlength="30" placeholder="例）垢抜けメイクの伝道師" value="' + esc(draft.tagline) + '"></div>' +

      '<div class="form-row"><label class="field-label">自己紹介・経歴</label>' +
      '<textarea class="field field--area" id="o-bio" maxlength="600" placeholder="どんな人に・何を・どうしてあげられるか。経歴や実績があると選ばれやすくなります。">' + esc(draft.bio) + "</textarea></div>" +

      '<div class="form-row"><label class="field-label">得意なカテゴリ <span class="muted">（最大3つ）</span></label>' +
      '<div class="tag-cloud" id="o-cats">' + cats + "</div></div>" +

      '<div class="form-row"><label class="field-label">SNS <span class="muted">（任意・連携で認証バッジ）</span></label>' +
      '<div class="onb-sns">' + UI.icon("brand-instagram") + '<input class="field" id="o-ig" type="number" inputmode="numeric" placeholder="Instagram フォロワー数" value="' + (s.instagram || "") + '"></div>' +
      '<div class="onb-sns">' + UI.icon("brand-tiktok") + '<input class="field" id="o-tt" type="number" inputmode="numeric" placeholder="TikTok フォロワー数" value="' + (s.tiktok || "") + '"></div>' +
      '<p class="field-note">入力したフォロワー数はプロフィールに表示されます。SNS連携で認証バッジを取得できます。</p></div>' +

      '<button class="btn btn--rose btn--block" id="o-next">次へ（最初のプランをつくる）</button>' +
      '<p class="onb-foot">' + UI.icon("shield-check") + " 本人確認が必要なのは、売上を出金するときだけです。</p>" +
      "</div>"
    );
  }
  function onbValue(ic, t) { return '<span class="onb-value">' + UI.icon(ic) + "<span>" + esc(t) + "</span></span>"; }

  function bind1() {
    var cats = document.getElementById("o-cats");
    cats.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat]"); if (!b) return;
      if (!b.classList.contains("is-on") && cats.querySelectorAll(".is-on").length >= 3) {
        UI.toast("カテゴリは最大3つまでです"); return;
      }
      b.classList.toggle("is-on");
    });
    document.getElementById("o-next").addEventListener("click", function () {
      var name = document.getElementById("o-name").value.trim();
      if (!name) return UI.toast("表示名を入力してください");
      draft.name = name;
      draft.tagline = document.getElementById("o-tag").value.trim();
      draft.bio = document.getElementById("o-bio").value.trim();
      draft.categories = Array.prototype.map.call(cats.querySelectorAll("[data-cat].is-on"), function (b) { return b.dataset.cat; });
      var sns = {};
      var ig = Number(document.getElementById("o-ig").value); if (ig) sns.instagram = ig;
      var tt = Number(document.getElementById("o-tt").value); if (tt) sns.tiktok = tt;
      draft.sns = sns;
      api.setMySeller({ name: draft.name, tagline: draft.tagline, bio: draft.bio, categories: draft.categories, sns: draft.sns })
        .then(function () { step = 2; render(); });
    });
  }

  /* ===== STEP 2 最初のプラン ===== */
  function step2() {
    var pick = draft.category || draft.categories[0];
    var cats = TAX.categories.map(function (c) {
      return '<option value="' + c.slug + '"' + (pick === c.slug ? " selected" : "") + ">" + esc(c.label) + "</option>";
    }).join("");
    return (
      '<div class="section onb">' +
      '<p class="onb-h">最初のプランをつくりましょう</p>' +
      '<p class="lead" style="margin-bottom:14px;">あとから何個でも追加・編集できます。まずは気軽に1つ。</p>' +

      '<div class="form-row"><label class="field-label">提供形式</label>' +
      '<div class="seg" id="o-fmt">' + seg("chat", "チャット単発") + seg("video", "単発ビデオ") + seg("monthly", "月額メンター") + "</div></div>" +

      '<div class="form-row"><label class="field-label">プラン名 <span class="req">必須</span></label>' +
      '<input class="field" id="o-title" maxlength="60" placeholder="例）あなた専用・垢抜けメイクレッスン" value="' + esc(draft.title) + '"></div>' +

      '<div class="form-row"><label class="field-label">カテゴリ</label><select class="field" id="o-cat">' + cats + "</select></div>" +

      '<div class="form-row" id="o-fmt-fields"></div>' +

      '<div class="form-row"><label class="field-label">料金（税込） <span class="req">必須</span></label>' +
      '<input class="field" id="o-price" type="number" inputmode="numeric" min="1000" placeholder="3000" value="' + esc(String(draft.price)) + '">' +
      '<p class="field-note">最低1,000円・上限10万円（本人確認と実績で解除）。月額は1ヶ月あたり。売れた時だけ20%の手数料。</p></div>' +

      '<div class="form-row"><label class="field-label">内容説明 <span class="req">必須</span></label>' +
      '<textarea class="field field--area" id="o-desc" maxlength="2000" placeholder="こんな人におすすめ / 進め方 / 注意事項">' + esc(draft.desc) + "</textarea></div>" +

      '<div class="notice-box">' + UI.icon("info-circle") +
      " 公開後は運営が内容を確認します（事後パトロール）。" + '<a href="' + h("guide.html") + '">出品者ガイド</a>もご確認ください。</div>' +

      '<button class="btn btn--rose btn--block" id="o-publish">公開する</button>' +
      '<button class="btn btn--ghost btn--block" id="o-back" style="margin-top:10px;">戻る</button>' +
      "</div>"
    );
  }
  function seg(v, label) { return '<button type="button" class="seg__item' + (v === draft.format ? " is-on" : "") + '" data-fmt="' + v + '">' + esc(label) + "</button>"; }
  function fmtFields() {
    if (draft.format === "chat")
      return '<label class="field-label">相談期間</label><select class="field" id="o-chatDays"><option value="3">3日間</option><option value="7" selected>7日間</option><option value="14">14日間</option></select>';
    if (draft.format === "video")
      return '<label class="field-label">ビデオ通話の長さ</label><select class="field" id="o-minutes"><option value="30">30分</option><option value="60" selected>60分</option><option value="90">90分</option></select>';
    return '<label class="field-label">月のビデオ回数</label><select class="field" id="o-monthlyVideos"><option value="0">0回（チャットのみ）</option><option value="1">月1回</option><option value="2" selected>月2回</option><option value="4">月4回</option></select>';
  }

  function bind2() {
    document.getElementById("o-fmt-fields").innerHTML = fmtFields();
    document.getElementById("o-fmt").addEventListener("click", function (e) {
      var b = e.target.closest("[data-fmt]"); if (!b) return;
      draft.format = b.dataset.fmt;
      document.querySelectorAll("#o-fmt .seg__item").forEach(function (x) { x.classList.toggle("is-on", x.dataset.fmt === draft.format); });
      document.getElementById("o-fmt-fields").innerHTML = fmtFields();
    });
    document.getElementById("o-back").addEventListener("click", function () { capture(); step = 1; render(); });
    document.getElementById("o-publish").addEventListener("click", function () {
      capture();
      if (!draft.title) return UI.toast("プラン名を入力してください");
      if (!draft.desc) return UI.toast("内容説明を入力してください");
      var price = Number(draft.price);
      if (!price || price < MIN) return UI.toast("料金は" + App.money(MIN) + "以上で設定してください");
      if (price > CAP) return UI.toast("新規出品者の上限は" + App.money(CAP) + "です（解除は申請制）");
      var data = { title: draft.title, format: draft.format, price: price, desc: draft.desc, category: draft.category };
      var f;
      if (draft.format === "chat") { f = document.getElementById("o-chatDays"); data.chatDays = Number(f ? f.value : 7); }
      if (draft.format === "video") { f = document.getElementById("o-minutes"); data.minutes = Number(f ? f.value : 60); }
      if (draft.format === "monthly") { f = document.getElementById("o-monthlyVideos"); data.monthlyVideos = Number(f ? f.value : 0); }
      api.createPlan(data).then(function (plan) { createdPlan = plan; step = 3; render(); })
        .catch(function () { UI.toast("公開に失敗しました。時間をおいて再度お試しください"); });
    });
  }
  function capture() {
    draft.title = document.getElementById("o-title").value.trim();
    draft.price = document.getElementById("o-price").value;
    draft.desc = document.getElementById("o-desc").value.trim();
    draft.category = document.getElementById("o-cat").value;
  }

  /* ===== STEP 3 完了 ===== */
  function step3() {
    return (
      '<div class="section onb onb-done">' +
      '<div class="onb-done__badge">' + UI.icon("confetti") + "</div>" +
      '<p class="onb-done__title">公開できました！</p>' +
      '<p class="onb-done__sub">あなたはもうELLMIEの出品者です。<br>最初のプランが検索とプロフィールに掲載されました。</p>' +
      (createdPlan ? '<div class="onb-done__card">' + UI.planCard(createdPlan) + "</div>" : "") +

      '<div class="onb-next">' +
      '<p class="onb-next__h">次の一歩</p>' +
      nextItem("brand-instagram", "SNSに宣伝リンクをシェア", "ダッシュボードの宣伝リンクをプロフィールやストーリーズへ。ファンを呼び込めます。") +
      nextItem("layout-grid-add", "プランを増やす", "形式や価格の違うプランを足すほど、相談の入り口が広がります。") +
      "</div>" +

      '<a class="btn btn--rose btn--block" href="' + h("dashboard/index.html") + '">ダッシュボードを見る</a>' +
      (createdPlan ? '<a class="btn btn--outline btn--block" href="' + h("plans/show.html?id=" + createdPlan.id) + '" style="margin-top:10px;">公開したプランを見る</a>' : "") +
      "</div>"
    );
  }
  function nextItem(ic, t, d) {
    return '<div class="onb-next__item">' + UI.icon(ic) +
      '<div><p class="onb-next__t">' + esc(t) + '</p><p class="onb-next__d">' + esc(d) + "</p></div></div>";
  }
})();
