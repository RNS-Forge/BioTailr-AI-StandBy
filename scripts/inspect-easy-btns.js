const { getTargetTab, connectWebSocket, cdpEval } = require('../core/cdp-client');

async function test() {
  const tab = await getTargetTab(9222);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);

  const res = await cdpEval(ws, `(() => {
    const btns = Array.from(document.querySelectorAll('button, a, div[role="button"]')).filter(b => {
      const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase();
      return t.includes('easy apply') && b.offsetWidth > 0;
    }).map(b => {
      const r = b.getBoundingClientRect();
      return {
        tag: b.tagName,
        text: b.innerText.trim(),
        aria: b.getAttribute('aria-label'),
        cls: b.className.slice(0, 50),
        id: b.id,
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
        width: r.width,
        height: r.height,
        parent: b.parentElement?.tagName + '.' + b.parentElement?.className.slice(0, 40)
      };
    });

    return {
      url: window.location.href,
      btns
    };
  })()`);

  console.log(JSON.stringify(res, null, 2));
  ws.close();
}

test().catch(console.error);
