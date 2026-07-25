/* S5 購入・決済（前払いエスクローのモック）
   ?plan= のプランを購入。ビデオは予約枠選択を必須、月額は自動更新の同意。
   購入完了で注文＋メッセージスレッドを作り、完了画面へ。
   クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  var picked = null;   // 選択中の予約枠(datetime-local文字列)

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    // SNSリンクから来た人がまず見られるよう、ログインは強制しない（認証は「支払う」時）
    var id = App.qs("plan");
    var ref = App.qs("ref"); if (ref) api.trackReferralVisit(ref);   // 流入計測
    api.getPlan(id).then(function (p) {
      if (!p) { main.innerHTML = UI.empty("プランが見つかりませんでした。", "さがすへ", "search/index.html"); return; }
      main.innerHTML = form(p);
      bind(p);
    });
  });

  function form(p) {
    var c = p.creator || {};
    return (
      '<div class="section">' +
      '<div class="checkout-creator">' + UI.avatar(c, "avatar--lg") +
      '<div><p class="checkout-creator__name">' + esc(c.name) + "さん" + (c.verified ? UI.verified() : "") + "</p>" +
      '<p class="checkout-creator__sub">への相談を申し込みます</p></div></div>' +
      '<p class="section__title">お支払い</p>' +

      '<div class="order-card">' +
      '<div class="order-card__row"><span>' + esc(p.title) + "</span></div>" +
      '<div class="order-card__row"><span class="muted">' + esc(c.name) + " / " + esc(UI.formatDetail(p)) + "</span></div>" +
      '<div class="order-card__row total"><span>お支払い' + (p.format === "monthly" ? "（初月）" : "") + "</span><span>" + App.money(p.price) + "</span></div>" +
      "</div>" +

      (p.format === "video" ? slotBlock(p) : "") +

      '<p class="field-label">お支払い方法</p>' +
      '<div class="pay-method">' +
      '<span class="pay-method__ic">' + UI.icon("credit-card") + "</span>" +
      '<span class="pay-method__body"><b>Visa</b> •••• 4242<small>有効期限 12/28</small></span>' +
      '<span class="pay-method__badge">' + UI.icon("lock") + "</span></div>" +
      '<p class="field-note">お支払い情報は暗号化して安全に処理されます。5万円を超えるお支払いには本人認証（3Dセキュア）が必要です。</p>' +

      (p.format === "monthly"
        ? '<div class="notice-box" style="background:var(--cream);color:var(--ink-soft);margin-top:16px;">' + UI.icon("refresh") + " 毎月自動更新されます。いつでも解約でき、解約後も現在の請求期間の終わりまでご利用いただけます。</div>"
        : "") +

      '<label class="consent"><input type="checkbox" id="agree">' +
      '<span><a href="' + h("terms.html") + '">利用規約</a>・<a href="' + h("tokusho.html") + '">特商法表記</a>' +
      (p.format === "monthly" ? "、および毎月の自動更新" : "") + "に同意します。</span></label>" +

      '<button class="btn btn--rose btn--block" id="pay" disabled>' + App.money(p.price) + " を支払う</button>" +
      '<p class="field-note center" style="margin-top:10px;">お支払いは取引完了までELLMIEがお預かりします（エスクロー）。</p>' +
      '<p class="field-note center">はじめての方も、購入と同時にアカウントが作成されます。事前の会員登録は不要です。</p>' +
      "</div>"
    );
  }

  function avail(p) {
    var booked = p.bookedSlots || [];
    return (p.slots || []).filter(function (v) { return booked.indexOf(v) === -1; });
  }
  function slotBlock(p) {
    var slots = avail(p);
    if (!slots.length) {
      var full = p.slots && p.slots.length;
      return '<div class="notice-box" style="background:var(--cream);color:var(--ink-soft);">' + UI.icon("calendar-event") +
        (full ? " 現在ご予約可能な枠がありません。購入後にメッセージで日程を調整します。" : " この出品者は、購入後にメッセージで日程を調整します。ご希望の候補をお伝えください。") + "</div>";
    }
    return (
      '<p class="field-label">ビデオの予約枠を選択</p>' +
      '<div class="slot-grid" id="slots">' +
      slots.map(function (v) {
        var parts = App.slotLabel(v).split(" ");
        return '<button class="slot" type="button" data-slot="' + esc(v) + '">' + esc(parts[0]) + "<small>" + esc(parts[1] || "") + "</small></button>";
      }).join("") + "</div>" +
      '<p class="field-note" style="margin-bottom:16px;">開始24時間前まで無料でキャンセル・日時変更（1回）できます。</p>'
    );
  }

  function bind(p) {
    var agree = document.getElementById("agree");
    var pay = document.getElementById("pay");
    var slots = document.getElementById("slots");

    function refresh() {
      var needSlot = p.format === "video" && avail(p).length > 0;
      var ok = agree.checked && (!needSlot || picked !== null);
      pay.disabled = !ok;
    }
    agree.addEventListener("change", refresh);

    if (slots) {
      slots.addEventListener("click", function (e) {
        var b = e.target.closest("[data-slot]");
        if (!b) return;
        slots.querySelectorAll(".slot").forEach(function (s) { s.classList.remove("is-on"); });
        b.classList.add("is-on");
        picked = b.dataset.slot;
        refresh();
      });
    }

    pay.addEventListener("click", function () {
      var opts = {};
      if (p.format === "video" && picked) opts.slot = picked;
      var ref = App.qs("ref"); if (ref) opts.ref = ref;
      authAndPay(p, opts);
    });
  }

  function purchaseNow(p, opts) {
    api.purchase(p.id, opts).then(function (order) { done(p, order); });
  }

  /* 支払いの瞬間だけ認証（1タップ社会ログイン→アカウント自動作成→購入）。ログイン済みなら即購入 */
  function authAndPay(p, opts) {
    if (api.getSession()) { purchaseNow(p, opts); return; }
    var ov = UI.openSheet(
      '<p class="sheet__q">あと1ステップで完了</p>' +
      '<p class="lead" style="margin-bottom:16px;">続けるサービスを選ぶだけ。アカウントが無い方も、その場で自動作成されます。</p>' +
      '<button class="btn btn--line btn--block auth-p" data-p="line" style="margin-bottom:10px;">' + UI.icon("brand-line") + " LINEで続ける</button>" +
      '<button class="btn btn--ink btn--block auth-p" data-p="apple" style="margin-bottom:10px;">' + UI.icon("brand-apple") + " Appleで続ける</button>" +
      '<button class="btn btn--outline btn--block auth-p" data-p="google">' + UI.icon("brand-google") + " Googleで続ける</button>" +
      '<p class="field-note center" style="margin-top:12px;">続けると<a href="' + h("terms.html") + '">利用規約</a>・<a href="' + h("privacy.html") + '">プライバシー</a>に同意したものとみなされます。</p>'
    );
    Array.prototype.forEach.call(ov.querySelectorAll(".auth-p"), function (b) {
      b.addEventListener("click", function () {
        api.login(b.dataset.p).then(function () { UI.closeSheet(); purchaseNow(p, opts); });
      });
    });
  }

  function done(p, order) {
    var main = document.getElementById("main");
    var c = p.creator || {};
    var following = api.isFollowing(c.id);
    main.innerHTML =
      '<div class="done">' +
      '<div class="done__icon">' + UI.icon("circle-check-filled") + "</div>" +
      '<p class="done__title">お申し込み完了！</p>' +
      '<p class="lead">' + esc(c.name) + "さんとのメッセージルームが開きました。" +
      (p.format === "video" && order.slot ? "<br>予約：" + esc(App.slotLabel(order.slot)) : "") + "</p>" +
      '<div class="stack" style="margin-top:24px;">' +
      '<a class="btn btn--rose btn--block" href="' + h("messages/index.html?order=" + order.id) + '">メッセージを開く</a>' +
      (following ? "" : '<button class="btn btn--outline btn--block" id="done-follow">' + UI.icon("heart") + " " + esc(c.name) + "さんをフォロー（次回もすぐ相談）</button>") +
      '<a class="btn btn--ghost btn--block" href="' + h("me/index.html") + '">マイページへ</a>' +
      "</div></div>";
    var fb = document.getElementById("done-follow");
    if (fb) fb.addEventListener("click", function () {
      api.toggleFollow(c.id).then(function () {
        fb.disabled = true;
        fb.innerHTML = UI.icon("check") + " フォローしました";
        UI.toast("フォローしました。次回もすぐ相談できます");
      });
    });
  }
})();
