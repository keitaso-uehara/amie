/* S1 TOP（箱型マーケットプレイス型）
   並び: 検索バー → カテゴリ横スクロール → 近日開始バナー → 注目の出品者の棚
        → 人気のプランの棚 → 事前登録CTA → 出品者募集 → フッター
   （ココナラ/メルカリ型の"見慣れた箱型"。詳細は beauty-mentor-spec/画面構成メモ_プレローンチ.md）
   クエリ読取→api→描画 の3層を守る。 */
(function () {
  var esc = function (s) { return App.esc(s); };
  var h = function (p) { return App.href(p); };

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    Promise.all([
      api.getFeaturedCreators(8),
      api.getNewPlans(6)
    ]).then(function (res) {
      var creators = res[0], plans = res[1];
      main.innerHTML =
        searchBar() +
        categoryRow() +
        promoBanner() +
        featuredShelf(creators) +
        plansShelf(plans) +
        preRegCTA() +
        recruitSection() +
        UI.siteFooter();
      bindSearch();
    });
  });

  /* ① 検索バー（上部・目的が明確な人の主導線） */
  function searchBar() {
    return (
      '<div class="home-search-wrap">' +
      '<form id="home-search" class="home-search">' + UI.icon("search") +
      '<input name="q" type="search" placeholder="やりたいこと・お名前で探す" autocomplete="off">' +
      "</form></div>"
    );
  }

  /* ② カテゴリの横スクロール（見慣れたカテゴリナビ・ブラウズ派の主導線） */
  function categoryRow() {
    var chips = TAX.categories.map(function (c) {
      return '<a class="cat-chip" href="' + h("search/index.html?cat=" + c.slug) + '">' +
        '<span class="cat-chip__ic">' + UI.icon(c.icon) + "</span>" +
        '<span class="cat-chip__l">' + esc(c.label) + "</span></a>";
    }).join("");
    var all = '<a class="cat-chip" href="' + h("search/index.html") + '">' +
      '<span class="cat-chip__ic cat-chip__ic--all">' + UI.icon("dots") + "</span>" +
      '<span class="cat-chip__l">すべて</span></a>';
    return '<div class="cat-row">' + chips + all + "</div>";
  }

  /* ③ 近日開始バナー（新サービスなので"何ができるか"を明示） */
  function promoBanner() {
    return (
      '<div class="section" style="padding-top:12px;padding-bottom:8px;">' +
      '<div class="promo">' +
      '<span class="promo__badge">近日開始・事前登録受付中</span>' +
      '<p class="promo__copy">憧れの人に、相談できる。</p>' +
      '<p class="promo__sub">メイク・コーデ・暮らしを、憧れの人が直接アドバイス。</p>' +
      "</div></div>"
    );
  }

  /* ④ 注目の出品者の棚 */
  function featuredShelf(creators) {
    return (
      '<div class="section">' +
      '<p class="section__title">注目の出品者' +
      '<a class="more" href="' + h("search/index.html?tab=creators") + '">もっと見る ' + UI.icon("chevron-right") + "</a></p>" +
      '<div class="creator-scroll">' + creators.map(UI.creatorMini).join("") + "</div></div>"
    );
  }

  /* ⑤ 人気のプランの棚 */
  function plansShelf(plans) {
    return (
      '<div class="section">' +
      '<p class="section__title">人気のプラン' +
      '<a class="more" href="' + h("search/index.html") + '">もっと見る ' + UI.icon("chevron-right") + "</a></p>" +
      '<div class="plan-grid">' + plans.map(UI.planCard).join("") + "</div></div>"
    );
  }

  /* ⑥ 事前登録CTA */
  function preRegCTA() {
    return (
      '<div class="section" style="padding-top:8px;">' +
      '<a class="prereg-cta" href="' + h("login/index.html") + '">' + UI.icon("bell") + " 開始したら通知を受け取る</a>" +
      "</div>"
    );
  }

  /* ⑦ 出品者募集（購入者ファーストなので小さく下部に） */
  function recruitSection() {
    return (
      '<div class="section">' +
      '<a class="recruit" href="' + h("guide.html") + '">' +
      '<p class="recruit__label">' + UI.icon("sparkles") + " 出品者募集</p>" +
      '<p class="recruit__lead">あなたの「好き」を、<br>次の収入に。</p>' +
      '<span class="recruit__cta">出品者ガイドを見る ' + UI.icon("arrow-right") + "</span>" +
      "</a></div>"
    );
  }

  function bindSearch() {
    var f = document.getElementById("home-search");
    if (f) f.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = this.q.value.trim();
      App.goto("search/index.html" + (q ? "?q=" + encodeURIComponent(q) : ""));
    });
  }
})();
