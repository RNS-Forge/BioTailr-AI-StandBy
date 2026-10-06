const { getTargetTab, connectWebSocket, cdpEval } = require('../core/cdp-client');

async function testPagination() {
  const tab = await getTargetTab(9222, ['linkedin.com/jobs']);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);

  const pagResult = await cdpEval(ws, `(() => {
    // Scroll results container to bottom so pagination is rendered
    const list = document.querySelector('.jobs-search-results-list, .scaffold-layout__list-detail-inner');
    if (list) list.scrollTop = list.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);

    // Find next button or page 2 button
    const nextBtn = document.querySelector('[data-testid="pagination-controls-next-button-visible"], .jobs-search-pagination__button--next, button[aria-label="View next page"], button[aria-label="Next"]');
    if (nextBtn && !nextBtn.disabled && nextBtn.offsetWidth > 0) {
      nextBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = nextBtn.getBoundingClientRect();
      return {
        found: true,
        type: 'next-button',
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2)
      };
    }

    // Try Page 2 button
    const p2Btn = document.querySelector('[aria-label="Page 2"], [data-testid="pagination-indicator-1"]');
    if (p2Btn && !p2Btn.disabled) {
      p2Btn.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = p2Btn.getBoundingClientRect();
      return {
        found: true,
        type: 'page-2-button',
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2)
      };
    }

    return { found: false };
  })()`);

  console.log('Pagination element found:', pagResult);

  if (pagResult && pagResult.found && pagResult.x && pagResult.y) {
    console.log(`Dispatching native CDP click at (${pagResult.x}, ${pagResult.y})...`);
    ws.send(JSON.stringify({
      id: 1001,
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mousePressed', x: pagResult.x, y: pagResult.y, button: 'left', clickCount: 1 }
    }));
    await new Promise(r => setTimeout(r, 50));
    ws.send(JSON.stringify({
      id: 1002,
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mouseReleased', x: pagResult.x, y: pagResult.y, button: 'left', clickCount: 1 }
    }));

    await new Promise(r => setTimeout(r, 3000));

    const checkUrl = await cdpEval(ws, `(() => ({
      url: window.location.href,
      page1Active: document.querySelector('[aria-label="Page 1"]')?.getAttribute('aria-current'),
      page2Active: document.querySelector('[aria-label="Page 2"]')?.getAttribute('aria-current')
    }))()`);
    console.log('Post-click state:', checkUrl);
  }

  ws.close();
}

testPagination().catch(console.error);
