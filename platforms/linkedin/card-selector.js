/**
 * BioTailr AI StandBy - LinkedIn Job Card Selector
 * Discovers and selects job cards across both Modern Atomic CSS layout and Legacy LinkedIn layout.
 */

async function selectNextLinkedInCard(ws, cdpEval, visitedSet) {
  const visitedArray = Array.from(visitedSet);
  const serialized = JSON.stringify(visitedArray);

  return await cdpEval(ws, `(() => {
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

    // 1. Standard search results list items (Works across both new & legacy LinkedIn)
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
        clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        clickTarget.click();
        return { found: true, title, company, jobId, key: (title + '::' + company).toLowerCase() };
      }
    }

    // 2. Modern Dismiss button discovered cards fallback
    const dismissBtns = Array.from(document.querySelectorAll('button[aria-label*="Dismiss"], button[aria-label*="dismiss"]'));
    for (const btn of dismissBtns) {
      const label = btn.getAttribute('aria-label') || '';
      const m = label.match(/Dismiss\\s+(.*?)\\s+job/i);
      const title = m ? m[1].trim() : '';
      if (!title) continue;

      let card = btn.parentElement;
      while (card && card.tagName !== 'BODY') {
        if (card.nextElementSibling?.tagName === 'HR' || card.previousElementSibling?.tagName === 'HR') break;
        card = card.parentElement;
      }
      if (!card) continue;

      const text = (card.innerText || '').toLowerCase();
      const isApplied = text.includes('applied') || text.includes('application submitted');
      if (isApplied) continue;

      const compEl = card.querySelector('.job-card-container__primary-description, [class*="subtitle"], p, span');
      const company = compEl ? compEl.innerText.trim() : '';

      if (!isVisited(title, company, '')) {
        const clickTarget = card.querySelector('[componentkey], div[role="button"][tabindex="0"], a') || card;
        clickTarget.scrollIntoView({ behavior: 'instant', block: 'center' });
        clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        clickTarget.click();
        return { found: true, title, company, key: (title + '::' + company).toLowerCase() };
      }
    }

    return { found: false };
  })()`);
}

module.exports = {
  selectNextLinkedInCard
};
