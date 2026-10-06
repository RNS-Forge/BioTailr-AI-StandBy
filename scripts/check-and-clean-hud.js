const { getTargetTab, connectWebSocket, cdpEval } = require('../core/cdp-client');

(async () => {
  const tab = await getTargetTab(9222, ['linkedin.com/jobs']);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);

  const res = await cdpEval(ws, `(() => {
    const oldPanels = document.querySelectorAll('#biotailr-agent-hud, .bt-hud-panel, .bt-hud-pill');
    const count = oldPanels.length;
    oldPanels.forEach(el => el.remove());
    return {
      removedOldCount: count,
      remaining: document.querySelectorAll('#biotailr-agent-hud, .bt-hud-panel, .bt-hud-pill').length
    };
  })()`);
  console.log('Cleaned HUD result:', res);
  ws.close();
})();
