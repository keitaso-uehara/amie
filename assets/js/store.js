/* =========================================================
   store.js — API風データアクセス層(window.api)
   全ページはここ経由でのみデータに触る。Supabase移行時は
   このファイルの中身を実API(＋Stripe/Daily)に差し替えるだけでよい。
   書き込み(お気に入り・購入・プロフィール・セッション)は localStorage に保存。
   ========================================================= */
window.api = (function () {
  var KEY = "amie:v1";

  // ?reset=1 で書き込み状態を初期化
  if (new URLSearchParams(location.search).get("reset") === "1") {
    localStorage.removeItem(KEY);
  }

  function defaults() {
    return { session: null, seq: 0, favorites: [], orders: [], read: [],
             threads: {}, profile: { avatar: null, bio: "", concerns: [] },
             myReviews: {}, myPlans: [], mySeller: null, reports: [], reviewed: [] };
  }

  /* NGワード検知(仕様書 6章): LINE ID・URL・電話/口座番号らしき文字列 */
  var NG_PATTERNS = [
    { re: /https?:\/\/|\.com|\.jp|\.me\b/i, label: "外部サイトURL" },
    { re: /\bline\b|ライン(交換|のid|@|＠)|カカオ|id交換|連絡先.{0,4}(交換|教え)/i, label: "外部連絡先への誘導" },
    { re: /\d{10,}/, label: "電話・口座番号らしき数字" },
    { re: /(振込|口座番号|現金書留|直接.{0,3}(振込|支払))/, label: "外部決済への誘導" }
  ];
  function ngCheck(text) {
    for (var i = 0; i < NG_PATTERNS.length; i++) {
      if (NG_PATTERNS[i].re.test(text)) return NG_PATTERNS[i].label;
    }
    return null;
  }
  function getState() {
    try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY)) || {}); }
    catch (e) { return defaults(); }
  }
  function setState(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  /* 購入時の事前アンケート(相談したいこと＋ひとこと)を1メッセージに整形。出品者が最初に見る */
  function intakeBody(intake) {
    if (!intake || !intake.topic) return "";
    return "［相談したいこと］" + intake.topic + (intake.note ? "　／　" + intake.note : "");
  }
  /* 実売上として扱う状態(受取・明細・成果の対象)。requested/approved/declinedは未確定なので除外 */
  function isRealSale(status) { return status === "progress" || status === "active" || status === "completed"; }

  /* シード＋ローカル投稿レビューを結合して返す */
  function reviewsFor(planId) {
    var st = getState();
    return (window.DB.reviews[planId] || []).concat(st.myReviews[planId] || []);
  }
  /* 全プラン(シード＋自分で作成したプラン) */
  function allPlans() {
    return window.DB.plans.concat(getState().myPlans || []);
  }
  /* 全出品者(シード＋自分の出品者プロフィール) */
  function allCreators() {
    var st = getState();
    return st.mySeller ? window.DB.creators.concat([st.mySeller]) : window.DB.creators;
  }
  /* 自分の出品者プロフィールを用意(なければ雛形を作る)。state を変更するが保存は呼び出し側 */
  function ensureSeller(st) {
    if (!st.mySeller) {
      st.mySeller = {
        id: "c_me", name: (window.DB.users[0] && window.DB.users[0].name) || "あなた", handle: "you",
        type: "general", typeLabel: "出品者", verified: false,
        tagline: "", bio: "", categories: [], concerns: [],
        sns: {}, stats: { sales: 0, rating: 0, repeat: 0 }, planIds: [], approvalRequired: false
      };
    }
    return st.mySeller;
  }

  /* 出品者に、そのプラン一覧と集約レビューを添える */
  function hydrateCreator(c) {
    if (!c) return c;
    c = clone(c);
    var plans = allPlans();
    c.plans = (c.planIds || []).map(function (pid) {
      return plans.filter(function (p) { return p.id === pid; })[0];
    }).filter(function (p) { return p && !p.paused; });   // 公開プロフィールは受付停止中を隠す
    var reviews = [];
    (c.planIds || []).forEach(function (pid) {
      reviewsFor(pid).forEach(function (r) { reviews.push(Object.assign({ planId: pid }, r)); });
    });
    c.reviews = reviews;
    return c;
  }

  /* プランに出品者を添える */
  function hydratePlan(p) {
    if (!p) return p;
    p = clone(p);
    p.creator = allCreators().filter(function (c) { return c.id === p.creatorId; })[0] || null;
    p.reviews = reviewsFor(p.id);
    // 予約済み枠(進行中/契約中＋承認待ち/承認済みの注文が押さえている枠)。空きの算出・ダブルブッキング防止に使う
    p.bookedSlots = (getState().orders || []).filter(function (o) {
      return o.planId === p.id && o.slot &&
        (o.status === "progress" || o.status === "active" || o.status === "requested" || o.status === "approved");
    }).map(function (o) { return o.slot; });
    return p;
  }

  return {
    /* ---------- 出品者 ---------- */
    getCreators: function (params) {
      params = params || {};
      var list = allCreators().map(hydrateCreator);
      if (params.cat) {
        var cats = String(params.cat).split(",");
        // メインカテゴリ(未設定なら先頭)で1回だけ表示＝カテゴリ横断の2重表示を防ぐ
        list = list.filter(function (c) {
          var main = c.mainCategory || (c.categories && c.categories[0]);
          return cats.indexOf(main) !== -1;
        });
      }
      if (params.concern) {
        var cs = String(params.concern).split(",");
        list = list.filter(function (c) { return (c.concerns || []).some(function (x) { return cs.indexOf(x) !== -1; }); });
      }
      if (params.type) list = list.filter(function (c) { return c.type === params.type; });
      if (params.q) {
        var q = params.q.toLowerCase();
        list = list.filter(function (c) {
          return [c.name, c.handle, c.tagline, c.typeLabel].filter(Boolean)
            .some(function (t) { return t.toLowerCase().indexOf(q) !== -1; });
        });
      }
      var blocks = getState().blocks || [];
      if (blocks.length) list = list.filter(function (c) { return blocks.indexOf(c.id) === -1; });   // ブロック済みは一覧に出さない
      return Promise.resolve(list);
    },
    getCreator: function (id) {
      return Promise.resolve(hydrateCreator(allCreators().filter(function (c) { return c.id === id; })[0] || null));
    },
    /* SNSフォロワー合計の多い順(TOPの注目出品者) */
    getFeaturedCreators: function (n) {
      var list = window.DB.creators.map(hydrateCreator).sort(function (a, b) {
        return snsTotal(b) - snsTotal(a);
      });
      return Promise.resolve(n ? list.slice(0, n) : list);
    },

    /* ---------- プラン ---------- */
    getPlans: function (params) {
      params = params || {};
      var list = allPlans().map(hydratePlan);
      if (params.creatorId) list = list.filter(function (p) { return p.creatorId === params.creatorId; });
      if (params.cat) {
        var cats = String(params.cat).split(",");
        list = list.filter(function (p) { return cats.indexOf(p.category) !== -1; });
      }
      if (params.concern) {
        var cs = String(params.concern).split(",");
        list = list.filter(function (p) { return (p.concerns || []).some(function (x) { return cs.indexOf(x) !== -1; }); });
      }
      if (params.format) list = list.filter(function (p) { return p.format === params.format; });
      if (params.priceMin) list = list.filter(function (p) { return p.price >= Number(params.priceMin); });
      if (params.priceMax) list = list.filter(function (p) { return p.price <= Number(params.priceMax); });
      if (params.q) {
        var q = params.q.toLowerCase();
        list = list.filter(function (p) {
          return [p.title, p.desc, (p.creator && p.creator.name)].filter(Boolean)
            .some(function (t) { return t.toLowerCase().indexOf(q) !== -1; });
        });
      }
      return Promise.resolve(list.filter(function (p) { return !p.paused; }));   // 受付停止中は一覧に出さない
    },
    getPlan: function (id) {
      return Promise.resolve(hydratePlan(allPlans().filter(function (p) { return p.id === id; })[0] || null));
    },
    getNewPlans: function (n) {
      var list = allPlans().map(hydratePlan).filter(function (p) { return !p.paused; }).slice().reverse();
      return Promise.resolve(n ? list.slice(0, n) : list);
    },
    /* 人気順(販売数→評価)。TOPの「人気のプラン」棚に使う */
    getPopularPlans: function (n) {
      var list = allPlans().map(hydratePlan).filter(function (p) { return !p.paused; }).sort(function (a, b) {
        return (b.stats.sales || 0) - (a.stats.sales || 0) || (b.stats.rating || 0) - (a.stats.rating || 0);
      });
      return Promise.resolve(n ? list.slice(0, n) : list);
    },

    /* ---------- レビュー ---------- */
    getReviews: function (planId) {
      return Promise.resolve(clone(reviewsFor(planId)));
    },
    /* 取引完了後のレビュー投稿(仕様書 S9)。1取引1回・投稿後編集不可 */
    postReview: function (orderId, planId, rating, body) {
      var st = getState();
      if (st.reviewed.indexOf(orderId) !== -1) return Promise.reject(new Error("already reviewed"));
      st.myReviews[planId] = st.myReviews[planId] || [];
      st.myReviews[planId].unshift({ userId: "u001", rating: rating, body: body, date: "たった今" });
      st.reviewed.push(orderId);
      setState(st);
      return Promise.resolve();
    },
    canReview: function (orderId) { return getState().reviewed.indexOf(orderId) === -1; },

    /* ---------- NGワード検知(メッセージ送信前) ---------- */
    checkMessage: function (text) { return ngCheck(text); },

    /* ---------- お気に入り(プラン/出品者) ---------- */
    toggleFavorite: function (kind, id) {
      var st = getState();
      var key = kind + ":" + id;
      var i = st.favorites.indexOf(key);
      if (i === -1) st.favorites.push(key); else st.favorites.splice(i, 1);
      setState(st);
      return Promise.resolve(i === -1);
    },
    isFavorite: function (kind, id) { return getState().favorites.indexOf(kind + ":" + id) !== -1; },
    getFavorites: function () {
      var st = getState();
      var plans = [], creators = [];
      st.favorites.forEach(function (k) {
        var parts = k.split(":");
        if (parts[0] === "plan") { var p = hydratePlan(allPlans().filter(function (x) { return x.id === parts[1]; })[0]); if (p) plans.push(p); }
        if (parts[0] === "creator") { var c = hydrateCreator(allCreators().filter(function (x) { return x.id === parts[1]; })[0]); if (c) creators.push(c); }
      });
      return Promise.resolve({ plans: plans, creators: creators });
    },

    /* ---------- フォロー(出品者との継続関係・リピート導線の土台) ---------- */
    toggleFollow: function (creatorId) {
      var st = getState();
      st.follows = st.follows || [];
      var i = st.follows.indexOf(creatorId);
      if (i === -1) st.follows.push(creatorId); else st.follows.splice(i, 1);
      setState(st);
      return Promise.resolve(i === -1);
    },
    isFollowing: function (creatorId) { return (getState().follows || []).indexOf(creatorId) !== -1; },
    getFollowing: function () {
      var st = getState();
      var list = (st.follows || []).map(function (id) {
        return hydrateCreator(allCreators().filter(function (c) { return c.id === id; })[0]);
      }).filter(Boolean);
      return Promise.resolve(list);
    },

    /* ---------- 購入(エスクロー預かりのモック) ---------- */
    /* 実装では Stripe で与信→取引完了で capture。ここでは注文レコードを保存し、
       同時にメッセージスレッドを開く(仕様書 S5→S6 の導線)。 */
    purchase: function (planId, opts) {
      opts = opts || {};
      var st = getState();
      st.seq += 1;
      var plan = allPlans().filter(function (p) { return p.id === planId; })[0];
      if (!plan) return Promise.reject(new Error("plan not found"));
      if (plan.paused) return Promise.reject(new Error("plan paused"));
      var order = {
        id: "o_" + st.seq,
        planId: planId,
        creatorId: plan.creatorId,
        format: plan.format,
        price: plan.price,
        status: plan.format === "monthly" ? "active" : "progress",
        slot: opts.slot || null,          // ビデオの予約枠
        minutes: plan.minutes || null,
        addons: [],
        rescheduled: false,
        ref: opts.ref || null,            // 流入元(出品者のシェアリンク)
        intake: opts.intake || null,      // 購入時の事前アンケート(相談したいこと＋ひとこと)
        createdLabel: "たった今"
      };
      st.orders.push(order);
      // 取引ごとのメッセージスレッドを開く(事前アンケートを最初の1通として残す)
      var thread0 = [];
      if (intakeBody(opts.intake)) thread0.push({ from: "me", body: intakeBody(opts.intake), timeLabel: "たった今", read: true });
      thread0.push({ from: "creator", body: "ご購入ありがとうございます！さっそくよろしくお願いします。", timeLabel: "たった今" });
      st.threads[order.id] = thread0;
      st.myNotifications = st.myNotifications || [];
      // 予約リマインド通知(ビデオ・実装では開始24h前/直前にcronで再送)
      if (order.format === "video" && order.slot) {
        var cName = (allCreators().filter(function (c) { return c.id === plan.creatorId; })[0] || {}).name || "出品者";
        st.myNotifications.unshift({
          id: "n_local_" + st.seq, type: "booking", actorId: plan.creatorId, orderId: order.id,
          title: cName + "さんとのビデオ予約が確定しました（" + (window.App ? App.slotLabel(order.slot) : order.slot) + "）",
          date: "たった今", read: false
        });
      }
      // 出品者向け：自分のプランが購入されたら通知
      if (plan.creatorId === "c_me") {
        st.seq += 1;
        st.myNotifications.unshift({
          id: "n_sale_" + st.seq, type: "sale", actorId: plan.creatorId, orderId: order.id,
          title: "あなたのプラン「" + plan.title + "」が購入されました", date: "たった今", read: false
        });
      }
      setState(st);
      return Promise.resolve(order);
    },

    /* ---------- リクエスト承認制(出品者オプトイン) ----------
       出品者が approvalRequired の場合、購入は「リクエスト(未課金)」になり、
       出品者が承認→購入者がワンタップで確定課金、という流れ。買い手を選べる安全弁。 */
    requestBooking: function (planId, opts) {
      opts = opts || {};
      var st = getState();
      st.seq += 1;
      var plan = allPlans().filter(function (p) { return p.id === planId; })[0];
      if (!plan) return Promise.reject(new Error("plan not found"));
      if (plan.paused) return Promise.reject(new Error("plan paused"));
      var order = {
        id: "o_" + st.seq, planId: planId, creatorId: plan.creatorId, format: plan.format,
        price: plan.price, status: "requested", slot: opts.slot || null, minutes: plan.minutes || null,
        addons: [], rescheduled: false, ref: opts.ref || null, intake: opts.intake || null, createdLabel: "たった今"
      };
      st.orders.push(order);
      var cName = (allCreators().filter(function (c) { return c.id === plan.creatorId; })[0] || {}).name || "出品者";
      var thread0 = [];
      if (intakeBody(opts.intake)) thread0.push({ from: "me", body: intakeBody(opts.intake), timeLabel: "たった今", read: true });
      thread0.push({ from: "creator", body: "リクエストありがとうございます。内容を確認して、お受けできる場合は承認します。少々お待ちください。", timeLabel: "たった今" });
      st.threads[order.id] = thread0;
      st.myNotifications = st.myNotifications || [];
      st.myNotifications.unshift({ id: "n_req_" + st.seq, type: "booking", actorId: plan.creatorId, orderId: order.id, title: cName + "さんへリクエストを送信しました（承認待ち）", date: "たった今", read: false });
      // 自分以外(シード出品者)は承認を自動再現し、購入者の導線を止めない。自分の出品(c_me)はダッシュボードで承認/お断り
      if (plan.creatorId !== "c_me") {
        order.status = "approved";
        st.threads[order.id].push({ from: "creator", body: "リクエストを承認しました。最後にお支払いを確定してください。", timeLabel: "たった今" });
        st.seq += 1;
        st.myNotifications.unshift({ id: "n_apr_" + st.seq, type: "booking", actorId: plan.creatorId, orderId: order.id, title: cName + "さんがあなたのリクエストを承認しました。お支払いに進めます。", date: "たった今", read: false });
      }
      setState(st);
      return Promise.resolve(clone(order));
    },
    /* 出品者がリクエストを承認(→購入者の確定課金待ち) */
    approveRequest: function (orderId) {
      var st = getState(); var done = null;
      st.orders.forEach(function (o) { if (o.id === orderId && o.status === "requested") { o.status = "approved"; done = o; } });
      if (done) {
        st.threads[orderId] = st.threads[orderId] || [];
        st.threads[orderId].push({ from: "creator", body: "リクエストを承認しました。最後にお支払いを確定してください。", timeLabel: "たった今" });
        st.seq += 1;
        var cName = (allCreators().filter(function (c) { return c.id === done.creatorId; })[0] || {}).name || "出品者";
        st.myNotifications = st.myNotifications || [];
        st.myNotifications.unshift({ id: "n_apr_" + st.seq, type: "booking", actorId: done.creatorId, orderId: done.id, title: cName + "さんがあなたのリクエストを承認しました。お支払いに進めます。", date: "たった今", read: false });
      }
      setState(st);
      return Promise.resolve(done ? clone(done) : null);
    },
    /* 出品者がリクエストを見送る(未課金のまま終了・定型文で通知) */
    declineRequest: function (orderId, opts) {
      opts = opts || {};
      var st = getState(); var done = null;
      st.orders.forEach(function (o) { if (o.id === orderId && (o.status === "requested" || o.status === "approved")) { o.status = "declined"; o.declineReason = opts.reason || ""; done = o; } });
      if (done) {
        st.threads[orderId] = st.threads[orderId] || [];
        st.threads[orderId].push({ from: "creator", body: "申し訳ありませんが、今回はお受けできませんでした。お支払いは発生していません。またの機会にお待ちしています。", timeLabel: "たった今" });
        st.seq += 1;
        var cName = (allCreators().filter(function (c) { return c.id === done.creatorId; })[0] || {}).name || "出品者";
        st.myNotifications = st.myNotifications || [];
        st.myNotifications.unshift({ id: "n_dec_" + st.seq, type: "system", actorId: done.creatorId, orderId: done.id, title: cName + "さんはリクエストを見送りました（お支払いは発生していません）", date: "たった今", read: false });
      }
      setState(st);
      return Promise.resolve(done ? clone(done) : null);
    },
    /* 購入者が承認後にワンタップで確定課金(→取引開始) */
    confirmRequest: function (orderId) {
      var st = getState(); var done = null;
      st.orders.forEach(function (o) {
        if (o.id === orderId && o.status === "approved") { o.status = o.format === "monthly" ? "active" : "progress"; done = o; }
      });
      if (done) {
        st.threads[orderId] = st.threads[orderId] || [];
        st.threads[orderId].push({ from: "creator", body: "お支払いが完了しました。ここからよろしくお願いします！", timeLabel: "たった今" });
        if (done.format === "video" && done.slot) {
          st.seq += 1;
          var cName = (allCreators().filter(function (c) { return c.id === done.creatorId; })[0] || {}).name || "出品者";
          st.myNotifications = st.myNotifications || [];
          st.myNotifications.unshift({ id: "n_local_" + st.seq, type: "booking", actorId: done.creatorId, title: cName + "さんとのビデオ予約が確定しました（" + (window.App ? App.slotLabel(done.slot) : done.slot) + "）", date: "たった今", read: false });
        }
      }
      setState(st);
      return Promise.resolve(done ? clone(done) : null);
    },
    getOrders: function () {
      var st = getState();
      var list = st.orders.map(function (o) {
        var out = clone(o);
        out.plan = hydratePlan(allPlans().filter(function (p) { return p.id === o.planId; })[0]);
        out.creator = allCreators().filter(function (c) { return c.id === o.creatorId; })[0] || null;
        out.reviewable = out.status === "completed" && st.reviewed.indexOf(o.id) === -1;
        return out;
      }).reverse();
      return Promise.resolve(list);
    },
    getOrder: function (id) {
      return this.getOrders().then(function (list) {
        return list.filter(function (o) { return o.id === id; })[0] || null;
      });
    },
    cancelSubscription: function (orderId) {
      var st = getState();
      st.orders.forEach(function (o) { if (o.id === orderId) o.status = "canceled"; });
      setState(st);
      return Promise.resolve();
    },
    /* 取引完了(ビデオ実施後の完了操作・チャット期間満了のモック)→ 売上確定・レビュー可能に */
    completeOrder: function (orderId) {
      var st = getState();
      st.orders.forEach(function (o) { if (o.id === orderId && o.status === "progress") o.status = "completed"; });
      setState(st);
      return Promise.resolve();
    },
    /* ビデオ予約の日時変更(1回まで・仕様書 確定事項)。締切前提のUI側で制御 */
    rescheduleOrder: function (orderId, newSlot, opts) {
      opts = opts || {};
      var st = getState();
      var done = null;
      st.orders.forEach(function (o) {
        // 購入者は1回まで。出品者からの変更は回数制限なし
        if (o.id === orderId && (opts.by === "seller" || !o.rescheduled)) {
          o.slot = newSlot;
          if (opts.by !== "seller") o.rescheduled = true;
          done = o;
        }
      });
      if (done) {
        st.threads[orderId] = st.threads[orderId] || [];
        var lbl = window.App ? App.slotLabel(newSlot) : newSlot;
        st.threads[orderId].push({
          from: opts.by === "seller" ? "creator" : "me",
          body: (opts.by === "seller" ? "出品者が予約日時を変更しました：" : "予約日時を変更しました：") + lbl,
          timeLabel: "たった今", read: true
        });
      }
      setState(st);
      return Promise.resolve(done ? clone(done) : null);
    },
    /* 追加支払い(おひねり/延長)。都度課金型でポイント不使用(8.5)。売上に加算・スレッドに記録 */
    addAddon: function (orderId, amount, label, extraMinutes) {
      var st = getState();
      amount = Number(amount) || 0;
      st.orders.forEach(function (o) {
        if (o.id === orderId) {
          o.addons = o.addons || [];
          o.addons.push({ amount: amount, label: label || "追加", minutes: Number(extraMinutes) || 0 });
        }
      });
      st.threads[orderId] = st.threads[orderId] || [];
      st.threads[orderId].push({ from: "me", body: (label || "追加のお支払い") + "（+¥" + amount.toLocaleString("ja-JP") + "）を購入しました", timeLabel: "たった今", read: true });
      setState(st);
      return Promise.resolve({ ok: true });
    },

    /* 取引のキャンセル/返金。締切前は購入者が自由に、出品者都合は全額返金(ストアカ準拠)。UI側で締切を判定 */
    cancelOrder: function (orderId, opts) {
      opts = opts || {};
      var st = getState();
      var done = null;
      st.orders.forEach(function (o) {
        if (o.id === orderId && (o.status === "progress" || o.status === "active")) {
          o.status = "canceled";
          var addons = (o.addons || []).reduce(function (s, a) { return s + (a.amount || 0); }, 0);
          o.refund = { amount: (o.price || 0) + addons, reason: opts.reason || "cancel", by: opts.by || "buyer", date: "たった今" };
          done = o;
        }
      });
      if (done) {
        st.threads[orderId] = st.threads[orderId] || [];
        var msg = opts.by === "seller"
          ? "出品者都合により中止しました。お支払いは全額返金されます。"
          : opts.reason === "noshow"
            ? "相手が現れなかったため、返金を受け付けました。全額返金されます。"
            : "この取引をキャンセルしました。全額返金されます。";
        st.threads[orderId].push({ from: "creator", body: msg, timeLabel: "たった今" });
      }
      setState(st);
      return Promise.resolve(done ? clone(done) : null);
    },

    /* ---------- 出品者の入金・出金(8.2/8.3) ---------- */
    /* 受取残高。手数料20%控除後。completed=受取可能 / progress・active=確定待ち。canceledは除外 */
    getSellerBalance: function () {
      var st = getState();
      var meId = st.mySeller ? st.mySeller.id : null;
      var available = 0, pending = 0, gross = 0;
      if (meId) {
        st.orders.forEach(function (o) {
          if (o.creatorId !== meId || !isRealSale(o.status)) return;   // 未確定(承認待ち等)・返金は除外
          var addons = (o.addons || []).reduce(function (s, a) { return s + (a.amount || 0); }, 0);
          var total = (o.price || 0) + addons;
          gross += total;
          var net = Math.round(total * 0.8);
          if (o.status === "completed") available += net; else pending += net;
        });
      }
      var withdrawn = (st.withdrawals || []).reduce(function (s, w) { return s + (w.amount || 0); }, 0);
      return Promise.resolve({ available: Math.max(0, available - withdrawn), pending: pending, gross: gross });
    },
    /* 出金申請。お急ぎ=3営業日以内・手数料+3%(8.3)。通常は無料 */
    requestPayout: function (amount, express) {
      var st = getState();
      amount = Number(amount) || 0;
      var fee = express ? Math.round(amount * 0.03) : 0;
      st.withdrawals = st.withdrawals || [];
      st.withdrawals.push({ amount: amount, fee: fee, express: !!express, net: amount - fee, date: "たった今", eta: express ? "3営業日以内" : "翌月末" });
      setState(st);
      return Promise.resolve({ ok: true, net: amount - fee, fee: fee });
    },
    getPayouts: function () { return Promise.resolve((getState().withdrawals || []).slice().reverse()); },

    /* ---------- リファラル計測(シェアリンクの効果) ---------- */
    trackReferralVisit: function (ref) {
      if (!ref) return Promise.resolve();
      var st = getState();
      st.refVisits = st.refVisits || {};
      st.refVisits[ref] = (st.refVisits[ref] || 0) + 1;
      setState(st);
      return Promise.resolve();
    },
    getReferralStats: function (handle) {
      var st = getState();
      var visits = (st.refVisits || {})[handle] || 0;
      var purchases = (st.orders || []).filter(function (o) { return o.ref === handle && isRealSale(o.status); }).length;
      var cvr = visits ? Math.round(purchases / visits * 1000) / 10 : 0;
      return Promise.resolve({ visits: visits, purchases: purchases, cvr: cvr });
    },
    /* 売上明細(確定申告用・CSV/PDF出力元)。宛名は出品者名 */
    getSalesRows: function () {
      var st = getState();
      var meId = st.mySeller ? st.mySeller.id : null;
      var rows = [];
      if (meId) {
        st.orders.forEach(function (o) {
          if (o.creatorId !== meId || !isRealSale(o.status)) return;   // 未確定リクエストは明細に載せない
          var plan = allPlans().filter(function (p) { return p.id === o.planId; })[0] || {};
          var addons = (o.addons || []).reduce(function (s, a) { return s + (a.amount || 0); }, 0);
          var total = (o.price || 0) + addons;
          rows.push({
            date: o.createdLabel || "", title: plan.title || "(プラン)", format: o.format,
            gross: total, fee: Math.round(total * 0.2), net: Math.round(total * 0.8), status: o.status
          });
        });
      }
      return Promise.resolve(rows);
    },

    /* 出品者としての予約・取引一覧(自分が出品したプランへの注文) */
    getSellerOrders: function () {
      var st = getState();
      var meId = st.mySeller ? st.mySeller.id : null;
      if (!meId) return Promise.resolve([]);
      var list = st.orders.filter(function (o) { return o.creatorId === meId; }).map(function (o) {
        var out = clone(o);
        out.plan = hydratePlan(allPlans().filter(function (p) { return p.id === o.planId; })[0]);
        return out;
      }).reverse();
      return Promise.resolve(list);
    },

    /* ---------- メッセージ(取引スレッド) ---------- */
    getThreads: function () {
      var self = this;
      return this.getOrders().then(function (orders) {
        return orders.map(function (o) {
          var msgs = getState().threads[o.id] || [];
          return { order: o, last: msgs[msgs.length - 1] || null };
        });
      });
    },
    getThread: function (orderId) {
      return Promise.resolve(clone(getState().threads[orderId] || []));
    },
    sendMessage: function (orderId, body, opts) {
      opts = opts || {};
      var st = getState();
      st.threads[orderId] = st.threads[orderId] || [];
      st.threads[orderId].push({ from: "me", body: body, image: !!opts.image, read: true, timeLabel: "たった今" });
      setState(st);
      return Promise.resolve(clone(st.threads[orderId]));
    },

    /* ---------- プラン作成・編集(S12) ---------- */
    createPlan: function (data) {
      var st = getState();
      st.seq += 1;
      var id = "p_local_" + st.seq;
      var seller = ensureSeller(st);
      var plan = {
        id: id, creatorId: seller.id, title: data.title, format: data.format,
        price: Number(data.price), category: data.category, concerns: data.concerns || [],
        desc: data.desc, stats: { rating: 0, sales: 0 }
      };
      if (data.format === "chat") plan.chatDays = data.chatDays || 7;
      if (data.format === "video") { plan.minutes = data.minutes || 60; plan.slots = data.slots || []; }
      if (data.format === "monthly") { plan.monthlyVideos = data.monthlyVideos || 0; plan.chatIncluded = true; }
      if (data.thumb) plan.thumb = data.thumb;   // プランごとのサムネイル(dataURL)
      st.myPlans.push(plan);
      seller.planIds.push(id);
      st.mySeller = seller;
      setState(st);
      return Promise.resolve(hydratePlan(plan));
    },
    getMyPlans: function () {
      return Promise.resolve((getState().myPlans || []).map(hydratePlan).reverse());
    },
    /* プラン編集(自作プランのみ) */
    updatePlan: function (id, data) {
      var st = getState();
      var p = (st.myPlans || []).filter(function (x) { return x.id === id; })[0];
      if (!p) return Promise.reject(new Error("plan not found"));
      if (data.title != null) p.title = data.title;
      if (data.price != null) p.price = Number(data.price);
      if (data.category != null) p.category = data.category;
      if (data.desc != null) p.desc = data.desc;
      if (data.thumb !== undefined) p.thumb = data.thumb || null;
      if (data.format && data.format !== p.format) {
        p.format = data.format;
        delete p.chatDays; delete p.minutes; delete p.slots; delete p.monthlyVideos; delete p.chatIncluded;
      }
      if (p.format === "chat" && data.chatDays != null) p.chatDays = data.chatDays;
      if (p.format === "video") { if (data.minutes != null) p.minutes = data.minutes; if (data.slots) p.slots = data.slots; }
      if (p.format === "monthly") { if (data.monthlyVideos != null) p.monthlyVideos = data.monthlyVideos; p.chatIncluded = true; }
      setState(st);
      return Promise.resolve(hydratePlan(p));
    },
    /* プラン削除(自作プランのみ) */
    deletePlan: function (id) {
      var st = getState();
      st.myPlans = (st.myPlans || []).filter(function (x) { return x.id !== id; });
      if (st.mySeller && st.mySeller.planIds) st.mySeller.planIds = st.mySeller.planIds.filter(function (pid) { return pid !== id; });
      setState(st);
      return Promise.resolve();
    },
    /* プランの公開/受付停止トグル */
    setPlanActive: function (id, active) {
      var st = getState();
      (st.myPlans || []).forEach(function (p) { if (p.id === id) p.paused = !active; });
      setState(st);
      return Promise.resolve();
    },
    /* 予約枠の追加(公開後の継ぎ足し) */
    addSlots: function (id, slots) {
      var st = getState();
      var p = (st.myPlans || []).filter(function (x) { return x.id === id; })[0];
      if (!p) return Promise.reject(new Error("plan not found"));
      p.slots = (p.slots || []).concat(slots || []).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
      setState(st);
      return Promise.resolve(hydratePlan(p));
    },
    /* 出品者が受け取ったレビュー(自作プランへの集約) */
    getReceivedReviews: function () {
      var st = getState();
      var seller = st.mySeller;
      if (!seller) return Promise.resolve([]);
      var out = [];
      (seller.planIds || []).forEach(function (pid) {
        var plan = allPlans().filter(function (p) { return p.id === pid; })[0];
        reviewsFor(pid).forEach(function (r) { out.push(Object.assign({ planTitle: plan ? plan.title : "" }, r)); });
      });
      return Promise.resolve(out);
    },
    /* 出金先口座(番号は下4桁のみ保持) */
    setBankAccount: function (data) {
      var st = getState();
      st.bankAccount = { bank: data.bank || "", branch: data.branch || "", type: data.type || "普通", last4: String(data.number || "").slice(-4), holder: data.holder || "" };
      setState(st);
      return Promise.resolve(clone(st.bankAccount));
    },
    getBankAccount: function () { return Promise.resolve(getState().bankAccount || null); },
    /* ブロック(購入者→出品者。検索・一覧から除外) */
    toggleBlock: function (targetId) {
      var st = getState();
      st.blocks = st.blocks || [];
      var i = st.blocks.indexOf(targetId);
      if (i === -1) st.blocks.push(targetId); else st.blocks.splice(i, 1);
      setState(st);
      return Promise.resolve(i === -1);
    },
    isBlocked: function (targetId) { return (getState().blocks || []).indexOf(targetId) !== -1; },

    /* ---------- 出品者プロフィール(S15 出品者) ---------- */
    getMySeller: function () {
      var st = getState();
      return Promise.resolve(st.mySeller ? hydrateCreator(st.mySeller) : null);
    },
    setMySeller: function (data) {
      var st = getState();
      var seller = ensureSeller(st);
      if (data.name != null) seller.name = data.name;
      if (data.tagline != null) seller.tagline = data.tagline;
      if (data.bio != null) seller.bio = data.bio;
      if (data.categories) seller.categories = data.categories;
      if (data.mainCategory !== undefined) seller.mainCategory = data.mainCategory;
      // メインが選択カテゴリに無ければ補正。未設定なら先頭を自動採用
      if (seller.mainCategory && (seller.categories || []).indexOf(seller.mainCategory) === -1) seller.mainCategory = null;
      if (!seller.mainCategory && (seller.categories || []).length) seller.mainCategory = seller.categories[0];
      if (data.sns) seller.sns = data.sns;
      if (data.avatar !== undefined) seller.avatar = data.avatar;   // プロフィール画像(dataURL)
      if (data.approvalRequired !== undefined) seller.approvalRequired = !!data.approvalRequired;   // リクエスト承認制のON/OFF
      st.mySeller = seller;
      setState(st);
      return Promise.resolve(hydrateCreator(seller));
    },

    /* ---------- 通報(S3/S6) ---------- */
    report: function (data) {
      var st = getState();
      st.seq += 1;
      st.reports.push({ id: "r_" + st.seq, target: data.target || "", reason: data.reason || "", date: "たった今", status: "open" });
      setState(st);
      return Promise.resolve({ ok: true });
    },

    /* ---------- 運営管理(A1-A4)のデータ(デモ) ---------- */
    getAdminQueue: function () {
      // A1 出品パトロール: シードプラン＋自作プランを審査キューに見立てる
      var plans = allPlans().map(hydratePlan).slice(0, 8);
      return Promise.resolve(plans.map(function (p, i) {
        return { plan: p, flagged: p.price > 50000, newSeller: (p.creator && p.creator.type === "general") };
      }));
    },
    getAdminReports: function () {
      var seed = [
        { id: "r_seed1", target: "メッセージ / o_seed", reason: "外部サイトへの誘導の疑い", date: "1時間前", status: "open" },
        { id: "r_seed2", target: "出品者 / ゆず", reason: "資格の誇大表示", date: "昨日", status: "open" }
      ];
      return Promise.resolve(seed.concat(getState().reports));
    },
    getAdminPayouts: function () {
      return Promise.resolve([
        { id: "po_1", creator: "MOEKA", amount: 147200, kyc: true, status: "承認待ち" },
        { id: "po_2", creator: "kaori", amount: 96000, kyc: true, status: "承認待ち" },
        { id: "po_3", creator: "ゆず", amount: 18800, kyc: false, status: "本人確認未了" }
      ]);
    },

    /* ---------- 通知 ---------- */
    getNotifications: function () {
      var st = getState();
      var mine = (st.myNotifications || []).map(function (n) { return clone(n); });
      var list = mine.concat(clone(window.DB.notifications));
      list.forEach(function (n) {
        if (st.read.indexOf(n.id) !== -1) n.read = true;
        n.actor = n.actorId ? (allCreators().filter(function (c) { return c.id === n.actorId; })[0] || null) : null;
      });
      return Promise.resolve(list);
    },
    getUnreadCount: function () {
      return this.getNotifications().then(function (list) {
        return list.filter(function (n) { return !n.read; }).length;
      });
    },
    markNotificationRead: function (id) {
      var st = getState();
      if (st.read.indexOf(id) === -1) st.read.push(id);
      setState(st);
      return Promise.resolve();
    },
    markAllNotificationsRead: function () {
      var st = getState();
      (st.myNotifications || []).concat(window.DB.notifications || []).forEach(function (n) { if (st.read.indexOf(n.id) === -1) st.read.push(n.id); });
      setState(st);
      return Promise.resolve();
    },

    /* ---------- 自分(購入者) ---------- */
    getMe: function () {
      var st = getState();
      if (!st.session) return Promise.resolve(null);
      var me = clone(window.DB.users.filter(function (u) { return u.isMe; })[0]);
      var p = st.profile || {};
      if (p.name) me.name = p.name;
      if (p.avatar) me.avatar = p.avatar;
      if (p.bio) me.bio = p.bio;
      if (p.concerns && p.concerns.length) me.concerns = p.concerns;
      return Promise.resolve(me);
    },
    setProfile: function (data) {
      var st = getState();
      var p = st.profile || { avatar: null, bio: "", concerns: [] };
      if (data.name !== undefined) p.name = data.name;
      if (data.avatar !== undefined) p.avatar = data.avatar;
      if (data.bio !== undefined) p.bio = data.bio;
      if (data.concerns !== undefined) p.concerns = data.concerns;
      st.profile = p;
      setState(st);
      return Promise.resolve();
    },

    /* ---------- セッション(モック) ---------- */
    login: function (provider) {
      var st = getState();
      st.session = { provider: provider || "line", userId: "u001" };
      setState(st);
      return Promise.resolve(st.session);
    },
    logout: function () {
      var st = getState();
      st.session = null;
      setState(st);
      return Promise.resolve();
    },
    getSession: function () { return getState().session; }
  };

  /* SNSフォロワー合計 */
  function snsTotal(c) {
    var s = c.sns || {};
    return (s.instagram || 0) + (s.tiktok || 0) + (s.youtube || 0) + (s.x || 0);
  }
})();
