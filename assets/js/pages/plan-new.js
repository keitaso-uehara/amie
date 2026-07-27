/* S12 プラン作成・編集
   形式→内容→価格。価格ルール(仕様書 4.5): 最低1,000円、新規出品者は上限10万円。
   作成後は実データとして検索・出品者詳細に出現する。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };
  var MIN = 1000, CAP = 100000;   // 4.5 価格ルール
  var format = "chat";
  var slots = [];   // ビデオの予約可能枠(datetime-local文字列)
  var thumb = null; // サムネイル画像(dataURL)
  var editing = null; // 編集中プラン(?id=)。null=新規

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    if (!api.getSession()) { App.goto("login/index.html?next=" + encodeURIComponent("plans/new.html")); return; }
    var id = App.qs("id");
    if (id) {
      api.getMyPlans().then(function (plans) {
        var p = plans.filter(function (x) { return x.id === id; })[0];
        if (!p) { main.innerHTML = UI.empty("プランが見つかりませんでした。", "ダッシュボードへ", "dashboard/index.html"); return; }
        editing = p; format = p.format; slots = (p.slots || []).slice(); thumb = p.thumb || null;
        main.innerHTML = form(p); bind(p);
      });
    } else {
      main.innerHTML = form(); bind();
    }
  });

  function form(p) {
    var cats = TAX.categories.map(function (c) { return '<option value="' + c.slug + '"' + (p && p.category === c.slug ? " selected" : "") + ">" + esc(c.label) + "</option>"; }).join("");
    return (
      '<div class="section">' +
      '<p class="section__title">' + (editing ? "プランを編集" : "プランを作成") + "</p>" +

      '<div class="form-row"><label class="field-label">提供形式</label>' +
      '<div class="seg" id="fmt">' +
      seg("chat", "チャット単発") + seg("video", "単発ビデオ") + seg("monthly", "月額メンター") +
      "</div></div>" +

      '<div class="form-row"><label class="field-label">プラン名</label>' +
      '<input class="field" id="title" maxlength="60" placeholder="例）あなた専用・垢抜けメイクレッスン" value="' + (p ? esc(p.title) : "") + '"></div>' +

      '<div class="form-row"><label class="field-label">カテゴリ</label>' +
      '<select class="field" id="cat">' + cats + "</select></div>" +

      thumbPickerRow() +

      '<div class="form-row" id="fmt-fields"></div>' +

      '<div class="form-row"><label class="field-label">料金（税込）</label>' +
      '<input class="field" id="price" type="number" inputmode="numeric" min="1000" placeholder="3000" value="' + (p ? esc(String(p.price)) : "") + '">' +
      '<p class="field-note">最低1,000円・上限10万円（本人確認と実績で解除できます）。月額は1ヶ月あたりの金額です。</p></div>' +

      '<div class="form-row"><label class="field-label">内容説明</label>' +
      '<textarea class="field field--area" id="desc" maxlength="2000" placeholder="こんな人におすすめ / 進め方 / 注意事項">' + (p ? esc(p.desc) : "") + "</textarea></div>" +

      '<div class="notice-box" style="background:var(--cream);color:var(--ink-soft);">' + UI.icon("info-circle") +
      " 公開後は運営が内容を確認します（事後パトロール）。禁止事項は" + '<a href="' + h("guide.html") + '" style="color:var(--rose-deep);">出品者ガイド</a>をご確認ください。</div>' +

      '<button class="btn btn--rose btn--block" id="submit">' + (editing ? "更新する" : "公開する") + "</button>" +
      "</div>"
    );
  }
  function seg(v, label) { return '<button type="button" class="seg__item' + (v === format ? " is-on" : "") + '" data-fmt="' + v + '">' + esc(label) + "</button>"; }

  /* サムネイル選択（ココナラ/ランサーズ式・任意） */
  function thumbPickerRow() {
    return (
      '<div class="form-row"><label class="field-label">サムネイル画像 <span class="muted">（任意・16:9推奨）</span></label>' +
      '<label class="thumb-pick"><input type="file" accept="image/*" id="thumb-input" hidden>' +
      '<div class="thumb-pick__empty" id="thumb-empty">' + UI.icon("photo-plus") + "<span>画像を選ぶ</span></div>" +
      '<img class="thumb-pick__img" id="thumb-preview" alt="" hidden>' +
      '<span class="thumb-pick__change" id="thumb-change" hidden>' + UI.icon("photo-edit") + " 変更</span>" +
      "</label>" +
      '<p class="field-note">プランの一覧・詳細に表示されます。未設定なら形式に合わせた背景になります。</p></div>'
    );
  }

  function fmtFields() {
    if (format === "chat")
      return '<label class="field-label">相談できる期間</label>' +
        '<select class="field" id="chatDays"><option value="1">1日（24時間）</option><option value="2">2日間</option><option value="3" selected>3日間</option><option value="custom">任意で指定</option></select>' +
        '<div id="chatDays-custom" hidden style="margin-top:8px;"><div class="dur-custom"><input class="field" id="chatDaysVal" type="number" inputmode="decimal" step="0.5" min="0.5" max="30" placeholder="例）5"><span class="dur-custom__u">日</span></div>' +
        '<p class="field-note">半日（0.5日）〜1ヶ月（30日）まで、0.5日単位で指定できます。</p></div>';
    if (format === "video")
      return '<label class="field-label">ビデオ通話の長さ</label>' +
        '<select class="field" id="minutes"><option value="30">30分</option><option value="60" selected>60分</option><option value="90">90分</option><option value="custom">任意で指定</option></select>' +
        '<div id="minutes-custom" hidden style="margin-top:8px;"><div class="dur-custom"><input class="field" id="minutesVal" type="number" inputmode="numeric" step="5" min="5" max="180" placeholder="例）45"><span class="dur-custom__u">分</span></div>' +
        '<p class="field-note">5分〜180分（3時間）まで、5分単位で指定できます。</p></div>' +
        '<label class="field-label" style="margin-top:14px;">予約可能な開始枠 <span class="muted">（15分刻み・任意）</span></label>' +
        '<div class="slot-add"><input class="field" type="datetime-local" id="slot-input" step="900"><button type="button" class="btn btn--outline btn--sm" id="slot-add">追加</button></div>' +
        '<button type="button" class="btn btn--ghost btn--sm" id="slot-week" style="margin-top:8px;">＋ この時間を毎週4週ぶん追加</button>' +
        '<div class="slot-chips" id="slot-chips"></div>' +
        '<p class="field-note">購入者はここで選んだ枠から予約します。空のままなら、購入後にメッセージで日程を調整します。</p>';
    return '<label class="field-label">月のビデオ回数</label><select class="field" id="monthlyVideos"><option value="0">0回（チャットのみ）</option><option value="1">月1回</option><option value="2" selected>月2回</option><option value="4">月4回</option></select>';
  }

  /* 期間/長さの「任意で指定」トグル。fmtFields 描画のたびに呼ぶ */
  function wireDuration() {
    var cd = document.getElementById("chatDays");
    if (cd) cd.addEventListener("change", function () { document.getElementById("chatDays-custom").hidden = this.value !== "custom"; });
    var mn = document.getElementById("minutes");
    if (mn) mn.addEventListener("change", function () { document.getElementById("minutes-custom").hidden = this.value !== "custom"; });
  }

  /* サムネイルのファイル選択→dataURLプレビュー */
  function wireThumb() {
    var input = document.getElementById("thumb-input");
    if (!input) return;
    input.addEventListener("change", function () {
      var f = this.files && this.files[0];
      if (!f) return;
      if (f.size > 3 * 1024 * 1024) { UI.toast("画像は3MBまでにしてください"); this.value = ""; return; }
      var reader = new FileReader();
      reader.onload = function (e) { thumb = e.target.result; showThumb(); };
      reader.readAsDataURL(f);
    });
  }
  function showThumb() {
    var img = document.getElementById("thumb-preview");
    var empty = document.getElementById("thumb-empty");
    var change = document.getElementById("thumb-change");
    if (!img) return;
    if (thumb) { img.src = thumb; img.hidden = false; empty.hidden = true; change.hidden = false; }
    else { img.hidden = true; empty.hidden = false; change.hidden = true; }
  }

  /* 予約枠エディタ(ビデオ時のみDOMに存在) */
  function renderSlotChips() {
    var el = document.getElementById("slot-chips"); if (!el) return;
    el.innerHTML = slots.length
      ? slots.map(function (s, i) { return '<span class="slot-chip">' + esc(App.slotLabel(s)) + '<button type="button" data-rm="' + i + '" aria-label="削除">' + UI.icon("x") + "</button></span>"; }).join("")
      : '<span class="muted" style="font-size:13px;">まだ枠がありません。日時を追加してください。</span>';
    Array.prototype.forEach.call(el.querySelectorAll("[data-rm]"), function (b) {
      b.addEventListener("click", function () { slots.splice(Number(b.dataset.rm), 1); renderSlotChips(); });
    });
  }
  function wireSlots() {
    var add = document.getElementById("slot-add"); if (!add) return;   // ビデオ以外は無い
    renderSlotChips();
    add.addEventListener("click", function () {
      var inp = document.getElementById("slot-input");
      var v = inp.value;
      if (!v) return UI.toast("日時を選んでください");
      if (slots.indexOf(v) !== -1) return UI.toast("同じ枠があります");
      slots.push(v); slots.sort();
      renderSlotChips();
      inp.value = "";
    });
    var wk = document.getElementById("slot-week");
    if (wk) wk.addEventListener("click", function () {
      var inp = document.getElementById("slot-input");
      var v = inp.value;
      if (!v) return UI.toast("日時を選んでください");
      for (var i = 0; i < 4; i++) { var nv = App.addWeeks(v, i); if (slots.indexOf(nv) === -1) slots.push(nv); }
      slots.sort(); renderSlotChips(); inp.value = "";
    });
  }

  /* 編集時：形式別の値をフォームに反映 */
  function prefillDuration(p) {
    if (!p) return;
    if (p.format === "chat" && p.chatDays != null) {
      var cd = document.getElementById("chatDays");
      if (cd) {
        if ([1, 2, 3].indexOf(p.chatDays) !== -1) cd.value = String(p.chatDays);
        else { cd.value = "custom"; document.getElementById("chatDays-custom").hidden = false; document.getElementById("chatDaysVal").value = p.chatDays; }
      }
    }
    if (p.format === "video" && p.minutes != null) {
      var mn = document.getElementById("minutes");
      if (mn) {
        if ([30, 60, 90].indexOf(p.minutes) !== -1) mn.value = String(p.minutes);
        else { mn.value = "custom"; document.getElementById("minutes-custom").hidden = false; document.getElementById("minutesVal").value = p.minutes; }
      }
    }
    if (p.format === "monthly" && p.monthlyVideos != null) {
      var mv = document.getElementById("monthlyVideos"); if (mv) mv.value = String(p.monthlyVideos);
    }
  }

  function bind(p) {
    document.getElementById("fmt-fields").innerHTML = fmtFields();
    wireSlots(); wireDuration(); wireThumb(); showThumb(); prefillDuration(p);
    document.getElementById("fmt").addEventListener("click", function (e) {
      var b = e.target.closest("[data-fmt]"); if (!b) return;
      format = b.dataset.fmt;
      document.querySelectorAll("#fmt .seg__item").forEach(function (x) { x.classList.toggle("is-on", x.dataset.fmt === format); });
      document.getElementById("fmt-fields").innerHTML = fmtFields();
      wireSlots(); wireDuration();
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
      if (thumb) data.thumb = thumb;
      if (format === "chat") {
        var cs = document.getElementById("chatDays").value;
        var days = cs === "custom" ? Number(document.getElementById("chatDaysVal").value) : Number(cs);
        if (!days || days < 0.5 || days > 30) return UI.toast("相談期間は0.5〜30日で指定してください");
        data.chatDays = days;
      }
      if (format === "video") {
        var vs = document.getElementById("minutes").value;
        var mins = vs === "custom" ? Number(document.getElementById("minutesVal").value) : Number(vs);
        if (!mins || mins < 5 || mins > 180) return UI.toast("ビデオの長さは5〜180分で指定してください");
        data.minutes = mins; data.slots = slots.slice();
      }
      if (format === "monthly") data.monthlyVideos = Number(document.getElementById("monthlyVideos").value);
      if (!thumb) data.thumb = null;   // 編集でサムネを外した場合に反映

      var op = editing ? api.updatePlan(editing.id, data) : api.createPlan(data);
      op.then(function (plan) {
        UI.toast(editing ? "プランを更新しました" : "プランを公開しました");
        setTimeout(function () { App.goto("plans/show.html?id=" + (plan ? plan.id : editing.id)); }, 500);
      });
    });
  }
})();
