/* S7 ビデオ通話（ブラウザ内・モック）
   ?order= の取引でビデオ通話。残り時間表示・ミュート/カメラ・終了。
   実装では Daily.co のルームに接続。録画は提供しない(仕様書 6章)。
   終了→取引完了→レビュー導線(S9)。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  var timer = null, remain = 0, muted = false, camOff = false;

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    if (!api.getSession()) { App.goto("login/index.html"); return; }
    var orderId = App.qs("order");
    api.getOrder(orderId).then(function (o) {
      if (!o || o.format !== "video") { main.innerHTML = UI.empty("ビデオ通話の取引が見つかりませんでした。", "メッセージへ", "messages/index.html"); return; }
      var c = o.creator || {};
      remain = ((o.plan && o.plan.minutes) || 60) * 60;   // 秒
      main.innerHTML = view(o, c);
      bind(o);
      tick();
      timer = setInterval(tick, 1000);
    });
  });

  function view(o, c) {
    return (
      '<div class="call">' +
      '<div class="call__stage">' +
      '<div class="call__remote">' + UI.avatar(c, "avatar--xl") + '<p class="call__name">' + esc(c.name) + "さん</p>" +
      '<p class="call__note">' + UI.icon("lock") + " この通話は録画されません</p></div>" +
      '<div class="call__self" id="self">あなた</div>' +
      '<div class="call__timer" id="timer">--:--</div>' +
      "</div>" +
      '<div class="call__bar">' +
      ctrl("mic", "mic", "ミュート") +
      ctrl("cam", "video", "カメラ") +
      '<button class="call__end" id="end">' + UI.icon("phone-off") + "</button>" +
      "</div></div>"
    );
  }
  function ctrl(id, icon, label) {
    return '<button class="call__ctrl" id="' + id + '" aria-label="' + label + '">' + UI.icon(icon) + "</button>";
  }

  function tick() {
    var t = document.getElementById("timer");
    if (!t) return;
    var m = Math.floor(remain / 60), s = remain % 60;
    t.textContent = m + ":" + (s < 10 ? "0" : "") + s;
    t.classList.toggle("is-warn", remain <= 300);   // 残り5分で警告色
    if (remain <= 0) { clearInterval(timer); endCall(currentOrderId, true); return; }
    remain -= 1;
  }

  var currentOrderId = null;
  function bind(o) {
    currentOrderId = o.id;
    document.getElementById("mic").addEventListener("click", function () {
      muted = !muted; this.classList.toggle("is-off", muted);
      this.innerHTML = UI.icon(muted ? "microphone-off" : "mic");
    });
    document.getElementById("cam").addEventListener("click", function () {
      camOff = !camOff; this.classList.toggle("is-off", camOff);
      document.getElementById("self").classList.toggle("is-off", camOff);
      this.innerHTML = UI.icon(camOff ? "video-off" : "video");
    });
    document.getElementById("end").addEventListener("click", function () { endCall(o.id, false); });
  }

  function endCall(orderId, auto) {
    if (timer) clearInterval(timer);
    api.completeOrder(orderId).then(function () {
      var main = document.getElementById("main");
      main.innerHTML =
        '<div class="done">' +
        '<div class="done__icon">' + UI.icon("circle-check-filled") + "</div>" +
        '<p class="done__title">' + (auto ? "時間になりました" : "通話を終了しました") + "</p>" +
        '<p class="lead">レッスンはいかがでしたか？レビューを書いて出品者を応援しましょう。</p>' +
        '<div class="stack" style="margin-top:24px;">' +
        '<a class="btn btn--rose btn--block" href="' + h("review/index.html?order=" + orderId) + '">レビューを書く</a>' +
        '<a class="btn btn--ghost btn--block" href="' + h("me/index.html") + '">マイページへ</a>' +
        "</div></div>";
    });
  }
})();
