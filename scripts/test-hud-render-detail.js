const { getTargetTab, connectWebSocket } = require('../core/cdp-client');
const { ensureHudInjected } = require('../core/hud-manager');

(async () => {
  const tab = await getTargetTab(9222, ['linkedin.com/jobs']);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);

  const originalSend = ws.send.bind(ws);
  ws.send = (msg) => {
    const parsed = JSON.parse(msg);
    const origHandler = ws.addEventListener.bind(ws);
    return originalSend(msg);
  };

  const listener = (evt) => {
    const p = JSON.parse(evt.data);
    if (p.result?.exceptionDetails) {
      console.error('EXCEPTION IN EVAL:', JSON.stringify(p.result.exceptionDetails, null, 2));
    }
  };
  ws.addEventListener('message', listener);

  await ensureHudInjected(ws);
  console.log('ensureHudInjected finished without throwing');

  // Capture screenshot to see StandBy HUD
  const fs = require('fs');
  const screenshotBase64 = await new Promise((resolve) => {
    const id = 5555;
    const h = (evt) => {
      const p = JSON.parse(evt.data);
      if (p.id === id) {
        ws.removeEventListener('message', h);
        resolve(p.result?.data);
      }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  });

  const outPath = 'C:/Users/6point3_FA0018/.gemini/antigravity-ide/brain/900bd8e8-a48e-42b3-b162-4d6c0ab47a88/clean_standby_hud_verified.png';
  fs.writeFileSync(outPath, Buffer.from(screenshotBase64, 'base64'));
  console.log('Saved screenshot to:', outPath);

  ws.close();
})();
