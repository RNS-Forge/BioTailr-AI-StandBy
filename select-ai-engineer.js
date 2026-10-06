const http = require('http');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tabs = JSON.parse(data);
    const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
    const ws = new WebSocket(li.webSocketDebuggerUrl);
    ws.onopen = () => {
      console.log('Selecting AI Engineer job card in search feed...');
      const code = `(() => {
        const cards = Array.from(document.querySelectorAll('.jobs-search-results-list__list-item, .job-card-container, [data-occludable-job-id]'));
        for (const card of cards) {
          const t = card.innerText.toLowerCase();
          if (t.includes('ai engineer') && !t.includes('applied') && t.includes('easy apply')) {
            const link = card.querySelector('a.job-card-container__link, a[href*="/jobs/view/"], a');
            if (link) {
              link.scrollIntoView({ behavior: 'instant', block: 'center' });
              link.click();
              return { clicked: true, text: link.innerText.trim() };
            }
          }
        }
        return { clicked: false, totalCards: cards.length };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log('Clicked AI Engineer:', parsed.result);
      setTimeout(() => {
        const checkJob = `(() => {
          const title = document.querySelector('.job-details-jobs-unified-top-card__job-title, h1')?.innerText;
          const easyBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').toLowerCase().includes('easy apply') && b.offsetWidth > 0);
          return { title, hasEasyApply: !!easyBtn, easyBtnText: easyBtn ? easyBtn.innerText.trim() : null };
        })()`;
        ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: checkJob, returnByValue: true } }));
      }, 1500);
      if (parsed.id === 2) {
        console.log('Selected Job Details:', JSON.stringify(parsed.result.result.value, null, 2));
        ws.close();
      }
    };
  });
});
