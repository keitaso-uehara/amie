/* =========================================================
   store.supabase.js — window.api の Supabase 実装（リファレンス）
   store.js（モック）と同じインターフェースを、実バックエンドで提供する。
   各HTMLで store.js の代わりにこのファイルを読み込むと接続先が切り替わる。
   supabase-js は CDN(ESM) から動的import。ビルド不要の方針を維持。
   ※ 動作には config.js の supabaseUrl / anon key と、稼働中の Supabase が必要。
   ========================================================= */
window.api = (function () {
  var cfg = window.AMIE_CONFIG || {};
  var _sb = null;

  // supabase クライアントを遅延生成（初回API呼び出し時）
  function sb() {
    if (_sb) return Promise.resolve(_sb);
    return import("https://esm.sh/@supabase/supabase-js@2").then(function (m) {
      _sb = m.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      return _sb;
    });
  }
  function fn(name, body) {
    return sb().then(function (c) { return c.functions.invoke(name, { body: body }); })
      .then(function (r) { if (r.error) throw r.error; return r.data; });
  }

  /* 出品者＋SNS＋統計を1件に整形（モックの hydrateCreator 相当） */
  function shapeCreator(row) {
    if (!row) return null;
    var sns = {};
    (row.sns_accounts || []).forEach(function (s) { sns[s.provider] = s.follower_count; });
    var st = row.creator_stats || {};
    return {
      id: row.id, name: row.display_name || (row.profiles && row.profiles.display_name), handle: row.handle,
      type: row.type, typeLabel: typeLabel(row.type), verified: row.verified,
      tagline: row.tagline, bio: row.bio, categories: row.categories, concerns: row.concerns,
      sns: sns, stats: { sales: st.sales || 0, rating: st.rating || 0, repeat: 0 },
      plans: (row.plans || []).map(shapePlan)
    };
  }
  function shapePlan(row) {
    return {
      id: row.id, creatorId: row.creator_id, title: row.title, format: row.format, price: row.price,
      category: row.category, concerns: row.concerns, desc: row.description,
      chatDays: row.chat_days, minutes: row.minutes, monthlyVideos: row.monthly_videos, chatIncluded: row.chat_included,
      stats: { rating: row.rating || 0, sales: row.sales_count || 0 },
      creator: row.creators ? shapeCreator(row.creators) : null,
      reviews: (row.reviews || []).map(shapeReview)
    };
  }
  function shapeReview(r) { return { userId: r.buyer_id, rating: r.rating, body: r.body, date: r.created_at }; }
  function typeLabel(t) { return { celebrity: "芸能人・著名人", influencer: "インフルエンサー", pro: "プロ", general: "一般" }[t] || "出品者"; }

  var CREATOR_SELECT = "*, sns_accounts(*), creator_stats(*), profiles(display_name)";
  var PLAN_SELECT = "*, creators(*, sns_accounts(*), profiles(display_name))";

  return {
    /* ---------- 出品者 ---------- */
    getCreators: function (p) {
      p = p || {};
      return sb().then(function (c) {
        var q = c.from("creators").select(CREATOR_SELECT);
        if (p.type) q = q.eq("type", p.type);
        if (p.cat) q = q.overlaps("categories", String(p.cat).split(","));
        if (p.concern) q = q.overlaps("concerns", String(p.concern).split(","));
        return q;
      }).then(function (r) { return (r.data || []).map(shapeCreator); });
    },
    getCreator: function (id) {
      return sb().then(function (c) {
        return c.from("creators").select(CREATOR_SELECT + ", plans(*, plan_stats(*))").eq("id", id).single();
      }).then(function (r) { return shapeCreator(r.data); });
    },
    getFeaturedCreators: function (n) {
      return sb().then(function (c) {
        return c.from("creators").select(CREATOR_SELECT + ", creator_stats!inner(sns_total)")
          .order("sns_total", { foreignTable: "creator_stats", ascending: false }).limit(n || 8);
      }).then(function (r) { return (r.data || []).map(shapeCreator); });
    },

    /* ---------- プラン ---------- */
    getPlans: function (p) {
      p = p || {};
      return sb().then(function (c) {
        var q = c.from("plans_public").select("*, creators(*, sns_accounts(*), profiles(display_name))");
        if (p.creatorId) q = q.eq("creator_id", p.creatorId);
        if (p.cat) q = q.in("category", String(p.cat).split(","));
        if (p.format) q = q.eq("format", p.format);
        if (p.priceMax) q = q.lte("price", Number(p.priceMax));
        return q;
      }).then(function (r) { return (r.data || []).map(shapePlan); });
    },
    getPlan: function (id) {
      return sb().then(function (c) {
        return c.from("plans").select(PLAN_SELECT + ", plan_stats(*), reviews(*)").eq("id", id).single();
      }).then(function (r) { return shapePlan(r.data); });
    },
    getNewPlans: function (n) {
      return sb().then(function (c) {
        return c.from("plans_public").select("*, creators(*, sns_accounts(*), profiles(display_name))")
          .order("created_at", { ascending: false }).limit(n || 6);
      }).then(function (r) { return (r.data || []).map(shapePlan); });
    },
    getReviews: function (planId) {
      return sb().then(function (c) { return c.from("reviews").select("*").eq("plan_id", planId); })
        .then(function (r) { return (r.data || []).map(shapeReview); });
    },
    postReview: function (orderId, planId, rating, body) {
      return sb().then(function (c) { return uid(c).then(function (u) {
        return c.from("reviews").insert({ order_id: orderId, plan_id: planId, buyer_id: u, rating: rating, body: body });
      }); });
    },

    /* ---------- 購入・取引（Edge Function 経由でエスクロー）---------- */
    purchase: function (planId, opts) {
      opts = opts || {};
      return uidOnly().then(function (u) {
        return fn("create-order", { planId: planId, buyerId: u, slot: opts.slot, promoCode: opts.promoCode });
      }).then(function (d) { return d.order; });
    },
    completeOrder: function (orderId) { return fn("complete-order", { orderId: orderId }); },
    getOrders: function () {
      return sb().then(function (c) {
        return c.from("orders").select("*, plans(*), creators(*, profiles(display_name))")
          .order("created_at", { ascending: false });
      }).then(function (r) { return r.data || []; });
    },

    /* ---------- メッセージ（Realtime 購読も可能）---------- */
    getThread: function (orderId) {
      return sb().then(function (c) { return c.from("messages").select("*").eq("order_id", orderId).order("created_at"); })
        .then(function (r) { return (r.data || []).map(function (m) {
          return { from: m.sender === "system" ? "them" : (m.sender === "buyer" ? "me" : "them"), body: m.body, image: !!m.image_url, read: !!m.read_at, timeLabel: m.created_at };
        }); });
    },
    sendMessage: function (orderId, body, opts) {
      opts = opts || {};
      return sb().then(function (c) { return uid(c).then(function (u) {
        return c.from("messages").insert({ order_id: orderId, sender: "buyer", sender_id: u, body: body, image_url: opts.image ? "(uploaded)" : null });
      }); }).then(function () { return this.getThread(orderId); }.bind(this));
    },
    subscribeThread: function (orderId, onMsg) {
      return sb().then(function (c) {
        return c.channel("thread:" + orderId)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "order_id=eq." + orderId }, function (p) { onMsg(p.new); })
          .subscribe();
      });
    },
    checkMessage: function (text) {
      // NGワードは ng_words から取得して判定（簡便版）
      return null; // クライアント同期チェックは store.js を参照。実運用はEdge/DBで最終担保
    },

    /* ---------- お気に入り / 通知 ---------- */
    toggleFavorite: function (kind, id) {
      return sb().then(function (c) { return uid(c).then(function (u) {
        return c.from("favorites").select("id").match({ profile_id: u, target_type: kind, target_id: id }).maybeSingle()
          .then(function (r) {
            if (r.data) return c.from("favorites").delete().eq("id", r.data.id).then(function () { return false; });
            return c.from("favorites").insert({ profile_id: u, target_type: kind, target_id: id }).then(function () { return true; });
          });
      }); });
    },
    getNotifications: function () {
      return sb().then(function (c) { return c.from("notifications").select("*").order("created_at", { ascending: false }); })
        .then(function (r) { return r.data || []; });
    },
    getUnreadCount: function () { return this.getNotifications().then(function (l) { return l.filter(function (n) { return !n.read; }).length; }); },
    markAllNotificationsRead: function () {
      return sb().then(function (c) { return uid(c).then(function (u) { return c.from("notifications").update({ read: true }).eq("profile_id", u); }); });
    },

    /* ---------- 認証（Supabase Auth）---------- */
    login: function (provider) {
      return sb().then(function (c) { return c.auth.signInWithOAuth({ provider: provider || "google" }); });
    },
    logout: function () { return sb().then(function (c) { return c.auth.signOut(); }); },
    getSession: function () { return _sb && _sb.auth ? _sb.auth.getSession() : null; }  // 非同期のため実装側で調整
  };

  function uid(c) { return c.auth.getUser().then(function (r) { return r.data.user && r.data.user.id; }); }
  function uidOnly() { return sb().then(uid); }
})();
