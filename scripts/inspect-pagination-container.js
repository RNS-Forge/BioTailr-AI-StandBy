const { getTargetTab, connectWebSocket, cdpEval } = require('../core/cdp-client');

(async () => {
  const tab = await getTargetTab(9222, ['linkedin.com/jobs']);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);

  const res = await cdpEval(ws, `(() => {
    const list = document.querySelector('[data-testid="pagination-controls-list"]');
    if (!list) return 'no list';
    const parent = list.closest('nav') || list.parentElement;
    return {
      html: parent.outerHTML,
      buttons: Array.from(parent.querySelectorAll('button')).map(b => ({
        text: b.innerText.trim(),
        aria: b.getAttribute('aria-label'),
        testid: b.getAttribute('data-testid'),
        ariaCurrent: b.getAttribute('aria-current'),
        disabled: b.disabled
      }))
    };
  })()`);
  console.log(JSON.stringify(res, null, 2));
  ws.close();
})();
