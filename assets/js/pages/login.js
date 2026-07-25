/* S13 ログイン / 新規登録（モック）
   価値訴求 → SNSログイン/メール。?next= があればログイン後に戻る。
   実装では Supabase Auth（Google/LINE/Apple）に差し替え。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    var next = App.qs("next");
    main.innerHTML =
      '<div class="login">' +
      '<p class="login__logo">ELLMIE</p>' +
      '<p class="login__copy">憧れの人が、そばに。</p>' +
      '<p class="login__sub">メイク・美容・ファッション・暮らしを、憧れの人に直接相談。</p>' +

      '<div class="login__values">' +
      value("user-star", "本人確認済みの出品者に、1対1で相談できる") +
      value("message-2", "チャット・ビデオで、あなたに合わせたアドバイス") +
      value("shield-check", "お支払いは取引完了まで安全にお預かり") +
      "</div>" +

      '<div class="login__btns">' +
      '<button class="btn btn--line btn--block" data-p="line">' + UI.icon("brand-line") + " LINEではじめる</button>" +
      '<button class="btn btn--ink btn--block" data-p="apple">' + UI.icon("brand-apple") + " Appleではじめる</button>" +
      '<button class="btn btn--outline btn--block" data-p="google">' + UI.icon("brand-google") + " Googleではじめる</button>" +
      "</div>" +

      '<div class="login__or">または</div>' +
      '<form id="mail-form" class="stack">' +
      '<input class="field" type="email" placeholder="メールアドレス" required>' +
      '<button class="btn btn--rose btn--block" type="submit">メールではじめる</button>' +
      "</form>" +

      '<p class="login__terms">登録すると<a href="' + h("terms.html") + '">利用規約</a>・<a href="' + h("privacy.html") + '">プライバシーポリシー</a>に同意したものとみなされます。</p>' +
      "</div>";

    function finish() {
      api.login().then(function () {
        UI.toast("ようこそ、ELLMIEへ");
        setTimeout(function () { App.goto(next ? decodeURIComponent(next) : "index.html"); }, 500);
      });
    }
    document.querySelectorAll("[data-p]").forEach(function (b) { b.addEventListener("click", finish); });
    document.getElementById("mail-form").addEventListener("submit", function (e) { e.preventDefault(); finish(); });
  });

  function value(ic, text) {
    return '<div class="login__value">' + UI.icon(ic) + "<span>" + esc(text) + "</span></div>";
  }
})();
