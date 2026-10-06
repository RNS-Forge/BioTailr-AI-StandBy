const { getTargetTab, connectWebSocket, cdpEval } = require('../core/cdp-client');

(async () => {
  const tab = await getTargetTab(9222, ['linkedin.com/jobs']);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);
  const res = await cdpEval(ws, `(() => ({
    url: window.location.href,
    title: document.title,
    oldHudExists: !!document.getElementById('biotailr-agent-hud'),
    standbyHudExists: !!document.getElementById('biotailr-standby-hud')
  }))()`);
  console.log('Current Browser Tab Status:', res);
  ws.close();
})();
