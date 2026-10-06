const fs = require('fs');
const { getTargetTab, connectWebSocket } = require('../core/cdp-client');

(async () => {
  const tab = await getTargetTab(9222, ['linkedin.com/jobs']);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);

  const screenshotBase64 = await new Promise((resolve, reject) => {
    const id = 9999;
    const handler = (evt) => {
      const parsed = JSON.parse(evt.data);
      if (parsed.id === id) {
        ws.removeEventListener('message', handler);
        if (parsed.result?.data) resolve(parsed.result.data);
        else reject(new Error('No screenshot data'));
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  });

  const outPath = 'C:/Users/6point3_FA0018/.gemini/antigravity-ide/brain/900bd8e8-a48e-42b3-b162-4d6c0ab47a88/unlimited_apply_verified.png';
  fs.writeFileSync(outPath, Buffer.from(screenshotBase64, 'base64'));
  console.log('Saved screenshot to:', outPath);
  ws.close();
})();
