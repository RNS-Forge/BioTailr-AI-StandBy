/**
 * BioTailr AI StandBy - LinkedIn Job Card Selector
 * Discovers and selects job cards across both Modern Atomic CSS layout and Legacy LinkedIn layout.
 * Dispatches native CDP mouse events for 100% reliable React interaction.
 */

async function dispatchCdpClick(ws, x, y) {
  return new Promise(resolve => {
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }
    }));
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: Math.floor(Math.random() * 1000000),
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }
      }));
      setTimeout(resolve, 400);
    }, 40);
  });
}

async function selectNextLinkedInCard(ws, cdpEval, visitedSet) {
  const visitedArray = Array.from(visitedSet);
  const serialized = JSON.stringify(visitedArray);

  const cardData = await cdpEval(ws, `(() => {
    const visited = new Set(${serialized});

    // Helper to test if a listing is in the visited set
    const isVisited = (title, company, jobId) => {
      const t = (title || '').toLowerCase().trim();
      const c = (company || '').toLowerCase().trim();
      if (!t) return true;
      if (visited.has(t)) return true;
      if (visited.has(t + '::' + c)) return true;
      if (visited.has(t + '::')) return true;
      if (jobId && visited.has(jobId)) return true;
      return false;
    };

    // 1. Modern Atomic CSS Layout (Cards with componentkey)
    const atomicCards = Array.from(document.querySelectorAll('div[componentkey^="job-card-component-ref-"][role="button"], div[componentkey^="job-card-component-ref-"]'));
    for (const card of atomicCards) {
      const text = card.innerText || '';
      const isApplied = text.includes('Applied') || text.includes('Application submitted');
      if (isApplied) continue;

      const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
      let title = lines[0] || '';
      let company = lines[1] || '';
      if (/^selected/i.test(title)) {
        title = lines[1] || title;
        company = lines[2] || company;
      }
      title = (title || '').replace(/^Selected,?\\s*/i, '').replace(/\\s*\\(Verified job\\)/i, '').trim();
      company = (company || '').replace(/^Selected,?\\s*/i, '').trim();

      const jobId = card.getAttribute('componentkey')?.replace(/\\D/g, '') || '';

      if (!isVisited(title, company, jobId)) {
        card.scrollIntoView({ behavior: 'instant', block: 'center' });
        const r = card.getBoundingClientRect();
        return {
          found: true,
          title,
          company,
          jobId,
          key: (title + '::' + company).toLowerCase(),
          x: r.left + r.width / 2,
          y: r.top + r.height / 2
        };
      }
    }

    // 2. Legacy / Classic LinkedIn Cards
    const listItems = Array.from(document.querySelectorAll('.jobs-search-results-list__list-item, [data-occludable-job-id], .job-card-container'));
    for (const card of listItems) {
      const text = (card.innerText || '').toLowerCase();
      const isApplied = text.includes('applied') || text.includes('application submitted');
      if (isApplied) continue;

      const titleEl = card.querySelector('.job-card-list__title, a.job-card-container__link, strong, h3, h2');
      const title = titleEl ? titleEl.innerText.trim().replace(/\\n+/g, ' ') : '';
      if (!title) continue;

      const compEl = card.querySelector('.job-card-container__primary-description, [class*="subtitle"], .artdeco-entity-lockup__subtitle, p');
      const company = compEl ? compEl.innerText.trim().replace(/\\n+/g, ' ') : '';
      const jobId = card.getAttribute('data-occludable-job-id') || card.getAttribute('data-job-id') || '';

      if (!isVisited(title, company, jobId)) {
        const clickTarget = card.querySelector('a.job-card-container__link, a[href*="/jobs/view/"], [role="button"][tabindex="0"], a') || card;
        clickTarget.scrollIntoView({ behavior: 'instant', block: 'center' });
        const r = clickTarget.getBoundingClientRect();
        return {
          found: true,
          title,
          company,
          jobId,
          key: (title + '::' + company).toLowerCase(),
          x: r.left + r.width / 2,
          y: r.top + r.height / 2
        };
      }
    }

    // 3. Modern Dismiss button fallback
    const dismissBtns = Array.from(document.querySelectorAll('button[aria-label*="Dismiss"], button[aria-label*="dismiss"]'));
    for (const btn of dismissBtns) {
      const label = btn.getAttribute('aria-label') || '';
      const m = label.match(/Dismiss\\s+(.*?)\\s+job/i);
      const title = m ? m[1].trim() : '';
      if (!title) continue;

      let card = btn.parentElement;
      while (card && card.tagName !== 'BODY') {
        if (card.getAttribute('role') === 'button' || card.getAttribute('componentkey')) break;
        card = card.parentElement;
      }
      if (!card) continue;

      const text = (card.innerText || '').toLowerCase();
      const isApplied = text.includes('applied') || text.includes('application submitted');
      if (isApplied) continue;

      const compEl = card.querySelector('.job-card-container__primary-description, [class*="subtitle"], p, span');
      const company = compEl ? compEl.innerText.trim() : '';

      if (!isVisited(title, company, '')) {
        card.scrollIntoView({ behavior: 'instant', block: 'center' });
        const r = card.getBoundingClientRect();
        return {
          found: true,
          title,
          company,
          key: (title + '::' + company).toLowerCase(),
          x: r.left + r.width / 2,
          y: r.top + r.height / 2
        };
      }
    }

    return { found: false };
  })()`);

  if (cardData && cardData.found && cardData.x && cardData.y) {
    await dispatchCdpClick(ws, cardData.x, cardData.y);
    await new Promise(r => setTimeout(r, 1200));
  }

  return cardData || { found: false };
}

module.exports = {
  selectNextLinkedInCard
};
