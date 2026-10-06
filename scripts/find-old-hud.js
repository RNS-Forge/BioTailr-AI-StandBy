const { getTargetTab, connectWebSocket, cdpEval } = require('../core/cdp-client');

(async () => {
  const tab = await getTargetTab(9222, ['linkedin.com/jobs']);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);

  const res = await cdpEval(ws, `(() => {
    const all = Array.from(document.querySelectorAll('*')).filter(el => {
      const txt = (el.innerText || '');
      return txt.includes('BioTailr Autonomous Agent') || txt.includes('AUTO-APPLY NOW') || txt.includes('Download Desktop Runner');
    });
    return all.map(el => ({
      tag: el.tagName,
      id: el.id,
      className: el.className,
      parentTag: el.parentElement?.tagName,
      parentId: el.parentElement?.id,
      parentClass: el.parentElement?.className,
      outerHTML: el.outerHTML.substring(0, 300)
    }));
  })()`);

  console.log('Found elements:', JSON.stringify(res, null, 2));
  ws.close();
})();
