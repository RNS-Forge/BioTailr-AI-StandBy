const http = require('http');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tabs = JSON.parse(data);
    const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
    const ws = new WebSocket(li.webSocketDebuggerUrl);
    ws.onopen = () => {
      console.log('Triggering Autonomous Agent on Frontend Developer (React) (Remote)...');
      const code = `(async () => {
        const hud = window.bioTailrScreenHUD;
        if (hud) {
          hud.isExpanded = true;
          const panel = document.getElementById('bt-hud-panel');
          if (panel) panel.classList.add('open');
          await hud.startAgentWorkflow();
          return { status: 'workflow_triggered_via_hud' };
        }
        return { status: 'no_hud_found' };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, awaitPromise: true, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Agent trigger result:', JSON.stringify(parsed.result, null, 2));
      setTimeout(() => {
        // Read HUD feed logs
        const readLogs = `(() => {
          const feed = document.getElementById('bt-hud-feed');
          const lines = Array.from(feed ? feed.querySelectorAll('.bt-feed-line') : []).map(l => l.innerText);
          const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
          return {
            lines,
            hasModal: !!modal,
            modalText: modal ? modal.innerText.slice(0, 200) : null
          };
        })()`;
        ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: readLogs, returnByValue: true } }));
      }, 3000);
      if (parsed.id === 2) {
        console.log('Live HUD Feed & State:', JSON.stringify(parsed.result.result.value, null, 2));
        ws.close();
      }
    };
  });
});
