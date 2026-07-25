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
        sns: {}, stats: { sales: 0, rating: 0, repeat: 0 }, planIds: []
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
    }).filter(Boolean);
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
    // 予約済み枠(進行中/契約中の注文が押さえている枠)。空きの算出・ダブルブッキング防止に使う
    p.bookedSlots = (getState().orders || []).filter(function (o) {
      return o.planId === p.id && o.slot && (o.status === "progress" || o.status === "active");
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
        list = list.filter(function (c) { return c.categories.some(function (x) { return cats.indexOf(x) !== -1; }); });
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
      if (params.priceMax) list = list.filter(function (p) { return p.price <= Number(params.priceMax); });
      if (params.q) {
        var q = params.q.toLowerCase();
        list = list.filter(function (p) {
          return [p.title, p.desc, (p.creator && p.creator.name)].filter(Boolean)
            .some(function (t) { return t.toLowerCase().indexOf(q) !== -1; });
        });
      }
      return Promise.resolve(list);
    },
    getPlan: function (id) {
      return Promise.resolve(hydratePlan(allPlans().filter(function (p) { return p.id === id; })[0] || null));
    },
    getNewPlans: function (n) {
      var list = allPlans().map(hydratePlan).slice().reverse();
      return Promise.resolve(n ? list.slice(0, n) : list);
    },
    /* 人気順(販売数→評価)。TOPの「人気のプラン」棚に使う */
    getPopularPlans: function (n) {
      var list = allPlans().map(hydratePlan).sort(function (a, b) {
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

    /* ---------- 購入(エスクロー預かりのモック) ---------- */
    /* 実装では Stripe で与信→取引完了で capture。ここでは注文レコードを保存し、
       同時にメッセージスレッドを開く(仕様書 S5→S6 の導線)。 */
    purchase: function (planId, opts) {
      opts = opts || {};
      var st = getState();
      st.seq += 1;
      var plan = allPlans().filter(function (p) { return p.id === planId; })[0];
      if (!plan) return Promise.reject(new Error("plan not found"));
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
        createdLabel: "たった今"
      };
      st.orders.push(order);
      // 取引ごとのメッセージスレッドを開く
      st.threads[order.id] = [
        { from: "creator", body: "ご購入ありがとうございます！さっそくよろしくお願いします。", timeLabel: "たった今" }
      ];
      // 予約リマインド通知(ビデオ・実装では開始24h前/直前にcronで再送)
      if (order.format === "video" && order.slot) {
        st.myNotifications = st.myNotifications || [];
        var cName = (allCreators().filter(function (c) { return c.id === plan.creatorId; })[0] || {}).name || "出品者";
        st.myNotifications.unshift({
          id: "n_local_" + st.seq, type: "booking", actorId: plan.creatorId,
          title: cName + "さんとのビデオ予約が確定しました（" + (window.App ? App.slotLabel(order.slot) : order.slot) + "）",
          date: "たった今", read: false
        });
      }
      setState(st);
      return Promise.resolve(order);
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
          if (o.creatorId !== meId || o.status === "canceled") return;
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
    /* 売上明細(確定申告用・CSV/PDF出力元)。宛名は出品者名 */
    getSalesRows: function () {
      var st = getState();
      var meId = st.mySeller ? st.mySeller.id : null;
      var rows = [];
      if (meId) {
        st.orders.forEach(function (o) {
          if (o.creatorId !== meId) return;
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
      st.myPlans.push(plan);
      seller.planIds.push(id);
      st.mySeller = seller;
      setState(st);
      return Promise.resolve(hydratePlan(plan));
    },
    getMyPlans: function () {
      return Promise.resolve((getState().myPlans || []).map(hydratePlan).reverse());
    },

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
      if (data.sns) seller.sns = data.sns;
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
      if (p.avatar) me.avatar = p.avatar;
      if (p.bio) me.bio = p.bio;
      if (p.concerns && p.concerns.length) me.concerns = p.concerns;
      return Promise.resolve(me);
    },
    setProfile: function (data) {
      var st = getState();
      st.profile = { avatar: data.avatar || null, bio: data.bio || "", concerns: data.concerns || [] };
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
