const fs = require('fs');
const { getTargetTab, connectWebSocket, cdpEval } = require('../core/cdp-client');

(async () => {
  const tab = await getTargetTab(9222, ['linkedin.com/jobs']);
  const ws = await connectWebSocket(tab.webSocketDebuggerUrl);

  // Remove any stale HUDs
  await cdpEval(ws, `(() => {
    document.querySelectorAll('#biotailr-agent-hud, #biotailr-standby-hud, .bt-hud-panel, .bt-hud-pill').forEach(el => el.remove());
    window.__biotailr_hud_loaded = false;
  })()`);

  // Inject screen-hud.js code directly
  const screenHudCode = fs.readFileSync('c:/Temp Files/My Projects/BioTailr.ai/BioTailr-AI-Extension/automation/screen-hud.js', 'utf8');

  await new Promise((resolve) => {
    const id = 11111;
    const h = (evt) => {
      const p = JSON.parse(evt.data);
      if (p.id === id) {
        ws.removeEventListener('message', h);
        if (p.result?.exceptionDetails) {
          console.error('Error:', JSON.stringify(p.result.exceptionDetails));
        }
        resolve();
      }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: screenHudCode, returnByValue: false } }));
  });

  await new Promise(r => setTimeout(r, 500));

  // Send mock data to populate lists
  const testData = {
    appliedCount: 3,
    failedCount: 2,
    appliedJobs: [
      { title: 'Python Backend Engineer', company: 'Snayu AI', time: '14:05:22' },
      { title: 'Gen AI Developer', company: 'Tata Consultancy Services', time: '14:12:44' },
      { title: 'Full Stack Engineer', company: 'Axodian Technologies', time: '14:21:10' }
    ],
    failedJobs: [
      { title: 'AI ML Developer', company: 'Infosys', reason: 'No Easy Apply button' },
      { title: 'Frontend Developer', company: 'VMC Soft', reason: 'Easy Apply modal did not open' }
    ],
    jobTitle: 'Running Auto Apply...',
    company: 'BioTailr AI',
    status: 'ACTIVE'
  };

  await cdpEval(ws, `(() => {
    if (typeof window.__bioTailrUpdateHud === 'function') {
      window.__bioTailrUpdateHud(${JSON.stringify(testData)});
    }
  })()`);

  await new Promise(r => setTimeout(r, 300));

  // Capture screenshot
  const screenshotBase64 = await new Promise((resolve) => {
    const id = 22222;
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

  const outPath = 'C:/Users/6point3_FA0018/.gemini/antigravity-ide/brain/900bd8e8-a48e-42b3-b162-4d6c0ab47a88/screen_hud_restored.png';
  fs.writeFileSync(outPath, Buffer.from(screenshotBase64, 'base64'));
  console.log('Screenshot saved to:', outPath);
  ws.close();
})();
