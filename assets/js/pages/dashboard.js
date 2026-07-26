/* S11 出品者ダッシュボード
   プロトでは出品者 c001(MOEKA) を「あなた」として売上・取引・プラン・宣伝リンク・上限を表示。
   手数料20%(仕様書 8.2)で受取額を算出。将来は自分の出品者アカウントに紐づく。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };
  var FEE = 0.20;  // 販売手数料(税抜20%)

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    if (!api.getSession()) { main.innerHTML = UI.empty("ログインすると出品者ダッシュボードが使えます。", "ログイン", "login/index.html"); return; }
    Promise.all([
      api.getMySeller(), api.getMyPlans(), api.getSellerBalance(),
      api.getSellerOrders(), api.getPayouts(), api.getFeaturedCreators(1)
    ]).then(function (res) {
      var mySeller = res[0], myPlans = res[1] || [], bal = res[2] || { available: 0, pending: 0 };
      var sellerOrders = res[3] || [], payouts = res[4] || [], top = res[5] || [];
      if (!mySeller) { main.innerHTML = notSellerYet() + UI.siteFooter(); return; }
      var sampleP = top[0] ? api.getCreator(top[0].id) : Promise.resolve(null);
      Promise.all([sampleP, api.getReferralStats(mySeller.handle)]).then(function (r2) {
        var sample = r2[0] || { plans: [], stats: { rating: 0 }, name: "", handle: "creator" };
        var refStats = r2[1] || { visits: 0, purchases: 0, cvr: 0 };
        main.innerHTML =
          head(mySeller, bal) +
          cards(mySeller, bal, sellerOrders) +
          approvalSection(mySeller) +
          payoutSection(bal, payouts) +
          bookingsSection(sellerOrders) +
          limitBox() +
          myPlansSection(myPlans, mySeller) +
          sampleSection(sample) +
          promoSection(mySeller, myPlans, refStats) +
          UI.siteFooter();
        bind(mySeller, bal);
      });
    });
  });

  /* 自分の出品プラン(S12で作成したもの) */
  function myPlansSection(myPlans, mySeller) {
    var inner = myPlans.length
      ? '<div class="plan-list">' + myPlans.map(UI.planCard).join("") + "</div>"
      : '<p class="lead">まだ出品プランがありません。最初のプランを作ってみましょう。</p>';
    return (
      '<div class="section">' +
      '<p class="section__title">あなたの出品プラン' +
      '<a class="more" href="' + h("plans/new.html") + '">＋ 新規出品</a></p>' +
      (mySeller ? '<div class="dash-limit" style="background:var(--cream);color:var(--ink-soft);">' + UI.icon("user") +
        " 出品者プロフィール：" + esc(mySeller.name) +
        ' <button class="btn btn--sm btn--outline" id="edit-seller" style="margin-left:8px;">編集</button></div>' : "") +
      inner + "</div>"
    );
  }

  /* まだ出品者プロフィールが無い場合の入口 */
  function notSellerYet() {
    return (
      '<div class="section" style="padding-top:28px;text-align:center;">' +
      '<div class="onb-done__badge" style="margin:8px auto 16px;">' + UI.icon("sparkles") + "</div>" +
      '<p class="onb-h" style="text-align:center;">まだ出品者ではありません</p>' +
      '<p class="lead" style="margin-bottom:18px;">プロフィールと最初のプランを作れば、今日から出品できます。登録は無料、手数料は売れた時だけ。</p>' +
      '<a class="btn btn--rose btn--block" href="' + h("sell/index.html") + '">出品者になる（無料）</a>' +
      "</div>"
    );
  }

  function head(seller, bal) {
    return (
      '<div class="dash-head">' +
      '<p class="dash-head__label">' + UI.icon("sparkles") + " 出品者ダッシュボード</p>" +
      '<p class="dash-sales">' + App.money(bal.available) + "<small>" + esc(seller.name) + "さんの受取可能額</small></p>" +
      '<p class="dash-head__label" style="margin-top:6px;">確定待ち ' + App.money(bal.pending) + "（取引完了後に受取可能・手数料20%控除後）</p>" +
      "</div>"
    );
  }

  function cards(seller, bal, orders) {
    var active = orders.filter(function (o) { return o.status === "progress" || o.status === "active"; }).length;
    var pendingReq = orders.filter(function (o) { return o.status === "requested"; }).length;
    var rating = seller.stats && seller.stats.rating ? seller.stats.rating : "—";
    return (
      '<div class="dash-cards">' +
      card(App.money(bal.pending), "確定待ち(エスクロー)") +
      card(String(active), "取引中") +
      card(String(pendingReq), "承認待ち") +
      card(rating, "平均評価") +
      "</div>"
    );
  }

  /* リクエスト承認制のON/OFF（買い手を選べる安全弁。ビデオ相談の安心確保） */
  function approvalSection(seller) {
    var on = !!seller.approvalRequired;
    return (
      '<div class="section hr">' +
      '<p class="section__title">相談の受け方</p>' +
      '<div class="approval-toggle">' +
      '<div class="approval-toggle__text"><p class="approval-toggle__t">リクエスト承認制</p>' +
      '<p class="approval-toggle__d">ONにすると購入は「リクエスト」になり、あなたが承認した人だけがお支払いに進みます。相手を選べるので、ビデオ相談の安心につながります。</p></div>' +
      '<button class="switch' + (on ? " is-on" : "") + '" id="approval-switch" type="button" role="switch" aria-checked="' + on + '"><span class="switch__dot"></span></button>' +
      "</div>" +
      '<p class="field-note">' + (on ? "現在：承認した人だけが購入できます。" : "現在：誰でもすぐに購入できます（即予約）。") + "</p>" +
      "</div>"
    );
  }
  function card(v, l) { return '<div class="dash-card"><p class="dash-card__v">' + esc(String(v)) + '</p><p class="dash-card__l">' + esc(l) + "</p></div>"; }

  /* 出金（受取可能額・出金申請・売上明細CSV/PDF・履歴） */
  function payoutSection(bal, payouts) {
    var canWithdraw = bal.available > 0;
    var hist = payouts.length
      ? '<div class="payout-hist">' + payouts.slice(0, 3).map(function (w) {
          return '<div class="payout-hist__row"><span>' + esc(w.date) + (w.express ? " ・お急ぎ" : "") + "</span><span>" + App.money(w.net) + "（" + esc(w.eta) + "着金）</span></div>";
        }).join("") + "</div>"
      : "";
    return (
      '<div class="section hr">' +
      '<p class="section__title">出金</p>' +
      '<div class="payout-box">' +
      '<p class="payout-box__amt">' + App.money(bal.available) + "<small>受取可能額</small></p>" +
      '<button class="btn btn--gold btn--block" id="withdraw"' + (canWithdraw ? "" : " disabled") + ">出金を申請する</button>" +
      (canWithdraw ? "" : '<p class="field-note" style="text-align:center;">取引が完了すると出金できます。</p>') +
      "</div>" +
      '<div class="stack2" style="margin-top:12px;">' +
      '<button class="btn btn--outline btn--sm" id="csv">' + UI.icon("download") + " 売上明細CSV</button>" +
      '<button class="btn btn--outline btn--sm" id="pdf">' + UI.icon("file-text") + " 明細PDF</button>" +
      "</div>" + hist +
      "</div>"
    );
  }

  /* 予約・取引の管理（出品者として。中止＝全額返金／完了） */
  function bookingsSection(orders) {
    if (!orders.length) return "";
    var LABEL = { requested: "承認待ち", approved: "確定待ち", progress: "進行中", active: "契約中", completed: "完了", canceled: "返金済み", declined: "見送り" };
    return (
      '<div class="section hr">' +
      '<p class="section__title">予約・取引の管理</p>' +
      orders.map(function (o) {
        var acts = "";
        if (o.status === "requested") {
          acts += '<button class="btn btn--sm btn--rose" data-approve="' + esc(o.id) + '">承認する</button>';
          acts += '<button class="btn btn--sm btn--ghost" data-decline="' + esc(o.id) + '">お断り</button>';
        }
        if (o.format === "video" && o.status === "progress" && o.slot) acts += '<button class="btn btn--sm btn--outline" data-sresched="' + esc(o.id) + '">日時を変更</button>';
        if (o.format === "video" && o.status === "progress" && o.slot) acts += '<button class="btn btn--sm btn--outline" data-ics="' + esc(o.id) + '">カレンダー</button>';
        if (o.status === "progress" && o.format !== "monthly") acts += '<button class="btn btn--sm btn--outline" data-scomplete="' + esc(o.id) + '">完了にする</button>';
        if (o.status === "progress" || o.status === "active") acts += '<button class="btn btn--sm btn--ghost" data-cancel="' + esc(o.id) + '">中止（全額返金）</button>';
        var intake = (o.intake && o.intake.topic)
          ? '<p class="admin-row__intake">' + UI.icon("message-2") + " " + esc(o.intake.topic) + (o.intake.note ? "（" + esc(o.intake.note) + "）" : "") + "</p>"
          : "";
        return (
          '<div class="admin-row"><div class="admin-row__body">' +
          '<p class="admin-row__title">' + esc(o.plan ? o.plan.title : "(プラン)") + "</p>" +
          '<p class="admin-row__meta">' + esc(LABEL[o.status] || o.status) +
          (o.slot ? " ・" + esc(App.slotLabel(o.slot)) : "") + " ・" + App.money(o.price) + "</p>" +
          intake + "</div>" +
          '<div class="admin-row__acts">' + acts + "</div></div>"
        );
      }).join("") +
      "</div>"
    );
  }

  function limitBox() {
    return (
      '<div class="dash-limit">' + UI.icon("shield-check") +
      " 現在の価格上限：<b>10万円</b>（本人確認と取引実績で解除できます）" +
      '<button class="btn btn--sm btn--gold" id="limit" style="margin-top:10px;">上限解除を申請する</button></div>'
    );
  }

  function sampleSection(c) {
    if (!c.plans || !c.plans.length) return "";
    return (
      '<div class="section hr">' +
      '<p class="section__title">参考：人気出品者の実績' + (c.name ? "（" + esc(c.name) + "さん）" : "") + "</p>" +
      '<p class="lead" style="margin-bottom:10px;">売れている出品者のプランと数字です。あなたのプラン作りの参考に。</p>' +
      '<div class="plan-list">' + c.plans.map(function (p) {
        return '<div style="position:relative;">' + UI.planCard(p) +
          '<p class="field-note" style="padding:0 4px 8px;">閲覧 ' + (p.stats.sales * 6) + " ・ 購入 " + p.stats.sales + "</p></div>";
      }).join("") + "</div></div>"
    );
  }

  function promoSection(seller, myPlans, ref) {
    var planLinks = (myPlans || []).map(function (p) {
      return '<div class="share-row"><span class="share-row__t">' + UI.icon("link") + " " + esc(p.title) + "</span>" +
        '<button class="btn btn--sm btn--outline" data-copyplan="' + esc(p.id) + '">' + UI.icon("share") + " シェア</button></div>";
    }).join("");
    return (
      '<div class="section hr">' +
      '<p class="section__title">シェアして集客</p>' +
      '<p class="lead" style="margin-bottom:12px;">SNSのプロフィールやストーリーズに貼るだけ。タップした人は<b>そのまま相談を購入</b>できます（登録は購入時でOK）。</p>' +
      '<div class="share-row"><span class="share-row__t">' + UI.icon("user") + " プロフィール（全プランを表示）</span>" +
      '<button class="btn btn--sm btn--rose" id="copy-profile">' + UI.icon("share") + " シェア</button></div>" +
      (planLinks ? '<p class="field-label" style="margin-top:14px;">プランごとの購入リンク（ストーリーズ向け）</p><div class="share-list">' + planLinks + "</div>" : "") +
      '<p class="field-label" style="margin-top:16px;">このリンクの成果</p>' +
      '<div class="stat-row">' +
      UI.statTile("リンク表示", String(ref.visits), "") +
      UI.statTile("経由の購入", String(ref.purchases), "件") +
      UI.statTile("転換率", ref.visits ? String(ref.cvr) : "—", ref.visits ? "%" : "") +
      "</div></div>"
    );
  }

  function bind(mySeller, bal) {
    var handle = mySeller.handle || "you";
    var toastShare = function (r, copiedMsg) { if (r === "copied") UI.toast(copiedMsg); else if (r === "shared") UI.toast("シェアしました"); };
    var cp = document.getElementById("copy-profile");
    if (cp) cp.addEventListener("click", function () {
      App.share({ text: mySeller.name + "さんに相談できます", url: App.absUrl("creators/show.html?id=" + mySeller.id) })
        .then(function (r) { toastShare(r, "プロフィールのリンクをコピーしました"); })
        .catch(function () { UI.toast("できませんでした"); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-copyplan]"), function (b) {
      b.addEventListener("click", function () {
        var url = App.absUrl("checkout/index.html?plan=" + b.dataset.copyplan + "&ref=" + handle);
        App.share({ text: "相談を予約できます", url: url })
          .then(function (r) { toastShare(r, "購入リンクをコピーしました"); })
          .catch(function () { UI.toast("できませんでした"); });
      });
    });
    var lm = document.getElementById("limit");
    if (lm) lm.addEventListener("click", function () { UI.toast("本人確認（eKYC）を開始します。確認後、価格上限が解除されます。"); });
    var es = document.getElementById("edit-seller");
    if (es) es.addEventListener("click", function () { openSellerEdit(mySeller); });
    var wb = document.getElementById("withdraw");
    if (wb) wb.addEventListener("click", function () { openWithdraw(bal); });
    var csv = document.getElementById("csv");
    if (csv) csv.addEventListener("click", downloadCSV);
    var pdf = document.getElementById("pdf");
    if (pdf) pdf.addEventListener("click", openStatementPDF);
    var asw = document.getElementById("approval-switch");
    if (asw) asw.addEventListener("click", function () {
      var next = !asw.classList.contains("is-on");
      api.setMySeller({ approvalRequired: next }).then(function () {
        UI.toast(next ? "リクエスト承認制をONにしました" : "即予約（承認なし）に戻しました");
        setTimeout(function () { location.reload(); }, 500);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-approve]"), function (b) {
      b.addEventListener("click", function () {
        api.approveRequest(b.dataset.approve).then(function () { UI.toast("承認しました。購入者がお支払いに進めます"); setTimeout(function () { location.reload(); }, 700); });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-decline]"), function (b) {
      b.addEventListener("click", function () { declineBooking(b.dataset.decline); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-cancel]"), function (b) {
      b.addEventListener("click", function () { sellerCancel(b.dataset.cancel); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-scomplete]"), function (b) {
      b.addEventListener("click", function () {
        api.completeOrder(b.dataset.scomplete).then(function () { UI.toast("完了にしました"); setTimeout(function () { location.reload(); }, 500); });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-sresched]"), function (b) {
      b.addEventListener("click", function () { sellerReschedule(b.dataset.sresched); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-ics]"), function (b) {
      b.addEventListener("click", function () {
        api.getOrder(b.dataset.ics).then(function (o) {
          if (!o) return;
          App.downloadICS({ title: "ELLMIE ビデオ相談・" + (o.plan ? o.plan.title : ""), start: o.slot, minutes: o.minutes || (o.plan && o.plan.minutes) || 60, desc: o.plan ? o.plan.title : "" });
          UI.toast("カレンダー用ファイルを書き出しました");
        });
      });
    });
  }

  /* 出品者からの日時変更（購入者に通知・回数制限なし） */
  function sellerReschedule(orderId) {
    api.getOrder(orderId).then(function (o) {
      if (!o) return;
      var slots = (o.plan && o.plan.slots) || [];
      var booked = (o.plan && o.plan.bookedSlots) || [];
      var avail = slots.filter(function (v) { return booked.indexOf(v) === -1; });
      if (!avail.length) { UI.toast("空き枠がありません。プランに枠を追加してください。"); return; }
      var ov = UI.openSheet(
        '<p class="sheet__q">予約日時を変更（出品者）</p>' +
        '<p class="lead" style="margin-bottom:14px;">購入者に変更が通知されます。新しい枠を選んでください。</p>' +
        '<div class="slot-grid">' + avail.map(function (v) {
          var parts = App.slotLabel(v).split(" ");
          return '<button class="slot" type="button" data-slot="' + esc(v) + '">' + esc(parts[0]) + "<small>" + esc(parts[1] || "") + "</small></button>";
        }).join("") + "</div>"
      );
      Array.prototype.forEach.call(ov.querySelectorAll("[data-slot]"), function (b) {
        b.addEventListener("click", function () {
          api.rescheduleOrder(orderId, b.dataset.slot, { by: "seller" }).then(function () {
            UI.closeSheet(); UI.toast("日時を変更しました（購入者に通知）");
            setTimeout(function () { location.reload(); }, 500);
          });
        });
      });
    });
  }

  /* 出金申請（通常／お急ぎ3営業日+3%） */
  function openWithdraw(bal) {
    var ov = UI.openSheet(
      '<p class="sheet__q">出金を申請</p>' +
      '<p class="lead" style="margin-bottom:14px;">受取可能額 <b>' + App.money(bal.available) + "</b> から出金します。振込先の口座は設定済みが前提です。</p>" +
      '<label class="field-label">金額</label><input class="field" id="w-amt" type="number" inputmode="numeric" value="' + bal.available + '" max="' + bal.available + '">' +
      '<label class="consent" style="margin-top:14px;"><input type="checkbox" id="w-exp"><span>お急ぎ振込（申請から3営業日以内・手数料+3%）</span></label>' +
      '<button class="btn btn--gold btn--block" id="w-go" style="margin-top:14px;">申請する</button>'
    );
    ov.querySelector("#w-go").addEventListener("click", function () {
      var amt = Number(ov.querySelector("#w-amt").value);
      var exp = ov.querySelector("#w-exp").checked;
      if (!amt || amt < 1) return UI.toast("金額を入力してください");
      if (amt > bal.available) return UI.toast("受取可能額を超えています");
      api.requestPayout(amt, exp).then(function (r) {
        UI.closeSheet();
        UI.toast("出金を申請しました（受取 " + App.money(r.net) + (r.fee ? "・手数料 " + App.money(r.fee) : "") + "）");
        setTimeout(function () { location.reload(); }, 700);
      });
    });
  }

  /* 売上明細CSV（Excel対応BOM付き・確定申告用） */
  function downloadCSV() {
    api.getSalesRows().then(function (rows) {
      if (!rows.length) { UI.toast("明細がありません"); return; }
      var head = ["日付", "プラン", "形式", "売上(税込)", "手数料", "受取", "状態"];
      var lines = [head.join(",")].concat(rows.map(function (r) {
        return [r.date, '"' + String(r.title).replace(/"/g, '""') + '"', r.format, r.gross, r.fee, r.net, r.status].join(",");
      }));
      var csv = "﻿" + lines.join("\r\n");
      var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "ELLMIE_売上明細.csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      UI.toast("CSVをダウンロードしました");
    });
  }

  /* 売上明細PDF（印刷ダイアログ→PDF保存。宛名入り・支払調書なし明記） */
  function openStatementPDF() {
    Promise.all([api.getSalesRows(), api.getMySeller()]).then(function (res) {
      var rows = res[0], seller = res[1] || {};
      if (!rows.length) { UI.toast("明細がありません"); return; }
      var tot = rows.reduce(function (s, r) { return { gross: s.gross + r.gross, fee: s.fee + r.fee, net: s.net + r.net }; }, { gross: 0, fee: 0, net: 0 });
      var html =
        '<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>売上明細書 - ELLMIE</title>' +
        "<style>body{font-family:'Hiragino Sans',sans-serif;padding:32px;color:#2b2320;}h1{font-size:20px;margin:0 0 4px;}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left;}.n{text-align:right;}.tot td{font-weight:700;border-top:2px solid #999;}.note{margin-top:16px;font-size:12px;color:#888;}</style></head><body>" +
        "<h1>売上明細書</h1><p>宛名：" + esc(seller.name || "") + " 様　／　発行：ELLMIE</p>" +
        '<table><thead><tr><th>日付</th><th>プラン</th><th>形式</th><th class="n">売上(税込)</th><th class="n">手数料</th><th class="n">受取</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return "<tr><td>" + esc(r.date) + "</td><td>" + esc(r.title) + "</td><td>" + esc(r.format) + '</td><td class="n">' + App.money(r.gross) + '</td><td class="n">' + App.money(r.fee) + '</td><td class="n">' + App.money(r.net) + "</td></tr>";
        }).join("") +
        '<tr class="tot"><td colspan="3">合計</td><td class="n">' + App.money(tot.gross) + '</td><td class="n">' + App.money(tot.fee) + '</td><td class="n">' + App.money(tot.net) + "</td></tr>" +
        '</tbody></table><p class="note">※ 支払調書は発行されません（源泉徴収なし・事業所得としてご申告ください）。</p>' +
        "<scr" + "ipt>window.onload=function(){window.print();}</scr" + "ipt></body></html>";
      var w = window.open("", "_blank");
      if (!w) { UI.toast("ポップアップを許可してください"); return; }
      w.document.write(html); w.document.close();
    });
  }

  /* リクエストのお断り（未請求のまま終了・定型のおわびを送信） */
  function declineBooking(orderId) {
    var ov = UI.openSheet(
      '<p class="sheet__q">このリクエストをお断りしますか？</p>' +
      '<p class="lead" style="margin-bottom:18px;">購入者へ定型のおわびが送られ、請求は発生しません。断った理由は相手には表示されません。</p>' +
      '<button class="btn btn--rose btn--block" id="dc-go">お断りする（未請求）</button>' +
      '<button class="btn btn--ghost btn--block" id="dc-no" style="margin-top:10px;">やめる</button>'
    );
    ov.querySelector("#dc-go").addEventListener("click", function () {
      api.declineRequest(orderId, {}).then(function () { UI.closeSheet(); UI.toast("お断りしました（未請求）"); setTimeout(function () { location.reload(); }, 700); });
    });
    ov.querySelector("#dc-no").addEventListener("click", UI.closeSheet);
  }

  /* 出品者都合の中止（全額返金） */
  function sellerCancel(orderId) {
    var ov = UI.openSheet(
      '<p class="sheet__q">この取引を中止しますか？</p>' +
      '<p class="lead" style="margin-bottom:18px;">出品者都合の中止です。購入者へ全額返金し、おわびの通知が送られます。</p>' +
      '<button class="btn btn--rose btn--block" id="sc-go">中止して全額返金</button>' +
      '<button class="btn btn--ghost btn--block" id="sc-no" style="margin-top:10px;">やめる</button>'
    );
    ov.querySelector("#sc-go").addEventListener("click", function () {
      api.cancelOrder(orderId, { by: "seller" }).then(function () { UI.closeSheet(); UI.toast("中止し、全額返金しました"); setTimeout(function () { location.reload(); }, 600); });
    });
    ov.querySelector("#sc-no").addEventListener("click", UI.closeSheet);
  }

  /* S15 出品者プロフィール編集 */
  function openSellerEdit(seller) {
    seller = seller || {};
    var cats = TAX.categories.map(function (c) {
      var on = (seller.categories || []).indexOf(c.slug) !== -1 ? " is-on" : "";
      return '<button type="button" class="pill' + on + '" data-cat="' + c.slug + '">' + esc(c.label) + "</button>";
    }).join("");
    var s = seller.sns || {};
    var ov = UI.openSheet(
      '<p class="sheet__q">出品者プロフィール編集</p>' +
      '<div class="form-row"><label class="field-label">表示名</label><input class="field" id="s-name" value="' + esc(seller.name || "") + '"></div>' +
      '<div class="form-row"><label class="field-label">ひとこと</label><input class="field" id="s-tag" value="' + esc(seller.tagline || "") + '" placeholder="例）垢抜けメイクの伝道師"></div>' +
      '<div class="form-row"><label class="field-label">自己紹介・経歴</label><textarea class="field field--area" id="s-bio">' + esc(seller.bio || "") + "</textarea></div>" +
      '<div class="form-row"><label class="field-label">カテゴリ（最大3）</label><div class="tag-cloud" id="s-cats">' + cats + "</div></div>" +
      '<div class="form-row"><label class="field-label">メインカテゴリ <span class="muted">（一覧はこの1つで表示・2重表示を防止）</span></label>' +
      '<select class="field" id="s-main">' + mainOptions(seller.categories || [], seller.mainCategory) + "</select></div>" +
      '<div class="form-row"><label class="field-label">SNS連携（フォロワー数）</label>' +
      '<input class="field" id="s-ig" type="number" inputmode="numeric" placeholder="Instagram フォロワー数" value="' + (s.instagram || "") + '" style="margin-bottom:8px;">' +
      '<input class="field" id="s-tt" type="number" inputmode="numeric" placeholder="TikTok フォロワー数" value="' + (s.tiktok || "") + '">' +
      '<p class="field-note">入力したフォロワー数はプロフィールに表示されます。SNS連携で認証バッジを取得できます。</p></div>' +
      '<button class="btn btn--rose btn--block" id="s-save">保存する</button>'
    );
    ov.querySelectorAll("[data-cat]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!b.classList.contains("is-on") && ov.querySelectorAll("[data-cat].is-on").length >= 3) { UI.toast("カテゴリは最大3つまでです"); return; }
        b.classList.toggle("is-on");
        var onCats = Array.prototype.map.call(ov.querySelectorAll("[data-cat].is-on"), function (x) { return x.dataset.cat; });
        var main = ov.querySelector("#s-main");
        main.innerHTML = mainOptions(onCats, onCats.indexOf(main.value) !== -1 ? main.value : onCats[0]);
      });
    });
    ov.querySelector("#s-save").addEventListener("click", function () {
      var sns = {};
      var ig = Number(ov.querySelector("#s-ig").value); if (ig) sns.instagram = ig;
      var tt = Number(ov.querySelector("#s-tt").value); if (tt) sns.tiktok = tt;
      api.setMySeller({
        name: ov.querySelector("#s-name").value.trim() || "あなた",
        tagline: ov.querySelector("#s-tag").value.trim(),
        bio: ov.querySelector("#s-bio").value.trim(),
        categories: Array.prototype.map.call(ov.querySelectorAll("[data-cat].is-on"), function (b) { return b.dataset.cat; }),
        mainCategory: ov.querySelector("#s-main").value || null,
        sns: sns
      }).then(function () {
        UI.closeSheet(); UI.toast("保存しました");
        setTimeout(function () { location.reload(); }, 400);
      });
    });
  }

  /* メインカテゴリの選択肢（選んだカテゴリの中から） */
  function mainOptions(catSlugs, selected) {
    if (!catSlugs.length) return '<option value="">先にカテゴリを選択してください</option>';
    return catSlugs.map(function (slug) {
      var t = TAX.categories.filter(function (c) { return c.slug === slug; })[0];
      return '<option value="' + slug + '"' + (slug === selected ? " selected" : "") + ">" + esc(t ? t.label : slug) + "</option>";
    }).join("");
  }
})();
