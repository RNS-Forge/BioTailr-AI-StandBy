/**
 * BioTailr AI StandBy - Naukri Job Card Selector & Inspector
 * Discovers and selects job cards on naukri.com search result pages (SRP)
 * and job detail views. Dispatches native CDP mouse events for React/Vue interaction.
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

/**
 * Inspect the currently active / opened job on Naukri.
 * Works both on standalone job detail page and on SRP with active preview.
 */
async function inspectNaukriJob(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const url = window.location.href;
    const isJobDetailPage = url.includes('/job-listings-') || url.includes('/job-desc-');

    // 1. Check for standalone Job Details Page
    if (isJobDetailPage) {
      let title = document.querySelector('h1.styles_jd-header-title__header__... , h1.styles_jd-header-title__, h1.jd-header-title, .job-desc h1, header h1, h1')?.innerText?.trim() || '';
      let company = document.querySelector('a.styles_jd-header-comp-name__comp-name-link__, .styles_jd-header-comp-name__comp-name-link__, a.comp-name, .jd-header-comp-name, .company-name')?.innerText?.trim() || '';
      
      const jobIdMatch = url.match(/-(\d{9,})/);
      const jobId = jobIdMatch ? jobIdMatch[1] : '';

      // Check Apply button
      const allButtons = Array.from(document.querySelectorAll('button, a'));
      const isAlreadyApplied = allButtons.some(b => {
        const txt = (b.innerText || '').toLowerCase().trim();
        return (txt === 'applied' || txt === 'already applied') && b.offsetWidth > 0;
      }) || Boolean(document.querySelector('.already-applied, [class*="already-applied"]'));

      const isExternalApply = allButtons.some(b => {
        const txt = (b.innerText || '').toLowerCase().trim();
        return (txt.includes('company site') || txt.includes('apply on company site')) && b.offsetWidth > 0;
      });

      const applyBtn = allButtons.find(b => {
        if (b.offsetWidth <= 0) return false;
        const txt = (b.innerText || '').toLowerCase().trim();
        const id = (b.id || '').toLowerCase();
        const cls = (b.className || '').toLowerCase();
        if (txt.includes('company site')) return false;
        if (txt === 'applied' || txt === 'already applied') return false;
        return id.includes('apply-button') || cls.includes('apply-button') || cls.includes('apply-btn') || txt === 'apply' || txt === 'quick apply' || txt === 'easy apply';
      });

      return {
        title: title || 'Naukri Technical Opportunity',
        company: company || 'Target Employer',
        jobId,
        hasEasyApply: Boolean(applyBtn) && !isExternalApply && !isAlreadyApplied,
        alreadyApplied: isAlreadyApplied,
        isExternal: isExternalApply,
        isJobDetailPage: true
      };
    }

    // 2. Search Results Page (SRP): Look for currently selected card or top visible card
    const cards = Array.from(document.querySelectorAll('.srp-jobtuple-wrapper, article.jobTuple, .cust-job-tuple, [data-job-id]')).filter(c => c.offsetWidth > 0);
    
    // Check if there is an active/selected card
    let activeCard = cards.find(c => c.classList.contains('selected') || c.classList.contains('active') || c.getAttribute('aria-selected') === 'true');
    if (!activeCard && cards.length > 0) {
      activeCard = cards[0];
    }

    if (activeCard) {
      const titleEl = activeCard.querySelector('a.title, .job-title, .title');
      const title = titleEl ? titleEl.innerText.trim() : '';
      const compEl = activeCard.querySelector('a.comp-name, .subTitle, .companyInfo a, .comp-name');
      const company = compEl ? compEl.innerText.trim() : '';
      const jobId = activeCard.getAttribute('data-job-id') || (titleEl?.href?.match(/-(\d{9,})/) || [])[1] || '';

      const cardText = (activeCard.innerText || '').toLowerCase();
      const isAlreadyApplied = cardText.includes('applied') || cardText.includes('already applied');
      const isExternalApply = cardText.includes('company site') || cardText.includes('apply on company site');

      // Check if card has direct apply button
      const cardApplyBtn = Array.from(activeCard.querySelectorAll('button, a')).find(b => {
        if (b.offsetWidth <= 0) return false;
        const txt = (b.innerText || '').toLowerCase().trim();
        return (txt === 'apply' || txt === 'quick apply') && !txt.includes('company site');
      });

      return {
        title: title || 'Naukri Technical Opportunity',
        company: company || 'Target Employer',
        jobId,
        hasEasyApply: !isAlreadyApplied && !isExternalApply,
        alreadyApplied: isAlreadyApplied,
        isExternal: isExternalApply,
        isJobDetailPage: false
      };
    }

    return {
      title: 'Naukri Opportunity',
      company: 'Naukri Employer',
      jobId: '',
      hasEasyApply: false,
      alreadyApplied: false,
      isExternal: false,
      isJobDetailPage: false
    };
  })()`);
}

/**
 * Click the Apply button on Naukri.
 * Handles both detail page buttons and listing card apply buttons.
 */
async function clickNaukriApplyButton(ws, cdpEval) {
  const coords = await cdpEval(ws, `(() => {
    // Priority 1: Primary apply button on job details page or drawer
    const candidates = Array.from(document.querySelectorAll('button, a')).filter(b => {
      if (b.offsetWidth <= 0) return false;
      const id = (b.id || '').toLowerCase();
      const cls = (b.className || '').toLowerCase();
      const txt = (b.innerText || '').toLowerCase().trim();

      if (txt.includes('company site') || txt.includes('apply on company site')) return false;
      if (txt === 'applied' || txt === 'already applied') return false;

      return id === 'apply-button' || id.includes('apply-button') ||
             cls.includes('apply-button') || cls.includes('apply-btn') ||
             txt === 'apply' || txt === 'quick apply' || txt === 'easy apply';
    });

    const btn = candidates[0];
    if (btn) {
      btn.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = btn.getBoundingClientRect();
      return {
        clicked: true,
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2)
      };
    }

    return { clicked: false };
  })()`);

  if (coords && coords.clicked && coords.x && coords.y) {
    await dispatchCdpClick(ws, coords.x, coords.y);
    return true;
  }
  return false;
}

/**
 * Select the next unvisited job card in the Naukri feed.
 * Scrolls the card into view and clicks it via native CDP mouse event.
 */
async function selectNextNaukriCard(ws, cdpEval, visitedSet) {
  const visitedArray = Array.from(visitedSet);
  const serialized = JSON.stringify(visitedArray);

  const cardData = await cdpEval(ws, `(() => {
    const visited = new Set(${serialized});

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

    // Discover job tuples on Naukri SRP
    const cards = Array.from(document.querySelectorAll('.srp-jobtuple-wrapper, article.jobTuple, .cust-job-tuple, [data-job-id]')).filter(c => c.offsetWidth > 0);

    for (const card of cards) {
      const cardText = (card.innerText || '').toLowerCase();
      const isApplied = cardText.includes('applied') || cardText.includes('already applied');
      if (isApplied) continue;

      const titleEl = card.querySelector('a.title, .job-title, .title');
      const title = titleEl ? titleEl.innerText.trim().replace(/\\n+/g, ' ') : '';
      if (!title) continue;

      const compEl = card.querySelector('a.comp-name, .subTitle, .companyInfo a, .comp-name');
      const company = compEl ? compEl.innerText.trim().replace(/\\n+/g, ' ') : '';
      const jobId = card.getAttribute('data-job-id') || (titleEl?.href?.match(/-(\d{9,})/) || [])[1] || '';

      if (!isVisited(title, company, jobId)) {
        const clickTarget = titleEl || card;
        clickTarget.scrollIntoView({ behavior: 'instant', block: 'center' });
        const r = clickTarget.getBoundingClientRect();

        return {
          found: true,
          title,
          company,
          jobId,
          key: (title + '::' + company).toLowerCase(),
          x: Math.round(r.left + r.width / 2),
          y: Math.round(r.top + r.height / 2)
        };
      }
    }

    return { found: false };
  })()`);

  if (cardData && cardData.found && cardData.x && cardData.y) {
    await dispatchCdpClick(ws, cardData.x, cardData.y);
    await new Promise(r => setTimeout(r, 1200));
    return cardData;
  }

  return { found: false };
}

module.exports = {
  dispatchCdpClick,
  inspectNaukriJob,
  clickNaukriApplyButton,
  selectNextNaukriCard
};
