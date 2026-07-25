/* 静的ページ共通レンダラー。body[data-static] の slug を読み、
   window.DB.staticPages から本文を描画する(仕様書 S16)。 */
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    var slug = document.body.dataset.static;
    var page = (window.DB.staticPages || {})[slug];
    if (!page) { main.innerHTML = UI.empty("ページが見つかりませんでした。", "ホームへ", "index.html"); return; }
    document.title = page.title + " | ELLMIE";
    main.innerHTML =
      '<div class="page-head"><h1>' + App.esc(page.title) + "</h1></div>" +
      '<div class="prose">' + page.html + "</div>" +
      UI.siteFooter();
  });
})();
