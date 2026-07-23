/* =========================================================
   store.supabase.js — window.api の Supabase 実装（実バックエンド接続）
   store.js（モック）と同じインターフェースを実 Supabase で提供する。
   - backend が "supabase" のときだけ window.api を上書き（それ以外はモックのまま）
   - supabase-js は CDN(ESM) から動的import（ビルド不要を維持）
   - 同期契約(getSession/isFavorite/checkMessage/canReview)は localStorage/正規表現で即返し
   - 集計はビュー(plan_stats/creator_stats)。PostgRESTはビューを埋め込めないため
     フラットに取得して JS でマージする（埋め込みはベーステーブルのみ）
   - ローカルは Stripe 未接続のため purchase は orders へ直接インサート
     （手数料20%・エスクロー状態・スレッド開通は DB トリガが担保）
   ========================================================= */
(function () {
  if ((window.AMIE_CONFIG || {}).backend !== "supabase") return;   // モック時は何もしない
  var cfg = window.AMIE_CONFIG || {};
  var STORAGE_KEY = "amie-auth", FAV_KEY = "amie-fav", REVIEWED_KEY = "amie-reviewed";

  var _imp = null, _sb = null;
  function sb() {
    if (_sb) return Promise.resolve(_sb);
    if (!_imp) _imp = import("https://esm.sh/@supabase/supabase-js@2").then(function (m) {
      _sb = m.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { storageKey: STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
      return _sb;
    });
    return _imp;
  }

  /* ---------- 同期ヘルパー ---------- */
  function readSession() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      var s = raw && (raw.access_token ? raw : raw.currentSession);
      if (s && s.access_token && s.user) return { userId: s.user.id, provider: "supabase" };
    } catch (e) {}
    return null;
  }
  function uid() { var s = readSession(); return s && s.userId; }
  function favSet() { try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY)) || []); } catch (e) { return new Set(); } }
  function saveFav(set) { localStorage.setItem(FAV_KEY, JSON.stringify(Array.prototype.slice.call(set))); }
  function reviewedSet() { try { return new Set(JSON.parse(localStorage.getItem(REVIEWED_KEY)) || []); } catch (e) { return new Set(); } }
  function saveReviewed(set) { localStorage.setItem(REVIEWED_KEY, JSON.stringify(Array.prototype.slice.call(set))); }

  var NG = [
    { re: /https?:\/\/|\.com|\.jp|\.me\b/i, label: "外部サイトURL" },
    { re: /\bline\b|ライン(交換|のid|@|＠)|カカオ|id交換|連絡先.{0,4}(交換|教え)/i, label: "外部連絡先への誘導" },
    { re: /\d{10,}/, label: "電話・口座番号らしき数字" },
    { re: /(振込|口座番号|現金書留|直接.{0,3}(振込|支払))/, label: "外部決済への誘導" }
  ];
  var TYPE_LABEL = { celebrity: "芸能人・著名人", influencer: "インフルエンサー", pro: "プロ", general: "一般" };

  /* ---------- 集計ビューをフラット取得してマップ化（埋め込み不可の回避）---------- */
  function statsMaps() {
    return sb().then(function (c) {
      return Promise.all([c.from("plan_stats").select("*"), c.from("creator_stats").select("*")]);
    }).then(function (res) {
      var pm = {}, cm = {};
      ((res[0] && res[0].data) || []).forEach(function (x) { pm[x.plan_id] = x; });
      ((res[1] && res[1].data) || []).forEach(function (x) { cm[x.creator_id] = x; });
      return { plan: pm, creator: cm };
    });
  }

  /* ---------- 整形（モックの返り値形に合わせる）---------- */
  function shapeCreator(row, maps) {
    if (!row) return null;
    var sns = {}; (row.sns_accounts || []).forEach(function (s) { sns[s.provider] = s.follower_count; });
    var st = (maps && maps.creator[row.id]) || {};
    return {
      id: row.id, name: (row.profiles && row.profiles.display_name) || row.handle, handle: row.handle,
      type: row.type, typeLabel: TYPE_LABEL[row.type] || "出品者", verified: row.verified,
      tagline: row.tagline, bio: row.bio, categories: row.categories || [], concerns: row.concerns || [],
      sns: sns, stats: { sales: Number(st.sales) || 0, rating: Number(st.rating) || 0, repeat: 0 },
      plans: (row.plans || []).map(function (p) { return shapePlan(p, maps); })
    };
  }
  function shapePlan(row, maps) {
    if (!row) return null;
    var st = (maps && maps.plan[row.id]) || {};
    return {
      id: row.id, creatorId: row.creator_id, title: row.title, format: row.format, price: row.price,
      category: row.category, concerns: row.concerns || [], desc: row.description,
      chatDays: row.chat_days, minutes: row.minutes, monthlyVideos: row.monthly_videos, chatIncluded: row.chat_included,
      stats: { rating: Number(st.rating) || 0, sales: Number(st.sales_count) || 0 },
      creator: row.creators ? shapeCreator(row.creators, maps) : null,
      reviews: (row.reviews || []).map(shapeReview)
    };
  }
  function shapeReview(r) { return { userId: r.buyer_id, rating: r.rating, body: r.body, date: fmtDate(r.created_at), planId: r.plan_id }; }
  function shapeOrder(o, maps) {
    return {
      id: o.id, planId: o.plan_id, creatorId: o.creator_id, format: o.format, price: o.price,
      status: o.status, slot: o.slot ? fmtDate(o.slot) : null, createdLabel: fmtDate(o.created_at),
      reviewable: o.status === "completed" && !reviewedSet().has(o.id),
      plan: o.plans ? shapePlan(o.plans, maps) : null,
      creator: o.creators ? shapeCreator(o.creators, maps) : null
    };
  }
  function fmtDate(t) { if (!t) return ""; try { return new Date(t).toLocaleDateString("ja-JP"); } catch (e) { return t; } }
  function snsTotal(c) { var s = c.sns || {}; return (s.instagram || 0) + (s.tiktok || 0) + (s.youtube || 0) + (s.x || 0); }

  // 埋め込みはベーステーブルのみ（ビューは含めない）
  var CREATOR_SEL = "*, sns_accounts(*), profiles(display_name)";
  var PLAN_SEL = "*, creators(*, sns_accounts(*), profiles(display_name)), reviews(*)";

  function refreshFav() {
    var u = uid(); if (!u) { saveFav(new Set()); return Promise.resolve(new Set()); }
    return sb().then(function (c) { return c.from("favorites").select("target_type,target_id").eq("profile_id", u); })
      .then(function (r) { var set = new Set(((r.data) || []).map(function (f) { return f.target_type + ":" + f.target_id; })); saveFav(set); return set; });
  }

  var api = {
    /* ---------- 出品者 ---------- */
    getCreators: function (p) {
      p = p || {};
      return Promise.all([sb(), statsMaps()]).then(function (a) {
        var c = a[0], maps = a[1];
        var q = c.from("creators").select(CREATOR_SEL);
        if (p.type) q = q.eq("type", p.type);
        if (p.cat) q = q.overlaps("categories", String(p.cat).split(","));
        if (p.concern) q = q.overlaps("concerns", String(p.concern).split(","));
        return q.then(function (r) {
          var list = ((r.data) || []).map(function (row) { return shapeCreator(row, maps); });
          if (p.q) { var s = p.q.toLowerCase(); list = list.filter(function (x) { return (x.name + x.handle + x.tagline).toLowerCase().indexOf(s) !== -1; }); }
          return list;
        });
      });
    },
    getFeaturedCreators: function (n) {
      return Promise.all([sb(), statsMaps()]).then(function (a) {
        return a[0].from("creators").select(CREATOR_SEL).then(function (r) {
          var list = ((r.data) || []).map(function (row) { return shapeCreator(row, a[1]); });
          list.sort(function (x, y) { return snsTotal(y) - snsTotal(x); });
          return n ? list.slice(0, n) : list;
        });
      });
    },
    getCreator: function (id) {
      return Promise.all([sb(), statsMaps()]).then(function (a) {
        var c = a[0], maps = a[1];
        return Promise.all([
          c.from("creators").select(CREATOR_SEL + ", plans(*)").eq("id", id).maybeSingle(),
          c.from("reviews").select("*, plans!inner(creator_id)").eq("plans.creator_id", id).order("created_at", { ascending: false })
        ]).then(function (res) {
          var cr = shapeCreator(res[0] && res[0].data, maps);
          if (cr) cr.reviews = (((res[1] && res[1].data)) || []).map(shapeReview);
          return cr;
        });
      });
    },

    /* ---------- プラン ---------- */
    getPlans: function (p) {
      p = p || {};
      return Promise.all([sb(), statsMaps()]).then(function (a) {
        var c = a[0], maps = a[1];
        var q = c.from("plans").select(PLAN_SEL).eq("status", "published");
        if (p.creatorId) q = q.eq("creator_id", p.creatorId);
        if (p.cat) q = q.in("category", String(p.cat).split(","));
        if (p.concern) q = q.overlaps("concerns", String(p.concern).split(","));
        if (p.format) q = q.eq("format", p.format);
        if (p.priceMax) q = q.lte("price", Number(p.priceMax));
        return q.then(function (r) {
          var list = ((r.data) || []).map(function (row) { return shapePlan(row, maps); });
          if (p.q) { var s = p.q.toLowerCase(); list = list.filter(function (x) { return (x.title + x.desc + (x.creator ? x.creator.name : "")).toLowerCase().indexOf(s) !== -1; }); }
          return list;
        });
      });
    },
    getPlan: function (id) {
      return Promise.all([sb(), statsMaps(), refreshFav()]).then(function (a) {
        return a[0].from("plans").select(PLAN_SEL).eq("id", id).maybeSingle()
          .then(function (r) { return shapePlan(r.data, a[1]); });
      });
    },
    getNewPlans: function (n) {
      return Promise.all([sb(), statsMaps()]).then(function (a) {
        return a[0].from("plans").select(PLAN_SEL).eq("status", "published").order("created_at", { ascending: false }).limit(n || 6)
          .then(function (r) { return ((r.data) || []).map(function (row) { return shapePlan(row, a[1]); }); });
      });
    },
    getReviews: function (planId) {
      return sb().then(function (c) { return c.from("reviews").select("*").eq("plan_id", planId).order("created_at", { ascending: false }); })
        .then(function (r) { return ((r.data) || []).map(shapeReview); });
    },
    postReview: function (orderId, planId, rating, body) {
      var u = uid();
      return sb().then(function (c) { return c.from("reviews").insert({ order_id: orderId, plan_id: planId, buyer_id: u, rating: rating, body: body }); })
        .then(function (r) { if (r.error) throw r.error; var s = reviewedSet(); s.add(orderId); saveReviewed(s); });
    },
    canReview: function (orderId) { return !reviewedSet().has(orderId); },
    checkMessage: function (text) { for (var i = 0; i < NG.length; i++) if (NG[i].re.test(text)) return NG[i].label; return null; },

    /* ---------- お気に入り ---------- */
    toggleFavorite: function (kind, id) {
      var u = uid(), key = kind + ":" + id, set = favSet();
      return sb().then(function (c) {
        if (set.has(key)) return c.from("favorites").delete().match({ profile_id: u, target_type: kind, target_id: id }).then(function () { set.delete(key); saveFav(set); return false; });
        return c.from("favorites").insert({ profile_id: u, target_type: kind, target_id: id }).then(function () { set.add(key); saveFav(set); return true; });
      });
    },
    isFavorite: function (kind, id) { return favSet().has(kind + ":" + id); },
    getFavorites: function () {
      var self = this;
      return refreshFav().then(function (set) {
        var plans = [], creators = [];
        return Promise.all(Array.prototype.slice.call(set).map(function (k) {
          var parts = k.split(":");
          if (parts[0] === "plan") return self.getPlan(parts[1]).then(function (p) { if (p) plans.push(p); });
          return self.getCreator(parts[1]).then(function (c) { if (c) creators.push(c); });
        })).then(function () { return { plans: plans, creators: creators }; });
      });
    },

    /* ---------- 購入（orders へ直接インサート。手数料/スレッドはトリガ）---------- */
    purchase: function (planId, opts) {
      opts = opts || {}; var u = uid();
      return sb().then(function (c) { return c.from("plans").select("creator_id, format, price").eq("id", planId).single(); })
        .then(function (r) {
          if (r.error) throw r.error; var plan = r.data;
          return sb().then(function (c) {
            return c.from("orders").insert({
              plan_id: planId, buyer_id: u, creator_id: plan.creator_id, format: plan.format,
              price: plan.price, status: plan.format === "monthly" ? "active" : "progress", slot: opts.slotIso || null
            }).select().single();
          });
        }).then(function (r) { if (r.error) throw r.error; var o = shapeOrder(r.data, null); if (opts.slot) o.slot = opts.slot; return o; });
    },
    getOrders: function () {
      return Promise.all([sb(), statsMaps()]).then(function (a) {
        return a[0].from("orders").select("*, plans(*), creators(*, profiles(display_name))").order("created_at", { ascending: false })
          .then(function (r) { return ((r.data) || []).map(function (o) { return shapeOrder(o, a[1]); }); });
      }).then(function (list) { return this._syncReviewed(list); }.bind(this));
    },
    getOrder: function (id) { return this.getOrders().then(function (l) { return l.filter(function (o) { return o.id === id; })[0] || null; }); },
    _syncReviewed: function (orders) {
      return sb().then(function (c) { return c.from("reviews").select("order_id"); }).then(function (r) {
        var s = reviewedSet(); ((r.data) || []).forEach(function (x) { s.add(x.order_id); }); saveReviewed(s);
        orders.forEach(function (o) { o.reviewable = o.status === "completed" && !s.has(o.id); });
        return orders;
      }).catch(function () { return orders; });
    },
    completeOrder: function (orderId) { return sb().then(function (c) { return c.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", orderId).eq("status", "progress"); }); },
    cancelSubscription: function (orderId) { return sb().then(function (c) { return c.from("orders").update({ status: "canceled" }).eq("id", orderId); }); },

    /* ---------- メッセージ ---------- */
    getThreads: function () {
      var self = this;
      return this.getOrders().then(function (orders) {
        return Promise.all(orders.map(function (o) { return self.getThread(o.id).then(function (m) { return { order: o, last: m[m.length - 1] || null }; }); }));
      });
    },
    getThread: function (orderId) {
      var u = uid();
      return sb().then(function (c) { return c.from("messages").select("*").eq("order_id", orderId).order("created_at"); })
        .then(function (r) {
          return ((r.data) || []).map(function (m) {
            var mine = m.sender === "buyer" && m.sender_id === u;
            return { from: mine ? "me" : "them", body: m.body, image: !!m.image_url, read: !!m.read_at, timeLabel: fmtDate(m.created_at) };
          });
        });
    },
    sendMessage: function (orderId, body, opts) {
      opts = opts || {}; var u = uid(), self = this;
      return sb().then(function (c) { return c.from("messages").insert({ order_id: orderId, sender: "buyer", sender_id: u, body: body, image_url: opts.image ? "(uploaded)" : null }); })
        .then(function (r) { if (r.error) throw r.error; return self.getThread(orderId); });
    },

    /* ---------- 通知 ---------- */
    getNotifications: function () {
      return sb().then(function (c) { return c.from("notifications").select("*").order("created_at", { ascending: false }); })
        .then(function (r) { return ((r.data) || []).map(function (n) { return { id: n.id, type: n.type, title: n.title, date: fmtDate(n.created_at), read: n.read, actor: null }; }); }).catch(function () { return []; });
    },
    getUnreadCount: function () { return this.getNotifications().then(function (l) { return l.filter(function (n) { return !n.read; }).length; }).catch(function () { return 0; }); },
    markNotificationRead: function (id) { return sb().then(function (c) { return c.from("notifications").update({ read: true }).eq("id", id); }); },
    markAllNotificationsRead: function () { var u = uid(); return sb().then(function (c) { return c.from("notifications").update({ read: true }).eq("profile_id", u); }); },

    /* ---------- 自分（購入者）---------- */
    getMe: function () {
      var u = uid(); if (!u) return Promise.resolve(null);
      return sb().then(function (c) { return c.from("profiles").select("*").eq("id", u).maybeSingle(); })
        .then(function (r) { var p = r.data || {}; return { id: u, name: p.display_name || "ゲスト", bio: p.bio || "", concerns: p.concerns || [] }; });
    },
    setProfile: function (data) { var u = uid(); return sb().then(function (c) { return c.from("profiles").update({ bio: data.bio || "", concerns: data.concerns || [] }).eq("id", u); }); },

    /* ---------- 出品者（自分）---------- */
    _myCreatorRow: function () { var u = uid(); if (!u) return Promise.resolve(null); return sb().then(function (c) { return c.from("creators").select(CREATOR_SEL + ", plans(*)").eq("profile_id", u).maybeSingle(); }).then(function (r) { return r.data; }); },
    getMySeller: function () { return Promise.all([this._myCreatorRow(), statsMaps()]).then(function (a) { return shapeCreator(a[0], a[1]); }); },
    setMySeller: function (data) {
      var u = uid(), self = this;
      return this._myCreatorRow().then(function (existing) {
        var handle = (existing && existing.handle) || ("you_" + u.slice(0, 6));
        var payload = { profile_id: u, handle: handle, tagline: data.tagline || "", bio: data.bio || "", categories: data.categories || [] };
        return sb().then(function (c) {
          return c.from("creators").upsert(payload, { onConflict: "profile_id" }).select().single().then(function (r) {
            if (r.error) throw r.error; var cid = r.data.id, rows = [];
            if (data.sns && data.sns.instagram) rows.push({ creator_id: cid, provider: "instagram", handle: handle, follower_count: data.sns.instagram });
            if (data.sns && data.sns.tiktok) rows.push({ creator_id: cid, provider: "tiktok", handle: handle, follower_count: data.sns.tiktok });
            if (!rows.length) return; return c.from("sns_accounts").upsert(rows, { onConflict: "creator_id,provider" });
          });
        });
      }).then(function () { return self.getMySeller(); });
    },
    getMyPlans: function () {
      return Promise.all([this._myCreatorRow(), statsMaps()]).then(function (a) {
        var cr = a[0]; if (!cr) return [];
        var creatorShaped = shapeCreator(cr, a[1]);
        return (cr.plans || []).map(function (p) { var sp = shapePlan(p, a[1]); sp.creator = creatorShaped; return sp; }).reverse();
      });
    },
    createPlan: function (data) {
      var self = this, u = uid();
      return this._myCreatorRow().then(function (cr) {
        var ensure = cr ? Promise.resolve(cr) : self.setMySeller({ tagline: "", bio: "", categories: [data.category], sns: {} }).then(function () { return self._myCreatorRow(); });
        return ensure.then(function (creator) {
          var row = { creator_id: creator.id, title: data.title, format: data.format, price: Number(data.price), category: data.category, concerns: data.concerns || [], description: data.desc, status: "published" };
          if (data.format === "chat") row.chat_days = data.chatDays || 7;
          if (data.format === "video") row.minutes = data.minutes || 60;
          if (data.format === "monthly") { row.monthly_videos = data.monthlyVideos || 0; row.chat_included = true; }
          return sb().then(function (c) { return c.from("plans").insert(row).select("id").single(); })
            .then(function (r) { if (r.error) throw r.error; return self.getPlan(r.data.id); });
        });
      });
    },

    /* ---------- 運営管理（A1-A4）---------- */
    getAdminQueue: function () { return this.getNewPlans(8).then(function (plans) { return plans.map(function (p) { return { plan: p, flagged: p.price > 50000, newSeller: p.creator && p.creator.type === "general" }; }); }); },
    getAdminReports: function () { return sb().then(function (c) { return c.from("reports").select("*").order("created_at", { ascending: false }); }).then(function (r) { return ((r.data) || []).map(function (x) { return { id: x.id, target: x.target_type, reason: x.reason, date: fmtDate(x.created_at), status: x.status }; }); }).catch(function () { return []; }); },
    getAdminPayouts: function () { return sb().then(function (c) { return c.from("payouts").select("*, creators(handle)"); }).then(function (r) { return ((r.data) || []).map(function (x) { return { id: x.id, creator: x.creators ? x.creators.handle : "", amount: x.amount, kyc: x.kyc_verified, status: x.status }; }); }).catch(function () { return []; }); },
    report: function (data) { var u = uid(); return sb().then(function (c) { return c.from("reports").insert({ reporter_id: u, target_type: data.target || "unknown", reason: data.reason || "" }); }).then(function () { return { ok: true }; }).catch(function () { return { ok: true }; }); },

    /* ---------- 認証（ローカルは匿名サインイン。本番はOAuthに置換）---------- */
    login: function (provider) {
      return sb().then(function (c) { return c.auth.signInAnonymously(); })
        .then(function (res) { if (res.error) throw res.error; return { userId: res.data.user.id, provider: provider || "anonymous" }; });
    },
    logout: function () { localStorage.removeItem(FAV_KEY); localStorage.removeItem(REVIEWED_KEY); return sb().then(function (c) { return c.auth.signOut(); }); },
    getSession: function () { return readSession(); }
  };

  window.api = api;
})();
