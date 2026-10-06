/**
 * BioTailr AI StandBy - LinkedIn Job Card Selector
 * Discovers and selects job cards across both Modern Atomic CSS layout and Legacy LinkedIn layout.
 */

async function selectNextLinkedInCard(ws, cdpEval, visitedSet) {
  const visitedArray = Array.from(visitedSet);
  const serialized = JSON.stringify(visitedArray);

  return await cdpEval(ws, `(() => {
    const visited = new Set(${serialized});

    // 1. Modern Layout: Discover job cards via Dismiss buttons or card containers
    const dismissBtns = Array.from(document.querySelectorAll('button[aria-label*="Dismiss"], button[aria-label*="dismiss"]'));
    for (const btn of dismissBtns) {
      const label = btn.getAttribute('aria-label') || '';
      const m = label.match(/Dismiss\\s+(.*?)\\s+job/i);
      const title = m ? m[1].trim() : '';

      let card = btn.parentElement;
      while (card && card.tagName !== 'BODY') {
        if (card.nextElementSibling?.tagName === 'HR' || card.previousElementSibling?.tagName === 'HR') break;
        card = card.parentElement;
      }
      if (!card) continue;

      const text = (card.innerText || '').toLowerCase();
      const isApplied = text.includes('applied') || text.includes('application submitted');

      // Extract company name
      const compEl = card.querySelector('div[class*="dj9lki"], p, span');
      const company = compEl ? compEl.innerText.trim() : '';
      const key = (title + '::' + company).toLowerCase();

      if (!visited.has(key) && !isApplied) {
        const clickTarget = card.querySelector('[componentkey], div[role="button"][tabindex="0"], a') || card;
        clickTarget.scrollIntoView({ behavior: 'instant', block: 'center' });
        clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        clickTarget.click();
        return { found: true, title, company, key };
      }
    }

    // 2. Component Key direct cards
    const compCards = Array.from(document.querySelectorAll('[componentkey], div[role="button"][tabindex="0"]')).filter(el => {
      return el.offsetHeight > 40 && el.offsetWidth > 150;
    });

    for (const card of compCards) {
      const text = (card.innerText || '').toLowerCase();
      const isApplied = text.includes('applied') || text.includes('application submitted');
      const titleEl = card.querySelector('p, span, h3, h2, strong');
      const title = titleEl ? titleEl.innerText.trim() : '';
      const key = title.toLowerCase();

      if (title && !visited.has(key) && !isApplied) {
        card.scrollIntoView({ behavior: 'instant', block: 'center' });
        card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        card.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        card.click();
        return { found: true, title, key };
      }
    }

    // 3. Legacy Layout: via class names
    const legacyCards = Array.from(document.querySelectorAll('.jobs-search-results-list__list-item, .job-card-container, [data-occludable-job-id]'));
    for (const card of legacyCards) {
      const text = card.innerText.toLowerCase();
      const isApplied = text.includes('applied') || text.includes('application submitted');
      const titleEl = card.querySelector('.job-card-list__title, a.job-card-container__link, strong');
      const title = titleEl ? titleEl.innerText.trim() : '';
      const compEl = card.querySelector('.job-card-container__primary-description');
      const company = compEl ? compEl.innerText.trim() : '';
      const key = (title + '::' + company).toLowerCase();

      if (title && !visited.has(key) && !isApplied) {
        const link = card.querySelector('a.job-card-container__link, a[href*="/jobs/view/"], a');
        if (link) {
          link.scrollIntoView({ behavior: 'instant', block: 'center' });
          link.click();
          return { found: true, title, company, key };
        }
      }
    }

    return { found: false };
  })()`);
}

module.exports = {
  selectNextLinkedInCard
};
