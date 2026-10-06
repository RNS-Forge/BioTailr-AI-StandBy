const { getTargetTab, connectWebSocket } = require('../core/cdp-client');
const { ensureHudInjected } = require('../core/hud-manager');

(async () => {
  const tab = await getTargetTab(9222, ['linkedin.com/jobs']);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);
  await ensureHudInjected(ws);
  console.log('ensureHudInjected completed successfully');
  ws.close();
})();
