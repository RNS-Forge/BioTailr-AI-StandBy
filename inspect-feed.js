const http = require('http');

async function checkFeed() {
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

  const cards = await evalCDP(`(() => {
    const all = Array.from(document.querySelectorAll('.jobs-search-results-list__list-item, .job-card-container'));
    return all.map((c, idx) => {
      const title = c.querySelector('.job-card-list__title--link, a[href*="/jobs/view/"], strong')?.innerText?.trim();
      const company = c.querySelector('.artdeco-entity-lockup__subtitle, .job-card-container__primary-description')?.innerText?.trim();
      const txt = c.innerText.toLowerCase();
      const applied = txt.includes('applied') || txt.includes('application submitted');
      const easyApply = txt.includes('easy apply');
      return { idx, title, company, easyApply, applied };
    }).filter(c => c.title);
  })()`);

  console.log('Available Feed Cards:', JSON.stringify(cards, null, 2));
  ws.close();
}

checkFeed();
