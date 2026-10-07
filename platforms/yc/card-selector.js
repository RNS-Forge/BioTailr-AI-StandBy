/**
 * BioTailr AI StandBy - YC Card Selector & Tab Manager
 * Handles the YC listing page where each job card has a direct "Apply" button.
 * Clicking Apply opens a NEW TAB with the job detail page.
 *
 * Flow:
 *  1. On listing page: find unvisited "Apply" button on a job card
 *  2. Click it → new tab opens with job detail
 *  3. Caller switches CDP to the new tab
 *  4. On new tab: read job details → click Apply → fill modal → Send
 *  5. Close the new tab → back to listing tab
 */

const http = require('http');

/**
 * Find all job cards on the listing page and return the next unvisited one.
 * Returns { found, title, company, cardIndex, applyBtn coords }
 * Does NOT click — caller will click so we can intercept the new tab.
 */
async function findNextYCCard(ws, cdpEval, visitedKeys) {
  const serializedKeys = JSON.stringify(Array.from(visitedKeys));

  return await cdpEval(ws, `(() => {
    const visited = new Set(${serializedKeys});

    // Each job card is a container with: company name, job title, "Apply" button
    // Try multiple selector strategies based on YC's grid layout
    const applyButtons = Array.from(document.querySelectorAll('button, a[href*="/jobs/"]')).filter(btn => {
      const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
      return txt === 'apply' && btn.offsetWidth > 0 && btn.offsetHeight > 0;
    });

    for (let i = 0; i < applyButtons.length; i++) {
      const btn = applyButtons[i];

      // Get parent card to extract title and company
      let card = btn.closest('[class*="company"], [class*="job"], [class*="listing"], [class*="card"], article, li');
      if (!card) {
        // Walk up max 6 levels
        let p = btn.parentElement;
        for (let d = 0; d < 6; d++) {
          if (!p) break;
          if (p.querySelectorAll('a[href]').length > 0 && p.innerText.length > 50) {
            card = p;
            break;
          }
          p = p.parentElement;
        }
      }

      const cardText = card ? card.innerText : '';

      // Extract job title: usually a link with blue text
      const titleLink = card ? card.querySelector('a[href*="/jobs/"], a[href*="/companies/"], [class*="title"], h2, h3') : null;
      const title = titleLink ? titleLink.innerText.trim().split('\\n')[0] : '';

      // Extract company: first heading or bold text
      const companyEl = card ? card.querySelector('[class*="company"], b, strong, h1, h2') : null;
      let company = companyEl ? companyEl.innerText.trim().split('\\n')[0] : '';
      // Remove batch tag like "(W16)" from company name
      company = company.replace(/\\s*\\([A-Z]\\d+\\).*$/, '').trim();

      const key = (title + '::' + company).toLowerCase();
      const titleKey = title.toLowerCase();

      if (visited.has(key) || visited.has(titleKey)) continue;

      // Return button coordinates without clicking (caller will use CDP mouse events)
      btn.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = btn.getBoundingClientRect();

      return {
        found: true,
        title: title || 'Engineering Role',
        company: company || 'YC Startup',
        cardText: cardText.substring(0, 300),
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
        cardIndex: i
      };
    }

    return { found: false, totalButtons: applyButtons.length };
  })()`);
}

/**
 * Click the Apply button using CDP mouse events (so the new tab can be detected).
 */
async function clickApplyOnCard(ws, x, y) {
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1000000),
    method: 'Input.dispatchMouseEvent',
    params: { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }
  }));
  await new Promise(r => setTimeout(r, 60));
  ws.send(JSON.stringify({
    id: Math.floor(Math.random() * 1000000),
    method: 'Input.dispatchMouseEvent',
    params: { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }
  }));
}

/**
 * Poll for a new tab that appeared after clicking Apply.
 * Returns the new tab info or null if not found within timeout.
 */
async function waitForNewTab(port, knownTabIds, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 300));
    try {
      const tabs = await getAllTabs(port);
      const newTab = tabs.find(t =>
        t.type === 'page' &&
        t.url &&
        !knownTabIds.has(t.id) &&
        !t.url.includes('chrome://') &&
        !t.url.includes('about:')
      );
      if (newTab) return newTab;
    } catch (e) {
      // ignore
    }
  }
  return null;
}

/**
 * Fetch all open Chrome tabs.
 */
function getAllTabs(port = 9222) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:9222/json`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/**
 * Close a tab by its target ID via CDP HTTP endpoint.
 */
function closeTab(port, targetId) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:9222/json/close/${targetId}`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve('error'));
    req.setTimeout(3000, () => { req.destroy(); resolve('timeout'); });
  });
}

/**
 * Inspect the job detail page on a newly opened tab.
 * Returns { title, company, description, techStack, hasApplyButton }
 */
async function inspectJobDetailPage(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const url = window.location.href;

    // Extract job title from page heading
    const titleEl = document.querySelector('h1, [class*="job-title"], [class*="role-title"]');
    const title = titleEl ? titleEl.innerText.trim().replace(/\\s+/g, ' ') : '';

    // Extract company from breadcrumb or subheading
    const companyEl = document.querySelector([
      '[class*="company-name"]',
      'h2',
      '.company-header h1',
      'nav a',
      '[class*="company"] h1',
      '[class*="company"] h2'
    ].join(', '));
    let company = companyEl ? companyEl.innerText.trim().split('\\n')[0] : '';
    company = company.replace(/\\s*\\([A-Z]\\d+\\).*$/, '').trim();

    // Get job description
    const descEl = document.querySelector([
      '[class*="description"]',
      '[class*="job-content"]',
      '[class*="role-description"]',
      'main article',
      '.prose',
      'main'
    ].join(', '));
    const description = descEl ? descEl.innerText.trim().substring(0, 1000) : document.body.innerText.substring(0, 600);

    // Tech stack tags
    const techTags = Array.from(document.querySelectorAll('[class*="tag"], [class*="badge"], [class*="tech"], [class*="skill"]'))
      .map(t => t.innerText.trim()).filter(t => t.length > 0 && t.length < 30).join(', ');

    // Find Apply button on detail page
    const applyBtn = Array.from(document.querySelectorAll('button, a')).find(b => {
      const txt = (b.innerText || '').trim().toLowerCase();
      return txt === 'apply' && b.offsetWidth > 0;
    });

    return {
      url,
      title: title || document.title.split(' - ')[0].trim(),
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
 */
async function clickApplyOnDetailPage(ws, cdpEval) {
  const result = await cdpEval(ws, `(() => {
    const applyBtn = Array.from(document.querySelectorAll('button, a')).find(b => {
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
 * Scroll the YC listings page to load more job cards.
 */
async function scrollYCFeed(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    window.scrollBy({ top: 700, behavior: 'smooth' });
    return { scrolled: true };
  })()`);
}

module.exports = {
  findNextYCCard,
  clickApplyOnCard,
  waitForNewTab,
  getAllTabs,
  closeTab,
  inspectJobDetailPage,
  clickApplyOnDetailPage,
  scrollYCFeed
};
