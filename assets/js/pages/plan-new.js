/* S12 プラン作成・編集
   形式→内容→価格。価格ルール(仕様書 4.5): 最低1,000円、新規出品者は上限10万円。
   作成後は実データとして検索・出品者詳細に出現する。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };
  var MIN = 1000, CAP = 100000;   // 4.5 価格ルール
  var format = "chat";

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    if (!api.getSession()) { App.goto("login/index.html?next=" + encodeURIComponent("plans/new.html")); return; }
    main.innerHTML = form();
    bind();
  });

  function form() {
    var cats = TAX.categories.map(function (c) { return '<option value="' + c.slug + '">' + esc(c.label) + "</option>"; }).join("");
    return (
      '<div class="section">' +
      '<p class="section__title">プランを作成</p>' +

      '<div class="form-row"><label class="field-label">提供形式</label>' +
      '<div class="seg" id="fmt">' +
      seg("chat", "チャット単発") + seg("video", "単発ビデオ") + seg("monthly", "月額メンター") +
      "</div></div>" +

      '<div class="form-row"><label class="field-label">プラン名</label>' +
      '<input class="field" id="title" maxlength="60" placeholder="例）あなた専用・垢抜けメイクレッスン"></div>' +

      '<div class="form-row"><label class="field-label">カテゴリ</label>' +
      '<select class="field" id="cat">' + cats + "</select></div>" +

      '<div class="form-row" id="fmt-fields"></div>' +

      '<div class="form-row"><label class="field-label">料金（税込）</label>' +
      '<input class="field" id="price" type="number" inputmode="numeric" min="1000" placeholder="3000">' +
      '<p class="field-note">最低1,000円・上限10万円（本人確認と実績で解除できます）。月額は1ヶ月あたりの金額です。</p></div>' +

      '<div class="form-row"><label class="field-label">内容説明</label>' +
      '<textarea class="field field--area" id="desc" maxlength="2000" placeholder="こんな人におすすめ / 進め方 / 注意事項"></textarea></div>' +

      '<div class="notice-box" style="background:var(--cream);color:var(--ink-soft);">' + UI.icon("info-circle") +
      " 公開後は運営が内容を確認します（事後パトロール）。禁止事項は" + '<a href="' + h("guide.html") + '" style="color:var(--rose-deep);">出品者ガイド</a>をご確認ください。</div>' +

      '<button class="btn btn--rose btn--block" id="submit">公開する</button>' +
      "</div>"
    );
  }
  function seg(v, label) { return '<button type="button" class="seg__item' + (v === format ? " is-on" : "") + '" data-fmt="' + v + '">' + esc(label) + "</button>"; }

  function fmtFields() {
    if (format === "chat")
      return '<label class="field-label">相談期間</label><select class="field" id="chatDays"><option value="3">3日間</option><option value="7" selected>7日間</option><option value="14">14日間</option></select>';
    if (format === "video")
      return '<label class="field-label">ビデオ通話の長さ</label><select class="field" id="minutes"><option value="30">30分</option><option value="60" selected>60分</option><option value="90">90分</option></select>';
    return '<label class="field-label">月のビデオ回数</label><select class="field" id="monthlyVideos"><option value="0">0回（チャットのみ）</option><option value="1">月1回</option><option value="2" selected>月2回</option><option value="4">月4回</option></select>';
  }

  function bind() {
    document.getElementById("fmt-fields").innerHTML = fmtFields();
    document.getElementById("fmt").addEventListener("click", function (e) {
      var b = e.target.closest("[data-fmt]"); if (!b) return;
      format = b.dataset.fmt;
      document.querySelectorAll("#fmt .seg__item").forEach(function (x) { x.classList.toggle("is-on", x.dataset.fmt === format); });
      document.getElementById("fmt-fields").innerHTML = fmtFields();
    });

    document.getElementById("submit").addEventListener("click", function () {
      var title = document.getElementById("title").value.trim();
      var price = Number(document.getElementById("price").value);
      var desc = document.getElementById("desc").value.trim();
      if (!title) return UI.toast("プラン名を入力してください");
      if (!desc) return UI.toast("内容説明を入力してください");
      if (!price || price < MIN) return UI.toast("料金は" + App.money(MIN) + "以上で設定してください");
      if (price > CAP) return UI.toast("新規出品者の上限は" + App.money(CAP) + "です（解除は申請制）");

      var data = { title: title, format: format, price: price, desc: desc, category: document.getElementById("cat").value };
      if (format === "chat") data.chatDays = Number(document.getElementById("chatDays").value);
      if (format === "video") data.minutes = Number(document.getElementById("minutes").value);
      if (format === "monthly") data.monthlyVideos = Number(document.getElementById("monthlyVideos").value);

      api.createPlan(data).then(function (plan) {
        UI.toast("プランを公開しました");
        setTimeout(function () { App.goto("plans/show.html?id=" + plan.id); }, 500);
      });
    });
  }
})();
