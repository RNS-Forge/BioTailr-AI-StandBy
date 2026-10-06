const http = require('http');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tabs = JSON.parse(data);
    const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
    if (!li) {
      console.log('No LinkedIn tab found');
      return;
    }
    console.log('Connecting to LinkedIn tab:', li.id, li.title);
    const ws = new WebSocket(li.webSocketDebuggerUrl);
    ws.onopen = () => {
      const code = `(() => {
        const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
        const easyApplyBtns = Array.from(document.querySelectorAll('button')).filter(b => (b.innerText || '').toLowerCase().includes('easy apply'));
        const jobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title, h1')?.innerText;
        const allButtons = Array.from(document.querySelectorAll('button')).filter(b => b.offsetWidth > 0).map(b => b.innerText.trim()).filter(Boolean);
        return {
          hasModal: !!modal,
          modalVisible: modal ? (modal.offsetWidth > 0 && modal.offsetHeight > 0) : false,
          modalText: modal ? modal.innerText.slice(0, 400) : null,
          easyApplyCount: easyApplyBtns.length,
          easyApplyDetails: easyApplyBtns.map(b => ({ text: b.innerText.trim(), visible: b.offsetWidth > 0, classes: b.className })),
          jobTitle,
          sampleButtons: allButtons.slice(0, 20)
        };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.id === 1) {
        console.log('Result:', JSON.stringify(parsed.result.result.value, null, 2));
        ws.close();
      }
    };
  });
});
