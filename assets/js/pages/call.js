/* S7 ビデオ通話（ブラウザ内）
   予約枠の通話。残り時間・ミュート/カメラ・退出/延長/完了。
   ★退出しても取引は完了しない（メッセージから何度でも再入室できる）。
   ★時間超過は「延長(おひねり課金)／完了してレビュー／退出」を選べる。
   実装では Daily.co のルームに接続。録画は提供しない(仕様書 6章)。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  var timer = null, remain = 0, muted = false, camOff = false;
  var order = null, creator = null, perMin = 0;

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    if (!api.getSession()) { App.goto("login/index.html"); return; }
    var orderId = App.qs("order");
    api.getOrder(orderId).then(function (o) {
      if (!o || o.format !== "video") { main.innerHTML = UI.empty("ビデオ通話の取引が見つかりませんでした。", "メッセージへ", "messages/index.html"); return; }
      order = o; creator = o.creator || {};
      var mins = o.minutes || (o.plan && o.plan.minutes) || 60;
      perMin = (o.plan && o.plan.price && o.plan.minutes) ? o.plan.price / o.plan.minutes : 0;
      startCall(mins * 60);
    });
  });

  function startCall(seconds) {
    remain = seconds;
    document.getElementById("main").innerHTML = view();
    bind();
    tick();
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 1000);
  }

  function view() {
    return (
      '<div class="call">' +
      '<div class="call__stage">' +
      '<div class="call__remote">' + UI.avatar(creator, "avatar--xl") + '<p class="call__name">' + esc(creator.name) + "さん</p>" +
      '<p class="call__note">' + UI.icon("lock") + " この通話は録画されません</p>" +
      '<p class="call__note call__note--sub">' + UI.icon("refresh") + " 切れても、メッセージから何度でも再入室できます</p></div>" +
      '<div class="call__self" id="self">あなた</div>' +
      '<div class="call__timer" id="timer">--:--</div>' +
      "</div>" +
      '<div class="call__bar">' +
      ctrl("mic", muted ? "microphone-off" : "microphone", "ミュート", muted) +
      ctrl("cam", camOff ? "video-off" : "video", "カメラ", camOff) +
      '<button class="call__end" id="end" aria-label="退出">' + UI.icon("phone-off") + "</button>" +
      "</div></div>"
    );
  }
  function ctrl(id, icon, label, off) {
    return '<button class="call__ctrl' + (off ? " is-off" : "") + '" id="' + id + '" aria-label="' + label + '">' + UI.icon(icon) + "</button>";
  }

  function tick() {
    var t = document.getElementById("timer");
    if (!t) return;
    if (remain <= 0) { clearInterval(timer); timeUp(); return; }
    var m = Math.floor(remain / 60), s = remain % 60;
    t.textContent = m + ":" + (s < 10 ? "0" : "") + s;
    t.classList.toggle("is-warn", remain <= 300);   // 残り5分で警告色
    remain -= 1;
  }

  function bind() {
    document.getElementById("mic").addEventListener("click", function () {
      muted = !muted; this.classList.toggle("is-off", muted);
      this.innerHTML = UI.icon(muted ? "microphone-off" : "microphone");
    });
    document.getElementById("cam").addEventListener("click", function () {
      camOff = !camOff; this.classList.toggle("is-off", camOff);
      var self = document.getElementById("self"); if (self) self.classList.toggle("is-off", camOff);
      this.innerHTML = UI.icon(camOff ? "video-off" : "video");
    });
    document.getElementById("end").addEventListener("click", leaveConfirm);
  }

  /* 退出（取引は完了しない・再入室できる） */
  function leaveConfirm() {
    var ov = UI.openSheet(
      '<p class="sheet__q">通話を退出しますか？</p>' +
      '<p class="lead" style="margin-bottom:18px;">メッセージからいつでも再入室できます。取引はまだ完了しません。相談が済んだら「取引を完了する」を押してください。</p>' +
      '<button class="btn btn--rose btn--block" id="leave-go">退出する</button>' +
      '<button class="btn btn--ghost btn--block" id="leave-stay" style="margin-top:10px;">通話に戻る</button>'
    );
    ov.querySelector("#leave-go").addEventListener("click", function () {
      if (timer) clearInterval(timer);
      App.goto("messages/index.html?order=" + order.id);
    });
    ov.querySelector("#leave-stay").addEventListener("click", UI.closeSheet);
  }

  /* 時間になった：延長 / 完了 / 退出 */
  function timeUp() {
    document.getElementById("main").innerHTML =
      '<div class="done">' +
      '<div class="done__icon">' + UI.icon("clock-hour-4") + "</div>" +
      '<p class="done__title">時間になりました</p>' +
      '<p class="lead">もう少し話したいときは延長できます。終わってよければ完了してレビューへ。</p>' +
      '<div class="stack" style="margin-top:24px;">' +
      (perMin ? '<button class="btn btn--rose btn--block" id="extend">' + UI.icon("plus") + " 延長する（追加でお支払い）</button>" : "") +
      '<button class="btn btn--' + (perMin ? "outline" : "rose") + ' btn--block" id="finish">レッスンを完了してレビュー</button>' +
      '<button class="btn btn--ghost btn--block" id="leave" style="margin-top:10px;">退出（あとで完了）</button>' +
      "</div></div>";
    var ex = document.getElementById("extend"); if (ex) ex.addEventListener("click", openExtend);
    document.getElementById("finish").addEventListener("click", completeAndReview);
    document.getElementById("leave").addEventListener("click", function () { App.goto("messages/index.html?order=" + order.id); });
  }

  function extPrice(mins) { return Math.max(100, Math.round(perMin * mins / 100) * 100); }
  function openExtend() {
    var opt = function (mins) {
      return '<button class="btn btn--outline btn--block ext-opt" data-min="' + mins + '" style="margin-bottom:10px;">＋' + mins + "分　" + App.money(extPrice(mins)) + "</button>";
    };
    var ov = UI.openSheet(
      '<p class="sheet__q">通話を延長する</p>' +
      '<p class="lead" style="margin-bottom:16px;">追加のお支払いで、そのまま続けられます（都度払い）。</p>' +
      opt(15) + opt(30) +
      '<p class="field-note">お支払いは取引完了までELLMIEがお預かりします。</p>'
    );
    Array.prototype.forEach.call(ov.querySelectorAll(".ext-opt"), function (b) {
      b.addEventListener("click", function () {
        var mins = Number(b.dataset.min);
        api.addAddon(order.id, extPrice(mins), "＋" + mins + "分の延長", mins).then(function () {
          UI.closeSheet();
          UI.toast(mins + "分延長しました");
          startCall(mins * 60);
        });
      });
    });
  }

  function completeAndReview() {
    if (timer) clearInterval(timer);
    api.completeOrder(order.id).then(function () {
      document.getElementById("main").innerHTML =
        '<div class="done">' +
        '<div class="done__icon">' + UI.icon("circle-check-filled") + "</div>" +
        '<p class="done__title">お疲れさまでした</p>' +
        '<p class="lead">レッスンはいかがでしたか？レビューを書いて出品者を応援しましょう。</p>' +
        '<div class="stack" style="margin-top:24px;">' +
        '<a class="btn btn--rose btn--block" href="' + h("review/index.html?order=" + order.id) + '">レビューを書く</a>' +
        '<a class="btn btn--ghost btn--block" href="' + h("me/index.html") + '">マイページへ</a>' +
        "</div></div>";
    });
  }
})();
