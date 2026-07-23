/* S14 通知
   一覧＋「すべて既読にする」。タップで既読化。クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  var ICON = { message: "message-2", booking: "calendar-heart", complete: "circle-check", review: "star", news: "speakerphone" };

  document.addEventListener("DOMContentLoaded", render);

  function render() {
    var main = document.getElementById("main");
    api.getNotifications().then(function (list) {
      if (!list.length) { main.innerHTML = '<div class="page-head"><h1>通知</h1></div>' + UI.empty("通知はありません。"); return; }
      main.innerHTML =
        '<div class="page-head"><h1>通知</h1></div>' +
        '<div class="notif-toolbar"><button id="read-all">すべて既読にする</button></div>' +
        '<div class="notifications-list">' + list.map(rowHtml).join("") + "</div>";
      bind();
    });
  }

  function rowHtml(n) {
    return (
      '<div class="notif-row' + (n.read ? "" : " is-unread") + '" data-id="' + esc(n.id) + '">' +
      '<span class="notif-row__icon">' + UI.icon(ICON[n.type] || "bell") + "</span>" +
      '<div class="notif-row__body"><p class="notif-row__title">' + esc(n.title) + "</p>" +
      '<p class="notif-row__date">' + esc(n.date) + "</p></div></div>"
    );
  }

  function bind() {
    document.querySelectorAll(".notif-row").forEach(function (r) {
      r.addEventListener("click", function () {
        api.markNotificationRead(r.dataset.id).then(function () { r.classList.remove("is-unread"); });
      });
    });
    var all = document.getElementById("read-all");
    if (all) all.addEventListener("click", function () {
      api.markAllNotificationsRead().then(function () {
        document.querySelectorAll(".notif-row").forEach(function (r) { r.classList.remove("is-unread"); });
        UI.toast("すべて既読にしました");
      });
    });
  }
})();
