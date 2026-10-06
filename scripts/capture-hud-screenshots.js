const { getTargetTab, connectWebSocket, cdpEval, cdpSend } = require('../core/cdp-client');
const fs = require('fs');
const path = require('path');

async function main() {
  const tab = await getTargetTab(9222, ['linkedin.com/jobs']);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);

  // 1. Screenshot of the collapsed StandBy count tab
  const shot1 = await cdpSend(ws, 'Page.captureScreenshot', { format: 'png' });
  const artDir = 'C:/Users/6point3_FA0018/.gemini/antigravity-ide/brain/900bd8e8-a48e-42b3-b162-4d6c0ab47a88';
  fs.writeFileSync(path.join(artDir, 'standby-count-tab.png'), Buffer.from(shot1.data, 'base64'));
  console.log('Saved standby-count-tab.png');

  // 2. Click the StandBy tab to open the failed jobs drawer
  await cdpEval(ws, `(() => {
    const tab = document.getElementById('bt-standby-tab');
    if (tab) tab.click();
  })()`);

  await new Promise(r => setTimeout(r, 600));

  // 3. Screenshot of the opened failed jobs drawer
  const shot2 = await cdpSend(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artDir, 'standby-failed-jobs-drawer.png'), Buffer.from(shot2.data, 'base64'));
  console.log('Saved standby-failed-jobs-drawer.png');

  ws.close();
}

main().catch(console.error);
