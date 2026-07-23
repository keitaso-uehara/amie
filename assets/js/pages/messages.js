/* S6 メッセージ（取引スレッド）
   ?order= があれば会話ルーム、なければスレッド一覧。
   チャット相談はここが商品そのもの。クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  var STATUS = { progress: "進行中", active: "契約中", completed: "完了", canceled: "終了" };

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    if (!api.getSession()) {
      main.innerHTML = UI.empty("ログインするとメッセージが使えます。", "ログイン", "login/index.html");
      return;
    }
    var orderId = App.qs("order");
    if (orderId) room(orderId); else list();
  });

  /* ---------- 一覧 ---------- */
  function list() {
    var main = document.getElementById("main");
    api.getThreads().then(function (threads) {
      if (!threads.length) {
        main.innerHTML = '<div class="page-head"><h1>メッセージ</h1></div>' +
          UI.empty("まだ取引がありません。気になる人に相談してみましょう。", "さがす", "search/index.html");
        return;
      }
      main.innerHTML =
        '<div class="page-head"><h1>メッセージ</h1></div>' +
        '<div class="thread-list">' + threads.map(row).join("") + "</div>";
    });
  }

  function row(t) {
    var o = t.order, c = o.creator || {};
    var last = t.last ? t.last.body : "メッセージを始めましょう";
    return (
      '<a class="thread-row" href="' + h("messages/index.html?order=" + o.id) + '">' +
      UI.avatar(c, "avatar--lg") +
      '<div class="thread-row__body">' +
      '<p class="thread-row__name">' + esc(c.name) + (c.verified ? UI.verified() : "") +
      ' <span class="thread-row__status">' + esc(STATUS[o.status] || "") + "</span></p>" +
      '<p class="thread-row__last">' + esc(last) + "</p>" +
      "</div>" + UI.icon("chevron-right") + "</a>"
    );
  }

  /* ---------- 会話ルーム ---------- */
  function room(orderId) {
    var main = document.getElementById("main");
    var tab = document.getElementById("tabbar");
    if (tab) tab.remove();  // ルームは全画面
    main.style.paddingBottom = "0";

    api.getOrder(orderId).then(function (o) {
      if (!o) { main.innerHTML = UI.empty("取引が見つかりませんでした。", "メッセージ一覧へ", "messages/index.html"); return; }
      var c = o.creator || {};
      api.getThread(orderId).then(function (msgs) {
        main.innerHTML =
          '<div class="room">' +
          '<div class="room__info"><span>' + esc(c.name) + " / " + esc(o.plan ? o.plan.title : "") + "</span>" +
          '<span class="badge">' + esc(STATUS[o.status] || "") +
          (o.slot ? " ・" + esc(o.slot) : "") + "</span></div>" +
          actionBar(o) +
          '<div class="room__body" id="room-body">' + msgs.map(bubble).join("") + "</div>" +
          '<form class="room__form" id="room-form">' +
          '<button class="room__attach" type="button" id="attach" aria-label="画像を添付">' + UI.icon("photo") + "</button>" +
          '<input id="room-input" type="text" placeholder="メッセージを入力" autocomplete="off">' +
          '<button class="room__send" type="submit" aria-label="送信">' + UI.icon("send") + "</button>" +
          "</form></div>";
        var body = document.getElementById("room-body");
        body.scrollTop = body.scrollHeight;

        function append(all) {
          body.insertAdjacentHTML("beforeend", bubble(all[all.length - 1]));
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
          api.sendMessage(orderId, text).then(function (all) { input.value = ""; append(all); });
        });
        document.getElementById("attach").addEventListener("click", function () {
          // 実装ではファイル選択→Storageアップロード。モックは画像メッセージを追加。
          api.sendMessage(orderId, "写真を送信しました", { image: true }).then(append);
        });
        bindActions(o);
      });
    });
  }

  function bubble(m) {
    var me = m.from === "me";
    var content = m.image
      ? '<div class="msg__img">' + UI.icon("photo") + " 画像</div>"
      : esc(m.body);
    return (
      '<div class="msg msg--' + (me ? "me" : "them") + '">' +
      '<div class="msg__bubble">' + content + "</div>" +
      '<p class="msg__time">' + esc(m.timeLabel) + (me && m.read ? " ・既読" : "") + "</p></div>"
    );
  }

  /* ビデオ取引の入室 / 取引完了 / レビュー導線 */
  function actionBar(o) {
    var btns = [];
    if (o.format === "video" && o.status === "progress")
      btns.push('<a class="btn btn--sm btn--rose" href="' + h("call/index.html?order=" + o.id) + '">' + UI.icon("video") + " ビデオに入室</a>");
    if (o.status === "progress" && o.format !== "monthly")
      btns.push('<button class="btn btn--sm btn--ghost" id="complete">取引を完了する</button>');
    if (o.reviewable)
      btns.push('<a class="btn btn--sm btn--outline" href="' + h("review/index.html?order=" + o.id) + '">レビューを書く</a>');
    if (!btns.length) return "";
    return '<div class="room__actions">' + btns.join("") + "</div>";
  }
  function bindActions(o) {
    var c = document.getElementById("complete");
    if (c) c.addEventListener("click", function () {
      api.completeOrder(o.id).then(function () { UI.toast("取引を完了しました"); setTimeout(function () { location.reload(); }, 500); });
    });
  }
})();
