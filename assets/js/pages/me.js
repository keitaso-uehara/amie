/* S10 マイページ（購入者）
   取引中・契約中の月額・お気に入り・設定。クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  var STATUS = { progress: ["進行中", "status--progress"], active: ["契約中", "status--active"], canceled: ["終了", "status--canceled"] };

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    if (!api.getSession()) {
      main.innerHTML = UI.empty("ログインして、あなたのページを。", "ログイン / 新規登録", "login/index.html");
      return;
    }
    Promise.all([api.getMe(), api.getOrders(), api.getFavorites()]).then(function (res) {
      var me = res[0], orders = res[1], favs = res[2];
      main.innerHTML =
        head(me) +
        ordersSection(orders) +
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
    var active = orders.filter(function (o) { return o.status !== "canceled"; });
    var inner = active.length
      ? active.map(orderItem).join("")
      : '<p class="lead" style="padding:16px;">進行中の取引はありません。</p>';
    return (
      '<div class="section" style="padding-top:16px;">' +
      '<p class="section__title">取引・契約中</p>' + inner + "</div>"
    );
  }
  function orderItem(o) {
    var c = o.creator || {}, s = STATUS[o.status] || STATUS.progress;
    return (
      '<a class="order-item" href="' + h("messages/index.html?order=" + o.id) + '">' +
      UI.avatar(c, "avatar--lg") +
      '<div class="order-item__body"><p class="order-item__title">' + esc(o.plan ? o.plan.title : "") + "</p>" +
      '<p class="order-item__meta">' + esc(c.name) + (o.slot ? " ・" + esc(o.slot) : "") + "</p></div>" +
      '<span class="status-chip ' + s[1] + '">' + s[0] + "</span></a>"
    );
  }

  function favSection(favs) {
    var n = favs.plans.length + favs.creators.length;
    if (!n) return "";
    return (
      '<div class="section hr">' +
      '<p class="section__title">お気に入り <span class="muted" style="font-size:13px;font-weight:500;">' + n + "件</span></p>" +
      (favs.plans.length ? '<div class="plan-grid">' + favs.plans.map(UI.planCard).join("") + "</div>" : "") +
      (favs.creators.length ? '<div class="stack" style="margin-top:12px;">' + favs.creators.map(UI.creatorCard).join("") + "</div>" : "") +
      "</div>"
    );
  }

  function settings() {
    var items = [
      ["heart", "お気に入り", null],
      ["receipt", "購入履歴", null],
      ["user-star", "出品者になる", "dashboard/index.html"],
      ["settings", "設定", null],
      ["logout", "ログアウト", "logout"]
    ];
    return (
      '<div class="section hr" style="padding-left:0;padding-right:0;">' +
      items.map(function (it) {
        var href = it[2] && it[2] !== "logout" ? ' href="' + h(it[2]) + '"' : "";
        var tag = href ? "a" : "button";
        var act = it[2] === "logout" ? ' id="logout"' : "";
        return "<" + tag + ' class="list-link"' + href + act + '><span class="list-link__l">' +
          UI.icon(it[0]) + esc(it[1]) + "</span>" + UI.icon("chevron-right") + "</" + tag + ">";
      }).join("") + "</div>"
    );
  }

  function bind(me, orders) {
    var edit = document.getElementById("edit");
    if (edit) edit.addEventListener("click", function () { openEdit(me); });
    var out = document.getElementById("logout");
    if (out) out.addEventListener("click", function () {
      api.logout().then(function () { UI.toast("ログアウトしました"); setTimeout(function () { App.goto("index.html"); }, 400); });
    });
  }

  function openEdit(me) {
    var chips = TAX.concerns.map(function (c) {
      var on = (me.concerns || []).indexOf(c.slug) !== -1 ? " is-on" : "";
      return '<button type="button" class="pill' + on + '" data-concern="' + c.slug + '">#' + esc(c.label) + "</button>";
    }).join("");
    var ov = UI.openSheet(
      '<p class="sheet__q">プロフィール編集</p>' +
      '<div class="form-row"><label class="field-label">自己紹介</label>' +
      '<textarea class="field field--area" id="ed-bio">' + esc(me.bio || "") + "</textarea></div>" +
      '<div class="form-row"><label class="field-label">気になること（悩みタグ）</label>' +
      '<div class="tag-cloud" id="ed-concerns">' + chips + "</div></div>" +
      '<button class="btn btn--rose btn--block" id="ed-save">保存する</button>'
    );
    ov.querySelectorAll("[data-concern]").forEach(function (b) {
      b.addEventListener("click", function () { b.classList.toggle("is-on"); });
    });
    ov.querySelector("#ed-save").addEventListener("click", function () {
      var bio = ov.querySelector("#ed-bio").value.trim();
      var concerns = Array.prototype.map.call(ov.querySelectorAll("[data-concern].is-on"), function (b) { return b.dataset.concern; });
      api.setProfile({ bio: bio, concerns: concerns }).then(function () {
        UI.closeSheet(); UI.toast("保存しました");
        setTimeout(function () { location.reload(); }, 400);
      });
    });
  }
})();
