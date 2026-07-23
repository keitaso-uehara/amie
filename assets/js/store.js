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
             threads: {}, profile: { avatar: null, bio: "", concerns: [] } };
  }
  function getState() {
    try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY)) || {}); }
    catch (e) { return defaults(); }
  }
  function setState(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* 出品者に、そのプラン一覧と集約レビューを添える */
  function hydrateCreator(c) {
    if (!c) return c;
    c = clone(c);
    c.plans = (c.planIds || []).map(function (pid) {
      return window.DB.plans.filter(function (p) { return p.id === pid; })[0];
    }).filter(Boolean);
    var reviews = [];
    (c.planIds || []).forEach(function (pid) {
      (window.DB.reviews[pid] || []).forEach(function (r) {
        reviews.push(Object.assign({ planId: pid }, r));
      });
    });
    c.reviews = reviews;
    return c;
  }

  /* プランに出品者を添える */
  function hydratePlan(p) {
    if (!p) return p;
    p = clone(p);
    p.creator = window.DB.creators.filter(function (c) { return c.id === p.creatorId; })[0] || null;
    p.reviews = window.DB.reviews[p.id] || [];
    return p;
  }

  return {
    /* ---------- 出品者 ---------- */
    getCreators: function (params) {
      params = params || {};
      var list = window.DB.creators.map(hydrateCreator);
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
      return Promise.resolve(hydrateCreator(window.DB.creators.filter(function (c) { return c.id === id; })[0] || null));
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
      var list = window.DB.plans.map(hydratePlan);
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
      return Promise.resolve(hydratePlan(window.DB.plans.filter(function (p) { return p.id === id; })[0] || null));
    },
    getNewPlans: function (n) {
      var list = window.DB.plans.map(hydratePlan).slice().reverse();
      return Promise.resolve(n ? list.slice(0, n) : list);
    },

    /* ---------- レビュー ---------- */
    getReviews: function (planId) {
      return Promise.resolve(clone(window.DB.reviews[planId] || []));
    },

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
        if (parts[0] === "plan") { var p = hydratePlan(window.DB.plans.filter(function (x) { return x.id === parts[1]; })[0]); if (p) plans.push(p); }
        if (parts[0] === "creator") { var c = hydrateCreator(window.DB.creators.filter(function (x) { return x.id === parts[1]; })[0]); if (c) creators.push(c); }
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
      var plan = window.DB.plans.filter(function (p) { return p.id === planId; })[0];
      if (!plan) return Promise.reject(new Error("plan not found"));
      var order = {
        id: "o_" + st.seq,
        planId: planId,
        creatorId: plan.creatorId,
        format: plan.format,
        price: plan.price,
        status: plan.format === "monthly" ? "active" : "progress",
        slot: opts.slot || null,          // ビデオの予約枠
        createdLabel: "たった今"
      };
      st.orders.push(order);
      // 取引ごとのメッセージスレッドを開く
      st.threads[order.id] = [
        { from: "creator", body: "ご購入ありがとうございます！さっそくよろしくお願いします。", timeLabel: "たった今" }
      ];
      setState(st);
      return Promise.resolve(order);
    },
    getOrders: function () {
      var st = getState();
      var list = st.orders.map(function (o) {
        var out = clone(o);
        out.plan = hydratePlan(window.DB.plans.filter(function (p) { return p.id === o.planId; })[0]);
        out.creator = window.DB.creators.filter(function (c) { return c.id === o.creatorId; })[0] || null;
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
    sendMessage: function (orderId, body) {
      var st = getState();
      st.threads[orderId] = st.threads[orderId] || [];
      st.threads[orderId].push({ from: "me", body: body, timeLabel: "たった今" });
      setState(st);
      return Promise.resolve(clone(st.threads[orderId]));
    },

    /* ---------- 通知 ---------- */
    getNotifications: function () {
      var st = getState();
      var list = clone(window.DB.notifications);
      list.forEach(function (n) {
        if (st.read.indexOf(n.id) !== -1) n.read = true;
        n.actor = n.actorId ? (window.DB.creators.filter(function (c) { return c.id === n.actorId; })[0] || null) : null;
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
      (window.DB.notifications || []).forEach(function (n) { if (st.read.indexOf(n.id) === -1) st.read.push(n.id); });
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
