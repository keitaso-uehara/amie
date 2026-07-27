/* S10 マイページ（購入者）
   取引中・契約中・購入履歴・フォロー中・お気に入り・設定。クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  var STATUS = {
    requested: ["承認待ち", "status--progress"], approved: ["承認済み・要支払い", "status--active"],
    progress: ["進行中", "status--progress"], active: ["契約中", "status--active"],
    completed: ["完了", "status--progress"], canceled: ["終了", "status--canceled"], declined: ["見送り", "status--canceled"]
  };
  var ACTIVE = ["requested", "approved", "progress", "active"];
  var pendingAvatar = null;

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    if (!api.getSession()) {
      main.innerHTML = UI.empty("ログインして、あなたのページを。", "ログイン / 新規登録", "login/index.html");
      return;
    }
    Promise.all([api.getMe(), api.getOrders(), api.getFavorites(), api.getFollowing()]).then(function (res) {
      var me = res[0], orders = res[1], favs = res[2], following = res[3];
      main.innerHTML =
        head(me) +
        ordersSection(orders) +
        historySection(orders) +
        followingSection(following) +
        favSection(favs) +
        settings() +
        UI.siteFooter();
      bind(me, orders);
    });
  });

  function head(me) {
    return (
      '<div class="me-head">' + UI.avatar(me, "avatar--lg") +
      '<div class="me-head__body"><p class="me-head__name">' + esc(me.name) + "さん</p>" +
      '<p class="me-head__bio">' + esc(me.bio || "") + "</p></div>" +
      '<button class="btn btn--sm btn--outline" id="edit">編集</button>' +
      "</div>"
    );
  }

  function ordersSection(orders) {
    var active = orders.filter(function (o) { return ACTIVE.indexOf(o.status) !== -1; });
    var inner = active.length
      ? active.map(orderItem).join("")
      : '<p class="lead" style="padding:16px;">進行中の取引はありません。</p>';
    return (
      '<div class="section" style="padding-top:16px;">' +
      '<p class="section__title">取引・契約中</p>' + inner + "</div>"
    );
  }

  function historySection(orders) {
    var past = orders.filter(function (o) { return ["completed", "canceled", "declined"].indexOf(o.status) !== -1; });
    if (!past.length) return '<div class="section hr" id="history-section"><p class="section__title">購入履歴</p><p class="lead" style="padding:4px 0;">まだ履歴はありません。</p></div>';
    return (
      '<div class="section hr" id="history-section">' +
      '<p class="section__title">購入履歴 <span class="muted" style="font-size:13px;font-weight:500;">' + past.length + "件</span></p>" +
      past.map(orderItem).join("") + "</div>"
    );
  }

  function orderItem(o) {
    var c = o.creator || {}, s = STATUS[o.status] || STATUS.progress;
    var review = o.reviewable
      ? '<a class="order-item__review" href="' + h("review/index.html?order=" + o.id) + '">' + UI.icon("star") + " レビューを書く</a>"
      : "";
    var refunded = o.refund ? " ・返金 " + App.money(o.refund.amount) : "";
    return (
      '<div class="order-item">' +
      '<a class="order-item__main" href="' + h("messages/index.html?order=" + o.id) + '">' +
      UI.avatar(c, "avatar--lg") +
      '<div class="order-item__body"><p class="order-item__title">' + esc(o.plan ? o.plan.title : "") + "</p>" +
      '<p class="order-item__meta">' + esc(c.name) + (o.slot ? " ・" + esc(App.slotLabel(o.slot)) : "") + esc(refunded) + "</p></div>" +
      '<span class="status-chip ' + s[1] + '">' + s[0] + "</span></a>" + review +
      "</div>"
    );
  }

  function followingSection(list) {
    if (!list.length) return "";
    var feed = [];
    list.forEach(function (c) { (c.plans || []).forEach(function (p) { feed.push(p); }); });
    feed = feed.slice(0, 8);
    return (
      '<div class="section hr">' +
      '<p class="section__title">フォロー中 <span class="muted" style="font-size:13px;font-weight:500;">' + list.length + "人</span></p>" +
      '<div class="creator-scroll">' + list.map(UI.creatorMini).join("") + "</div>" +
      (feed.length ? '<p class="field-label" style="margin-top:14px;">フォロー中の出品者のプラン</p><div class="plan-scroll">' + feed.map(UI.planCard).join("") + "</div>" : "") +
      "</div>"
    );
  }

  function favSection(favs) {
    var n = favs.plans.length + favs.creators.length;
    return (
      '<div class="section hr" id="fav-section">' +
      '<p class="section__title">お気に入り <span class="muted" style="font-size:13px;font-weight:500;">' + n + "件</span></p>" +
      (n === 0 ? '<p class="lead" style="padding:4px 0;">気になるプランや出品者を♡すると、ここにたまります。</p>' : "") +
      (favs.plans.length ? '<div class="plan-grid">' + favs.plans.map(UI.planCard).join("") + "</div>" : "") +
      (favs.creators.length ? '<div class="stack" style="margin-top:12px;">' + favs.creators.map(UI.creatorCard).join("") + "</div>" : "") +
      "</div>"
    );
  }

  function settings() {
    var items = [
      ["heart", "お気に入り", "scroll:fav-section"],
      ["receipt", "購入履歴", "scroll:history-section"],
      ["user-star", "出品者になる", "sell/index.html"],
      ["settings", "プロフィール設定", "edit"],
      ["logout", "ログアウト", "logout"]
    ];
    return (
      '<div class="section hr" style="padding-left:0;padding-right:0;">' +
      items.map(function (it) {
        var isLink = it[2].indexOf("/") !== -1;
        var href = isLink ? ' href="' + h(it[2]) + '"' : "";
        var tag = isLink ? "a" : "button";
        var attr = isLink ? "" : ' data-action="' + it[2] + '"';
        return "<" + tag + ' class="list-link"' + href + attr + '><span class="list-link__l">' +
          UI.icon(it[0]) + esc(it[1]) + "</span>" + UI.icon("chevron-right") + "</" + tag + ">";
      }).join("") + "</div>"
    );
  }

  function bind(me, orders) {
    var edit = document.getElementById("edit");
    if (edit) edit.addEventListener("click", function () { openEdit(me); });
    document.querySelectorAll("[data-action]").forEach(function (b) {
      b.addEventListener("click", function () {
        var a = b.dataset.action;
        if (a === "edit") openEdit(me);
        else if (a === "logout") api.logout().then(function () { UI.toast("ログアウトしました"); setTimeout(function () { App.goto("index.html"); }, 400); });
        else if (a.indexOf("scroll:") === 0) {
          var el = document.getElementById(a.split(":")[1]);
          if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 12, behavior: "smooth" });
        }
      });
    });
  }

  function openEdit(me) {
    pendingAvatar = null;
    var chips = TAX.concerns.map(function (c) {
      var on = (me.concerns || []).indexOf(c.slug) !== -1 ? " is-on" : "";
      return '<button type="button" class="pill' + on + '" data-concern="' + c.slug + '">#' + esc(c.label) + "</button>";
    }).join("");
    var avatarInner = me.avatar ? '<img src="' + esc(me.avatar) + '" alt="">' : UI.icon("user");
    var ov = UI.openSheet(
      '<p class="sheet__q">プロフィール編集</p>' +
      '<div class="form-row" style="text-align:center;">' +
      '<label class="avatar-pick" id="av-pick">' + avatarInner +
      '<span class="avatar-pick__edit">' + UI.icon("camera") + "</span>" +
      '<input type="file" accept="image/*" id="av-input" hidden></label>' +
      '<p class="field-note" style="text-align:center;">タップして写真を設定</p></div>' +
      '<div class="form-row"><label class="field-label">お名前</label>' +
      '<input class="field" id="ed-name" maxlength="30" value="' + esc(me.name || "") + '"></div>' +
      '<div class="form-row"><label class="field-label">自己紹介</label>' +
      '<textarea class="field field--area" id="ed-bio">' + esc(me.bio || "") + "</textarea></div>" +
      '<div class="form-row"><label class="field-label">気になること（悩みタグ）</label>' +
      '<div class="tag-cloud" id="ed-concerns">' + chips + "</div></div>" +
      '<button class="btn btn--rose btn--block" id="ed-save">保存する</button>'
    );
    var avInput = ov.querySelector("#av-input");
    ov.querySelector("#av-pick").addEventListener("click", function () { avInput.click(); });
    avInput.addEventListener("change", function () {
      var f = this.files && this.files[0];
      if (!f) return;
      if (f.size > 3 * 1024 * 1024) { UI.toast("画像は3MBまでにしてください"); this.value = ""; return; }
      var reader = new FileReader();
      reader.onload = function (e) {
        pendingAvatar = e.target.result;
        ov.querySelector("#av-pick").innerHTML = '<img src="' + pendingAvatar + '" alt=""><span class="avatar-pick__edit">' + UI.icon("camera") + "</span>";
      };
      reader.readAsDataURL(f);
    });
    ov.querySelectorAll("[data-concern]").forEach(function (b) {
      b.addEventListener("click", function () { b.classList.toggle("is-on"); });
    });
    ov.querySelector("#ed-save").addEventListener("click", function () {
      var data = {
        name: ov.querySelector("#ed-name").value.trim(),
        bio: ov.querySelector("#ed-bio").value.trim(),
        concerns: Array.prototype.map.call(ov.querySelectorAll("[data-concern].is-on"), function (b) { return b.dataset.concern; })
      };
      if (pendingAvatar) data.avatar = pendingAvatar;
      api.setProfile(data).then(function () {
        UI.closeSheet(); UI.toast("保存しました");
        setTimeout(function () { location.reload(); }, 400);
      });
    });
  }
})();
