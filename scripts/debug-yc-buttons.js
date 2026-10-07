const { connectWebSocket, cdpEval } = require('../core/cdp-client');
const http = require('http');

async function main() {
  const newTab = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 9222,
      path: '/json/new?' + encodeURIComponent('https://www.workatastartup.com/jobs/80185'),
      method: 'PUT'
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });

  await new Promise(r => setTimeout(r, 4000));
  const ws = await connectWebSocket(newTab.webSocketDebuggerUrl);

  // 1. Click Apply button
  const clickRes = await cdpEval(ws, `(() => {
    const btn = Array.from(document.querySelectorAll('a, button')).find(el => el.innerText.trim() === 'Apply' && el.className.includes('orange'));
    if (!btn) return { error: 'No Apply button' };
    btn.click();
    return { clicked: true };
  })()`);
  console.log('Apply clicked:', clickRes);

  await new Promise(r => setTimeout(r, 1500));

  // 2. Click textarea and insert text via CDP
  const taRect = await cdpEval(ws, `(() => {
    const ta = document.querySelector('textarea');
    if (!ta) return null;
    ta.focus();
    const r = ta.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  console.log('Textarea rect:', taRect);

  if (taRect) {
    // Click inside textarea
    ws.send(JSON.stringify({
      id: 1,
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mousePressed', x: taRect.x, y: taRect.y, button: 'left', clickCount: 1 }
    }));
    await new Promise(r => setTimeout(r, 50));
    ws.send(JSON.stringify({
      id: 2,
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mouseReleased', x: taRect.x, y: taRect.y, button: 'left', clickCount: 1 }
    }));
    await new Promise(r => setTimeout(r, 100));

    // Also use native setter to trigger React state
    const testMsg = "Hi! I am Sanjay N, a Senior Full Stack & AI Engineer with hands-on experience building scalable backend architectures and distributed systems in Python and FastAPI. I am genuinely excited about what you are building and would love to bring my technical expertise to your engineering team. Let's connect!";
    
    // Dispatch input via CDP Input.insertText
    ws.send(JSON.stringify({
      id: 3,
      method: 'Input.insertText',
      params: { text: testMsg }
    }));
    await new Promise(r => setTimeout(r, 300));

    // Also verify native value setter as fallback
    const checkState = await cdpEval(ws, `(() => {
      const ta = document.querySelector('textarea');
      return {
        value: ta ? ta.value : null,
        length: ta ? ta.value.length : 0
      };
    })()`);
    console.log('After insertText:', checkState);
  }

  // Close tab
  await new Promise(resolve => {
    http.get(`http://127.0.0.1:9222/json/close/${newTab.id}`, () => resolve());
  });
  ws.close();
}
main().catch(console.error);
