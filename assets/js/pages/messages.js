/* S6 メッセージ（取引スレッド）
   ?order= があれば会話ルーム、なければスレッド一覧。
   チャット相談はここが商品そのもの。クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  var STATUS = { requested: "承認待ち", approved: "承認済み", progress: "進行中", active: "契約中", completed: "完了", canceled: "終了", declined: "見送り" };

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    if (!api.getSession()) {
      main.innerHTML = UI.empty("ログインするとメッセージが使えます。", "ログイン", "login/index.html");
      return;
    }
    var orderId = App.qs("order");
    if (orderId) room(orderId); else list();
  });

  /* ---------- 一覧（購入した相談＝buyer / 受けた相談＝seller の2区分） ---------- */
  function list() {
    var main = document.getElementById("main");
    Promise.all([api.getThreads(), api.getSellerThreads()]).then(function (res) {
      var buyer = res[0] || [], seller = res[1] || [];
      if (!buyer.length && !seller.length) {
        main.innerHTML = '<div class="page-head"><h1>メッセージ</h1></div>' +
          UI.empty("まだ取引がありません。気になる人に相談してみましょう。", "さがす", "search/index.html");
        return;
      }
      var html = '<div class="page-head"><h1>メッセージ</h1></div>';
      if (buyer.length) html += '<p class="thread-group">相談中（あなたが購入）</p><div class="thread-list">' + buyer.map(function (t) { return row(t, "buyer"); }).join("") + "</div>";
      if (seller.length) html += '<p class="thread-group">受けた相談（あなたが出品）</p><div class="thread-list">' + seller.map(function (t) { return row(t, "seller"); }).join("") + "</div>";
      main.innerHTML = html;
    });
  }

  function row(t, role) {
    var o = t.order, c = o.creator || {};
    var isSeller = role === "seller";
    var counter = isSeller ? { name: "購入者" } : c;
    var last = t.last ? t.last.body : "メッセージを始めましょう";
    var href = "messages/index.html?order=" + o.id + (isSeller ? "&role=seller" : "");
    return (
      '<a class="thread-row" href="' + h(href) + '">' +
      UI.avatar(counter, "avatar--lg") +
      '<div class="thread-row__body">' +
      '<p class="thread-row__name">' + esc(counter.name) + (!isSeller && c.verified ? UI.verified() : "") +
      ' <span class="thread-row__status">' + esc(STATUS[o.status] || "") + "</span></p>" +
      '<p class="thread-row__last">' + (isSeller ? esc(o.plan ? o.plan.title : "") + " ・ " : "") + esc(last) + "</p>" +
      "</div>" + UI.icon("chevron-right") + "</a>"
    );
  }

  /* ---------- 会話ルーム ---------- */
  function room(orderId) {
    var main = document.getElementById("main");
    var tab = document.getElementById("tabbar");
    if (tab) tab.remove();  // ルームは全画面
    main.style.paddingBottom = "0";

    Promise.all([api.getOrder(orderId), api.getMySeller()]).then(function (rr) {
      var o = rr[0], mySeller = rr[1];
      if (!o) { main.innerHTML = UI.empty("取引が見つかりませんでした。", "メッセージ一覧へ", "messages/index.html"); return; }
      var iAmSeller = App.qs("role") === "seller" && mySeller && o.creatorId === mySeller.id;
      var c = o.creator || {};
      var counterName = iAmSeller ? "購入者" : c.name;
      api.getThread(orderId).then(function (msgs) {
        main.innerHTML =
          '<div class="room">' +
          '<div class="room__info"><span>' + esc(counterName) + " / " + esc(o.plan ? o.plan.title : "") + (iAmSeller ? "（販売）" : "") + "</span>" +
          '<span class="badge">' + esc(STATUS[o.status] || "") +
          (o.slot ? " ・" + esc(App.slotLabel(o.slot)) : "") + "</span></div>" +
          actionBar(o, iAmSeller) +
          '<div class="room__body" id="room-body">' + msgs.map(function (m) { return bubble(m, iAmSeller); }).join("") + "</div>" +
          '<form class="room__form" id="room-form">' +
          '<button class="room__attach" type="button" id="attach" aria-label="画像を添付">' + UI.icon("photo") + "</button>" +
          '<input id="room-input" type="text" placeholder="メッセージを入力" autocomplete="off">' +
          '<button class="room__send" type="submit" aria-label="送信">' + UI.icon("send") + "</button>" +
          "</form></div>";
        var body = document.getElementById("room-body");
        body.scrollTop = body.scrollHeight;

        var sendOpts = iAmSeller ? { as: "seller" } : {};
        function append(all) {
          body.insertAdjacentHTML("beforeend", bubble(all[all.length - 1], iAmSeller));
          body.scrollTop = body.scrollHeight;
        }
        document.getElementById("room-form").addEventListener("submit", function (e) {
          e.preventDefault();
          var input = document.getElementById("room-input");
          var text = input.value.trim();
          if (!text) return;
          var ng = api.checkMessage(text);   // NGワード検知(仕様書 6章)
          if (ng) {
            UI.toast("「" + ng + "」は送れません。外部誘導・連絡先交換は禁止です");
            return;
          }
          api.sendMessage(orderId, text, sendOpts).then(function (all) { input.value = ""; append(all); });
        });
        document.getElementById("attach").addEventListener("click", function () {
          // 実装ではファイル選択→Storageアップロード。モックは画像メッセージを追加。
          api.sendMessage(orderId, "写真を送信しました", Object.assign({ image: true }, sendOpts)).then(append);
        });
        bindActions(o, iAmSeller);
      });
    });
  }

  function bubble(m, iAmSeller) {
    // 出品者視点では creator=自分(右) / me=相手(左)。購入者視点は逆。
    var mine = iAmSeller ? (m.from === "creator") : (m.from === "me");
    var content = m.image
      ? '<div class="msg__img">' + UI.icon("photo") + " 画像</div>"
      : esc(m.body);
    return (
      '<div class="msg msg--' + (mine ? "me" : "them") + '">' +
      '<div class="msg__bubble">' + content + "</div>" +
      '<p class="msg__time">' + esc(m.timeLabel) + (mine && m.read ? " ・既読" : "") + "</p></div>"
    );
  }

  /* ビデオ取引の入室 / 取引完了 / レビュー導線。出品者視点は購入者専用アクションを出さない */
  function actionBar(o, iAmSeller) {
    var btns = [];
    var hasSlots = o.plan && o.plan.slots && o.plan.slots.length;
    if (!iAmSeller && o.status === "approved")
      btns.push('<button class="btn btn--sm btn--rose" id="confirm">' + UI.icon("credit-card") + " " + App.money(o.price) + " を支払って確定</button>");
    if (o.format === "video" && o.status === "progress")
      btns.push('<a class="btn btn--sm btn--rose" href="' + h("call/index.html?order=" + o.id) + '">' + UI.icon("video") + " ビデオに入室</a>");
    if (!iAmSeller && o.format === "video" && o.status === "progress" && o.slot && !o.rescheduled && hasSlots)
      btns.push('<button class="btn btn--sm btn--outline" id="reschedule">' + UI.icon("calendar-event") + " 日時を変更</button>");
    if (o.format === "video" && o.status === "progress" && o.slot)
      btns.push('<button class="btn btn--sm btn--outline" id="ics">' + UI.icon("calendar-plus") + " カレンダーに追加</button>");
    if (!iAmSeller && (o.status === "progress" || o.status === "active"))
      btns.push('<button class="btn btn--sm btn--outline" id="tip">' + UI.icon("coin") + " 追加で支払う</button>");
    if (o.status === "progress" && o.format !== "monthly")
      btns.push('<button class="btn btn--sm btn--ghost" id="complete">取引を完了する</button>');
    if (!iAmSeller && (o.status === "progress" || o.status === "active"))
      btns.push('<button class="btn btn--sm btn--ghost" id="cancel">キャンセル・返金</button>');
    if (!iAmSeller && o.reviewable)
      btns.push('<a class="btn btn--sm btn--outline" href="' + h("review/index.html?order=" + o.id) + '">レビューを書く</a>');
    if (!btns.length) return "";
    return '<div class="room__actions">' + btns.join("") + "</div>";
  }
  function bindActions(o) {
    var cf = document.getElementById("confirm");
    if (cf) cf.addEventListener("click", function () {
      cf.disabled = true;
      api.confirmRequest(o.id).then(function () { UI.toast("お支払いが完了しました"); setTimeout(function () { location.reload(); }, 500); });
    });
    var c = document.getElementById("complete");
    if (c) c.addEventListener("click", function () {
      api.completeOrder(o.id).then(function () { UI.toast("取引を完了しました"); setTimeout(function () { location.reload(); }, 500); });
    });
    var r = document.getElementById("reschedule");
    if (r) r.addEventListener("click", function () { openReschedule(o); });
    var t = document.getElementById("tip");
    if (t) t.addEventListener("click", function () { openTip(o); });
    var cn = document.getElementById("cancel");
    if (cn) cn.addEventListener("click", function () { openCancel(o); });
    var ics = document.getElementById("ics");
    if (ics) ics.addEventListener("click", function () {
      App.downloadICS({
        title: "ELLMIE ビデオ相談・" + (o.creator ? o.creator.name : "") + "さん",
        start: o.slot, minutes: o.minutes || (o.plan && o.plan.minutes) || 60,
        desc: o.plan ? o.plan.title : "ビデオ相談"
      });
      UI.toast("カレンダー用ファイルを書き出しました");
    });
  }

  /* キャンセル・返金。形式と締切で挙動を分岐(ストアカ/ココナラ準拠) */
  function doCancel(o, opts) {
    api.cancelOrder(o.id, opts).then(function () {
      UI.closeSheet(); UI.toast("返金を受け付けました");
      setTimeout(function () { location.reload(); }, 600);
    });
  }
  function wireCancel(ov, o, opts) {
    ov.querySelector("#c-go").addEventListener("click", function () { doCancel(o, opts); });
    ov.querySelector("#c-no").addEventListener("click", UI.closeSheet);
  }
  function openCancel(o) {
    // 月額の解約
    if (o.status === "active") {
      var ovM = UI.openSheet(
        '<p class="sheet__q">月額を解約しますか？</p>' +
        '<p class="lead" style="margin-bottom:18px;">次回更新を停止します。今の請求期間の終わりまではご利用いただけます（日割り返金なし）。</p>' +
        '<button class="btn btn--rose btn--block" id="c-go">解約する</button>' +
        '<button class="btn btn--ghost btn--block" id="c-no" style="margin-top:10px;">やめる</button>'
      );
      ovM.querySelector("#c-go").addEventListener("click", function () {
        api.cancelSubscription(o.id).then(function () { UI.closeSheet(); UI.toast("解約しました"); setTimeout(function () { location.reload(); }, 500); });
      });
      ovM.querySelector("#c-no").addEventListener("click", UI.closeSheet);
      return;
    }
    // ビデオ：24時間前まで無料キャンセル。過ぎたらノーショー返金のみ
    if (o.format === "video" && o.slot) {
      var hrs = (new Date(o.slot) - new Date()) / 3600000;
      if (hrs > 24) {
        var ovV = UI.openSheet(
          '<p class="sheet__q">キャンセル・返金</p>' +
          '<p class="lead" style="margin-bottom:18px;">開始24時間前まで、無料でキャンセルできます。お支払いは全額返金されます。</p>' +
          '<button class="btn btn--rose btn--block" id="c-go">キャンセルする（全額返金）</button>' +
          '<button class="btn btn--ghost btn--block" id="c-no" style="margin-top:10px;">やめる</button>'
        );
        wireCancel(ovV, o, {});
        return;
      }
      var ovN = UI.openSheet(
        '<p class="sheet__q">キャンセル・返金</p>' +
        '<p class="lead" style="margin-bottom:16px;">開始24時間前を過ぎたため、通常キャンセルはできません。相手が現れない場合は、開始時刻から15分の猶予ののち返金を申請できます。日時の変更をご希望なら「日時を変更」もご利用ください。</p>' +
        '<button class="btn btn--rose btn--block" id="c-ns">相手が来ない・返金を申請</button>' +
        '<button class="btn btn--ghost btn--block" id="c-no" style="margin-top:10px;">閉じる</button>'
      );
      ovN.querySelector("#c-ns").addEventListener("click", function () { doCancel(o, { reason: "noshow" }); });
      ovN.querySelector("#c-no").addEventListener("click", UI.closeSheet);
      return;
    }
    // チャット：48時間無応答なら全額返金
    var ovC = UI.openSheet(
      '<p class="sheet__q">返金を申請</p>' +
      '<p class="lead" style="margin-bottom:18px;">出品者が48時間以内に一度も応答しない場合、全額返金されます。今すぐ申請しますか？（応答があった取引は完了までキャンセルできません）</p>' +
      '<button class="btn btn--rose btn--block" id="c-go">返金を申請する</button>' +
      '<button class="btn btn--ghost btn--block" id="c-no" style="margin-top:10px;">やめる</button>'
    );
    wireCancel(ovC, o, {});
  }

  /* 予約日時の変更(1回まで) */
  function openReschedule(o) {
    var slots = (o.plan && o.plan.slots) || [];
    var booked = (o.plan && o.plan.bookedSlots) || [];
    var avail = slots.filter(function (v) { return booked.indexOf(v) === -1; });
    if (!avail.length) { UI.toast("変更できる空き枠がありません。メッセージで相談してください。"); return; }
    var ov = UI.openSheet(
      '<p class="sheet__q">予約日時を変更</p>' +
      '<p class="lead" style="margin-bottom:14px;">変更は1回まで・開始24時間前まで。新しい枠を選んでください。</p>' +
      '<div class="slot-grid">' + avail.map(function (v) {
        var parts = App.slotLabel(v).split(" ");
        return '<button class="slot" type="button" data-slot="' + esc(v) + '">' + esc(parts[0]) + "<small>" + esc(parts[1] || "") + "</small></button>";
      }).join("") + "</div>"
    );
    Array.prototype.forEach.call(ov.querySelectorAll("[data-slot]"), function (b) {
      b.addEventListener("click", function () {
        api.rescheduleOrder(o.id, b.dataset.slot).then(function () {
          UI.closeSheet(); UI.toast("予約日時を変更しました");
          setTimeout(function () { location.reload(); }, 500);
        });
      });
    });
  }

  /* 追加支払い(おひねり/延長・都度払い) */
  function openTip(o) {
    var presets = [500, 1000, 3000];
    var ov = UI.openSheet(
      '<p class="sheet__q">追加で支払う（お礼・延長）</p>' +
      '<p class="lead" style="margin-bottom:14px;">満足のお礼や、相談の延長・追加対応に。都度払いで出品者にそのまま届きます。</p>' +
      '<div class="tip-opts">' + presets.map(function (a) {
        return '<button type="button" class="btn btn--outline tip-opt" data-amt="' + a + '">' + App.money(a) + "</button>";
      }).join("") + "</div>" +
      '<label class="field-label" style="margin-top:14px;">金額を指定</label>' +
      '<input class="field" id="tip-amt" type="number" inputmode="numeric" min="100" placeholder="例）2000">' +
      '<button class="btn btn--rose btn--block" id="tip-go" style="margin-top:14px;">支払う</button>'
    );
    var pick = null;
    Array.prototype.forEach.call(ov.querySelectorAll(".tip-opt"), function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(ov.querySelectorAll(".tip-opt"), function (x) { x.classList.remove("is-on"); });
        b.classList.add("is-on"); pick = Number(b.dataset.amt);
        ov.querySelector("#tip-amt").value = "";
      });
    });
    ov.querySelector("#tip-go").addEventListener("click", function () {
      var custom = Number(ov.querySelector("#tip-amt").value);
      var amt = custom || pick;
      if (!amt || amt < 100) return UI.toast("100円以上を指定してください");
      api.addAddon(o.id, amt, "追加のお支払い", 0).then(function () {
        UI.closeSheet(); UI.toast("お支払いありがとうございます");
        setTimeout(function () { location.reload(); }, 500);
      });
    });
  }
})();
