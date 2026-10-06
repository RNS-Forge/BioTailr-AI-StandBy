const { getTargetTab, connectWebSocket, cdpEval } = require('../core/cdp-client');

(async () => {
  const tab = await getTargetTab(9222, ['linkedin.com/jobs']);
  console.log('Target tab:', tab.url);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);

  const res = await cdpEval(ws, `(() => {
    // Scroll down results list
    const list = document.querySelector('.jobs-search-results-list, .scaffold-layout__list-detail-inner');
    if (list) list.scrollTop = list.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);

    const pag = document.querySelector('.jobs-search-pagination, .artdeco-pagination, .jobs-search-results-list__pagination');
    const btns = Array.from(document.querySelectorAll('.artdeco-pagination__indicator button, .artdeco-pagination__button, [aria-label*="page" i], [aria-label*="Page"], .jobs-search-pagination__button--next, .jobs-search-results-list__pagination button, [data-test-pagination-page-btn]'));
    return {
      hasPag: !!pag,
      pagHtml: pag ? pag.outerHTML.substring(0, 300) : null,
      btns: btns.map(b => ({
        tag: b.tagName,
        text: b.innerText.trim(),
        aria: b.getAttribute('aria-label'),
        classes: b.className,
        rect: b.getBoundingClientRect()
      })),
      url: window.location.href
    };
  })()`);
  console.log(JSON.stringify(res, null, 2));
  ws.close();
})();
