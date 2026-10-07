/**
 * BioTailr AI StandBy - YC Card Selector & Feed Scroller
 * Handles selecting unvisited job cards on workatastartup.com listings.
 * Each "card" is a job listing row in the compact list layout.
 */

/**
 * Select the next unvisited job card from the YC listings feed.
 * On the list page: clicks "View job" to navigate to job detail page.
 * On the job detail page: reads current job details.
 */
async function selectNextYCJob(ws, cdpEval, visitedKeys) {
  const serializedKeys = JSON.stringify(Array.from(visitedKeys));

  return await cdpEval(ws, `(() => {
    const visited = new Set(${serializedKeys});

    // On list page (compact layout): find "View job" buttons
    // Each job card has: company name, job title, "View job" button
    const jobCards = Array.from(document.querySelectorAll([
      'a[href*="/jobs/"]',
      '.job-listing',
      '[class*="job-card"]',
      '[class*="listing"]',
      'div[class*="company"]'
    ].join(', '))).filter(el => el.offsetWidth > 0);

    // Try to find job rows in list-compact layout
    const allViewJobLinks = Array.from(document.querySelectorAll('a[href*="/jobs/"]')).filter(a => {
      const txt = (a.innerText || '').trim().toLowerCase();
      return txt === 'view job' && a.offsetWidth > 0;
    });

    for (const link of allViewJobLinks) {
      // Get the parent card to extract job/company info
      let card = link.closest('[class*="job"], [class*="listing"], [class*="company"], li, article');
      if (!card) card = link.parentElement?.parentElement?.parentElement;

      const cardText = (card ? card.innerText : '').toLowerCase();
      const titleEl = card ? card.querySelector('h2, h3, [class*="title"], [class*="role"], [class*="position"]') : null;
      const companyEl = card ? card.querySelector('h1, [class*="company-name"], [class*="company"]') : null;

      const jobTitle = titleEl ? titleEl.innerText.trim() : '';
      const company = companyEl ? companyEl.innerText.split('\\n')[0].trim() : '';
      const href = link.href || '';

      const key = (jobTitle + '::' + company).toLowerCase();
      const urlKey = href.split('/jobs/')[1] || '';

      if (visited.has(key) || visited.has(urlKey) || visited.has(jobTitle.toLowerCase()) || visited.has(href)) {
        continue;
      }

      // Found an unvisited job - click the View job link
      link.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = link.getBoundingClientRect();
      link.click();

      return {
        found: true,
        title: jobTitle || 'Startup Engineering Role',
        company: company || 'YC Company',
        href,
        urlKey,
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2)
      };
    }

    return { found: false };
  })()`);
}

/**
 * Inspect the currently open job detail page on workatastartup.com.
 * Returns job info + whether Apply button is present.
 */
async function inspectYCJob(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const url = window.location.href;

    // Job detail page: workatastartup.com/companies/xxx/jobs/yyy
    const isJobDetailPage = url.includes('/jobs/') && !url.includes('/companies?');
    const isListPage = url.includes('workatastartup.com/companies') || url.includes('/jobs?');

    if (isListPage) {
      return {
        isListPage: true,
        isJobDetailPage: false,
        hasApplyButton: false,
        title: '',
        company: '',
        description: ''
      };
    }

    // Extract job detail info
    const titleEl = document.querySelector('h1, [class*="job-title"], [class*="title"]');
    const companyEl = document.querySelector('[class*="company-name"], h2, [class*="company"]');
    const applyBtn = Array.from(document.querySelectorAll('button, a[href*="apply"]')).find(b => {
      const txt = (b.innerText || '').trim().toLowerCase();
      return txt === 'apply' && b.offsetWidth > 0;
    });

    // Get description text for message personalization
    const descContainer = document.querySelector('[class*="description"], [class*="about"], main, article, .prose');
    const description = descContainer ? descContainer.innerText.trim().substring(0, 800) : '';

    // Extract tech stack from description / tags
    const techTags = Array.from(document.querySelectorAll('[class*="tag"], [class*="badge"], [class*="stack"], [class*="tech"]'))
      .map(t => t.innerText.trim()).filter(Boolean).join(', ');

    const title = titleEl ? titleEl.innerText.trim().replace(/\\s+/g, ' ') : '';
    const company = companyEl ? companyEl.innerText.trim().split('\\n')[0] : '';

    return {
      isListPage,
      isJobDetailPage,
      title,
      company,
      description,
      techStack: techTags,
      hasApplyButton: Boolean(applyBtn),
      applyBtnText: applyBtn ? applyBtn.innerText.trim() : ''
    };
  })()`);
}

/**
 * Click the Apply button on the job detail page.
 * Returns { clicked, x, y }
 */
async function clickYCApplyButton(ws, cdpEval) {
  const result = await cdpEval(ws, `(() => {
    // Primary apply button at top of job detail page
    const applyBtn = Array.from(document.querySelectorAll('button, a[href*="apply"]')).find(b => {
      const txt = (b.innerText || '').trim().toLowerCase();
      return txt === 'apply' && b.offsetWidth > 0;
    });

    if (!applyBtn) return { clicked: false, reason: 'no_apply_btn' };

    applyBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
    const r = applyBtn.getBoundingClientRect();

    applyBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    applyBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    applyBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
    applyBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    applyBtn.click();

    return {
      clicked: true,
      btnText: applyBtn.innerText.trim(),
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2)
    };
  })()`);

  if (result && result.clicked && result.x && result.y) {
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mousePressed', x: result.x, y: result.y, button: 'left', clickCount: 1 }
    }));
    await new Promise(r => setTimeout(r, 50));
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mouseReleased', x: result.x, y: result.y, button: 'left', clickCount: 1 }
    }));
  }

  return result;
}

/**
 * Navigate back to the job listings page.
 */
async function goBackToListings(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    // Try back button / breadcrumb
    const backLink = document.querySelector('a[href*="/companies?"], a[href*="workatastartup.com/companies"]')
      || Array.from(document.querySelectorAll('a')).find(a => {
          const txt = (a.innerText || '').trim().toLowerCase();
          return (txt === 'back' || txt === 'companies' || txt === 'jobs') && a.href.includes('workatastartup.com');
        });

    if (backLink) {
      backLink.click();
      return { navigated: true, href: backLink.href };
    }

    // Use history back
    window.history.back();
    return { navigated: true, method: 'history_back' };
  })()`);
}

/**
 * Scroll the listings feed to load more jobs.
 */
async function scrollYCFeed(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const scroller = document.querySelector('[class*="job-list"], [class*="listings"], main, .content-container')
      || document.documentElement;
    const before = window.scrollY;
    window.scrollBy({ top: 600, behavior: 'smooth' });
    return { scrolled: true, before, after: window.scrollY };
  })()`);
}

/**
 * Go to next page of YC listings (if pagination exists).
 * YC uses URL params like ?page=2 or scroll-based infinite loading.
 */
async function goToNextYCPage(ws, cdpEval, currentPage) {
  return await cdpEval(ws, `(() => {
    // Look for explicit Next/pagination button
    const nextBtn = Array.from(document.querySelectorAll('a, button')).find(b => {
      const txt = (b.innerText || '').trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return (txt === 'next' || txt === 'next page' || aria === 'next page') && b.offsetWidth > 0;
    });

    if (nextBtn) {
      nextBtn.click();
      return { success: true, method: 'next_button' };
    }

    // YC uses infinite scroll - just scroll to bottom
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    return { success: true, method: 'infinite_scroll' };
  })()`);
}

module.exports = {
  selectNextYCJob,
  inspectYCJob,
  clickYCApplyButton,
  goBackToListings,
  scrollYCFeed,
  goToNextYCPage
};
