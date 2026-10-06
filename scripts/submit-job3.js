const http = require('http');

async function submitJob3() {
  const tabs = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
  const ws = new WebSocket(li.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  const evalCDP = (expr) => new Promise(res => {
    const id = 123;
    ws.onmessage = (e) => {
      const p = JSON.parse(e.data);
      if (p.id === id) res(p.result?.result?.value);
    };
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
  });

  const submitRes = await evalCDP(`(() => {
    const modal = document.querySelector('.jobs-easy-apply-modal, [role="dialog"]');
    const submitBtn = Array.from(modal.querySelectorAll('button')).find(b => b.innerText.trim().toLowerCase() === 'submit application');
    if (submitBtn) {
      submitBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      submitBtn.click();
      return 'Clicked Submit application';
    }
    return 'No submit btn';
  })()`);

  console.log('Submit Result:', submitRes);
  await new Promise(r => setTimeout(r, 1500));

  // Dismiss any post-submission modal
  const dismiss = await evalCDP(`(() => {
    const dismissBtn = document.querySelector('.artdeco-modal__dismiss, [data-test-modal-close-btn], button[aria-label="Dismiss"], button[aria-label="Done"]')
      || Array.from(document.querySelectorAll('button')).find(b => b.offsetWidth > 0 && /^(not now|dismiss|close|done)$/i.test(b.innerText.trim()));
    if (dismissBtn) {
      dismissBtn.click();
      return 'Dismissed confirmation';
    }
    return 'No dismiss needed';
  })()`);

  console.log('Post submit dismiss:', dismiss);
  ws.close();
}

submitJob3();
