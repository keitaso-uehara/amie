/* A1-A4 運営管理画面（デモ）
   タブ: パトロール(A1) / 通報(A2) / 決済・出金(A3) / CMS(A4)。
   仕様書 5.1 の管理画面。プロトでは代表データ＋操作トースト。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };
  var tab = App.qs("tab") || "patrol";

  document.addEventListener("DOMContentLoaded", render);

  function render() {
    var main = document.getElementById("main");
    main.innerHTML =
      '<div class="page-head"><h1>運営管理</h1><p class="muted" style="font-size:12px;">権限ロール（閲覧／対応／管理者）で保護されています。</p></div>' +
      '<div class="admin-tabs">' +
      atab("patrol", "パトロール") + atab("reports", "通報") + atab("payouts", "決済・出金") + atab("cms", "CMS") +
      "</div><div id="+'"abody"'+"></div>";
    document.querySelectorAll(".admin-tab").forEach(function (t) {
      t.addEventListener("click", function () { tab = t.dataset.tab; render(); });
    });
    load();
  }
  function atab(key, label) {
    return '<button class="admin-tab' + (tab === key ? " is-on" : "") + '" data-tab="' + key + '">' + esc(label) + "</button>";
  }

  function load() {
    var body = document.getElementById("abody");
    if (tab === "patrol") return api.getAdminQueue().then(function (q) { body.innerHTML = patrol(q); wire(body); });
    if (tab === "reports") return api.getAdminReports().then(function (r) { body.innerHTML = reports(r); wire(body); });
    if (tab === "payouts") return api.getAdminPayouts().then(function (p) { body.innerHTML = payouts(p); wire(body); });
    if (tab === "cms") { body.innerHTML = cms(); wire(body); }
  }

  /* A1 出品パトロール */
  function patrol(q) {
    return '<p class="result-count">公開されたプランを事後審査（24時間以内に全件目視）</p>' +
      q.map(function (it) {
        var p = it.plan, c = p.creator || {};
        var flags = [];
        if (it.flagged) flags.push('<span class="admin-flag">高額(5万円超)</span>');
        if (it.newSeller) flags.push('<span class="admin-flag">新規出品者</span>');
        return (
          '<div class="admin-row"><div class="admin-row__body">' +
          '<p class="admin-row__title">' + esc(p.title) + "</p>" +
          '<p class="admin-row__meta">' + esc(c.name) + " ・ " + App.money(p.price) + " " + flags.join("") + "</p></div>" +
          '<div class="admin-row__acts">' +
          '<button class="btn btn--sm btn--ghost" data-toast="承認しました">OK</button>' +
          '<button class="btn btn--sm btn--outline" data-toast="非公開にしました（理由を出品者へ通知）">非公開</button>' +
          "</div></div>"
        );
      }).join("");
  }

  /* A2 通報対応 */
  function reports(list) {
    if (!list.length) return UI.empty("未対応の通報はありません。");
    return list.map(function (r) {
      return (
        '<div class="admin-row"><div class="admin-row__body">' +
        '<p class="admin-row__title">' + esc(r.reason) + "</p>" +
        '<p class="admin-row__meta">' + esc(r.target) + " ・ " + esc(r.date) + '</p></div>' +
        '<div class="admin-row__acts">' +
        '<button class="btn btn--sm btn--ghost" data-toast="取引ログを確認しました">ログ</button>' +
        '<button class="btn btn--sm btn--outline" data-toast="警告を送信しました">警告</button>' +
        '<button class="btn btn--sm btn--outline" data-toast="アカウントを停止しました" style="color:var(--red);border-color:var(--rose-line);">停止</button>' +
        "</div></div>"
      );
    }).join("");
  }

  /* A3 決済・出金 */
  function payouts(list) {
    return '<p class="result-count">出金申請（本人確認と口座名義の一致を確認して承認）</p>' +
      list.map(function (p) {
        var kyc = p.kyc ? '<span class="admin-ok">eKYC済</span>' : '<span class="admin-flag">本人確認未了</span>';
        return (
          '<div class="admin-row"><div class="admin-row__body">' +
          '<p class="admin-row__title">' + esc(p.creator) + " ・ " + App.money(p.amount) + "</p>" +
          '<p class="admin-row__meta">' + kyc + " ・ " + esc(p.status) + "</p></div>" +
          '<div class="admin-row__acts">' +
          (p.kyc
            ? '<button class="btn btn--sm btn--rose" data-toast="出金を承認しました">承認</button>'
            : '<button class="btn btn--sm btn--ghost" data-toast="本人確認を依頼しました">確認依頼</button>') +
          "</div></div>"
        );
      }).join("");
  }

  /* A4 CMS */
  function cms() {
    return (
      '<div class="section" style="padding-top:16px;">' +
      '<p class="section__title" style="font-size:14px;">注目の出品者・特集</p>' +
      '<p class="lead" style="margin-bottom:10px;">TOPの「注目の出品者」掲載枠と特集ページを編成します。</p>' +
      '<button class="btn btn--outline btn--block btn--sm" data-toast="編成を保存しました" style="margin-bottom:20px;">掲載枠を編集</button>' +
      '<p class="section__title" style="font-size:14px;">お知らせ配信</p>' +
      '<input class="field" placeholder="お知らせのタイトル" style="margin-bottom:10px;">' +
      '<textarea class="field field--area" placeholder="本文"></textarea>' +
      '<button class="btn btn--rose btn--block" data-toast="お知らせを配信しました" style="margin-top:12px;">配信する</button>' +
      "</div>"
    );
  }

  function wire(scope) {
    scope.querySelectorAll("[data-toast]").forEach(function (b) {
      b.addEventListener("click", function () { UI.toast(b.dataset.toast); });
    });
  }
})();
