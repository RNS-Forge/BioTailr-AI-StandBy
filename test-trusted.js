const fs = require('fs');
const http = require('http');

async function testTrusted() {
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

  const hudJs = fs.readFileSync('c:/Temp Files/My Projects/BioTailr.ai/BioTailr-AI-Extension/automation/screen-hud.js', 'utf8');
  const match = hudJs.match(/tmpl\.innerHTML = `([\s\S]*?)`;/);
  const rawHtml = match ? match[1] : '';

  const res = await evalCDP(`(() => {
    let err = null;
    const tmpl = document.createElement('template');
    try {
      tmpl.innerHTML = ${JSON.stringify(rawHtml)};
    } catch(e) {
      err = e.message;
    }
    const node = tmpl.content.childNodes[0];
    return {
      err,
      childrenCount: tmpl.content.childNodes.length,
      nodeType: node?.nodeType,
      nodeName: node?.nodeName,
      textContent: node?.textContent?.slice(0, 100),
      rawHtmlPreview: ${JSON.stringify(rawHtml.slice(0, 100))}
    };
  })()`);

  console.log('Template parse test result:', res);
  ws.close();
}

testTrusted();
