const http = require('http');

async function testRemove() {
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

  const res = await evalCDP(`(() => {
    const removeBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim().toLowerCase() === 'remove');
    if (removeBtns.length > 3) {
      removeBtns[removeBtns.length - 1].click();
      return 'Clicked remove on 5th experience';
    }
    return 'None';
  })()`);

  console.log('Action:', res);
  await new Promise(r => setTimeout(r, 600));

  const dialogCheck = await evalCDP(`(() => {
    const confirm = document.querySelector('[data-test-dialog], .artdeco-modal--layer-default, .artdeco-modal');
    return {
      dialogText: confirm?.innerText?.slice(0, 200),
      buttons: Array.from(document.querySelectorAll('button')).filter(b => b.offsetWidth > 0).map(b => b.innerText.trim())
    };
  })()`);
  console.log('Dialog check:', dialogCheck);
  ws.close();
}

testRemove();
