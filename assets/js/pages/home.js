/* S1 TOP
   並び: ヒーロー → カテゴリ → 注目の出品者 → 新着プラン → 悩みタグ → 利用の流れ → 出品者募集 → フッター
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
        hero() +
        catSection() +
        featuredSection(creators) +
        newPlansSection(plans) +
        concernSection() +
        stepsSection() +
        recruitSection() +
        UI.siteFooter();
      bindHero();
    });
  });

  function hero() {
    return (
      '<div class="hero">' +
      '<p class="hero__logo">amie</p>' +
      '<p class="hero__copy">憧れの人に、相談できる。</p>' +
      '<p class="hero__sub">メイク・美容・ファッション・暮らしのこと。</p>' +
      '<form id="home-search" class="search-cta">' + UI.icon("search") +
      '<input name="q" type="search" placeholder="やりたいこと・お名前で探す">' +
      '<button class="search-cta__btn" type="submit">探す</button></form>' +
      "</div>"
    );
  }

  function catSection() {
    var cells = TAX.categories.map(function (c) {
      return '<a class="cat-cell" href="' + h("search/index.html?cat=" + c.slug) + '">' +
        UI.icon(c.icon) + "<span>" + esc(c.label) + "</span></a>";
    }).join("");
    return (
      '<div class="section">' +
      '<p class="section__title">カテゴリから探す</p>' +
      '<div class="cat-grid">' + cells + "</div></div>"
    );
  }

  function featuredSection(creators) {
    return (
      '<div class="section hr">' +
      '<p class="section__title">注目の出品者' +
      '<a class="more" href="' + h("search/index.html?tab=creators") + '">もっと見る ' + UI.icon("chevron-right") + "</a></p>" +
      '<div class="creator-scroll">' + creators.map(UI.creatorMini).join("") + "</div></div>"
    );
  }

  function newPlansSection(plans) {
    return (
      '<div class="section hr">' +
      '<p class="section__title">新着のプラン' +
      '<a class="more" href="' + h("search/index.html") + '">もっと見る ' + UI.icon("chevron-right") + "</a></p>" +
      '<div class="plan-grid">' + plans.map(UI.planCard).join("") + "</div></div>"
    );
  }

  function concernSection() {
    var tags = TAX.concerns.map(function (c) {
      return '<a class="pill pill--outline" href="' + h("search/index.html?concern=" + c.slug) + '">#' + esc(c.label) + "</a>";
    }).join("");
    return (
      '<div class="section hr">' +
      '<p class="section__title">お悩みから探す</p>' +
      '<div class="tag-cloud">' + tags + "</div></div>"
    );
  }

  function stepsSection() {
    return (
      '<div class="section hr">' +
      '<p class="section__title">amieの使い方</p>' +
      '<div class="steps">' +
      '<div class="step"><span class="step__no">1</span><p class="step__t">さがす</p><p class="step__d">憧れの人・悩みで</p></div>' +
      '<div class="step"><span class="step__no">2</span><p class="step__t">はなす</p><p class="step__d">チャット / ビデオ</p></div>' +
      '<div class="step"><span class="step__no">3</span><p class="step__t">なりたい私へ</p><p class="step__d">その日から変わる</p></div>' +
      "</div></div>"
    );
  }

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

  function bindHero() {
    var f = document.getElementById("home-search");
    if (f) f.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = this.q.value.trim();
      App.goto("search/index.html" + (q ? "?q=" + encodeURIComponent(q) : ""));
    });
  }
})();
