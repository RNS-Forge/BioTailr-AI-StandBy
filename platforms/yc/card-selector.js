/**
 * BioTailr AI StandBy - YC Card Selector & Tab Manager
 *
 * Real YC DOM structure (from debug):
 * - Listing page: workatastartup.com/companies?... or /jobs
 * - Each job has a "View job" link → opens same tab to /jobs/XXXXX
 * - On detail page: Apply is an <a> tag (not button) at top right
 * - Apply opens a modal on the SAME page (not new tab)
 *   OR navigates to a new URL
 *
 * Strategy:
 *  1. On listing page: find all "View job" <a href="/jobs/..."> links
 *  2. Navigate to each one (same tab)
 *  3. On detail page: click the Apply <a> button
 *  4. Fill the modal textarea → Send
 *  5. Navigate back to listing page
 */

const http = require('http');

/**
 * Find all unvisited job links on the listing page.
 * Returns the first unvisited one with its href.
 */
async function findNextYCJobLink(ws, cdpEval, visitedKeys) {
  const serialized = JSON.stringify(Array.from(visitedKeys));

  return await cdpEval(ws, `(() => {
    const visited = new Set(${serialized});

    // Find all job links: both title links and "View job" links
    const allJobLinks = Array.from(document.querySelectorAll('a[href*="/jobs/"]')).filter(a => {
      const href = a.href || '';
      // Only actual job detail links (not category pages like /jobs/l/...)
      return /\\/jobs\\/\\d+/.test(href) && a.offsetWidth > 0;
    });

    // Group by job ID (href) — prefer the title link (longer text) over "View job"
    const jobMap = new Map();
    allJobLinks.forEach(a => {
      const href = a.href.split('?')[0]; // strip query params
      const jobId = href.match(/\\/jobs\\/(\\d+)/)?.[1] || '';
      if (!jobId) return;

      if (!jobMap.has(jobId)) {
        // Get surrounding card text for title/company
        let card = a.closest('[class*="company"], [class*="job"], [class*="listing"], article, li, div[class]');
        if (!card) {
          let p = a.parentElement;
          for (let i = 0; i < 6; i++) {
            if (!p) break;
            if (p.innerText && p.innerText.length > 50) { card = p; break; }
            p = p.parentElement;
          }
        }

        const cardText = card ? card.innerText.trim() : '';
        const title = a.innerText.trim() !== 'View job' ? a.innerText.trim() :
          (card ? (card.querySelector('a') || {innerText: ''}).innerText.trim() : '');

        jobMap.set(jobId, {
          jobId,
          href,
          title: title || jobId,
          cardSnippet: cardText.substring(0, 200)
        });
      }
    });

    // Find first unvisited
    for (const [jobId, info] of jobMap) {
      if (visited.has(jobId) || visited.has(info.href) || visited.has(info.title.toLowerCase())) {
        continue;
      }

      // Extract title and company from card text
      const lines = info.cardSnippet.split('\\n').map(l => l.trim()).filter(l => l.length > 2);
      const title = lines[0] || info.title;
      let company = '';
      // Company is usually in format "CompanyName (W22)" or similar
      const compLine = lines.find(l => /\\([A-Z]\\d+\\)/.test(l) || /•/.test(l));
      if (compLine) {
        company = compLine.split('•')[0].trim().replace(/\\s*\\([A-Z]\\d+\\).*$/, '').trim();
      }

      return {
        found: true,
        jobId,
        href: info.href,
        title: title || 'Engineering Role',
        company: company || 'YC Startup',
        cardSnippet: info.cardSnippet
      };
    }

    return { found: false, totalLinks: jobMap.size };
  })()`);
}

/**
 * Navigate to a job detail page URL (same tab).
 */
async function navigateToJob(ws, cdpEval, href) {
  return await cdpEval(ws, `(() => {
    window.location.href = ${JSON.stringify(href)};
    return { navigating: true, href: ${JSON.stringify(href)} };
  })()`);
}

/**
 * Wait for a page to finish loading (URL changes).
 */
async function waitForPageLoad(ws, cdpEval, expectedUrlPart, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 400));
    const url = await cdpEval(ws, `window.location.href`);
    if (url && url.includes(expectedUrlPart)) return true;
  }
  return false;
}

/**
 * Navigate back to the listing page.
 */
async function navigateBack(ws, cdpEval, listingUrl) {
  return await cdpEval(ws, `(() => {
    window.history.back();
    return { back: true };
  })()`);
}

/**
 * Inspect the job detail page - get title, company, description, and Apply button state.
 */
async function inspectJobDetailPage(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const url = window.location.href;

    // Job title - usually h1 or the first big heading
    const titleEl = document.querySelector('h1, [class*="job-title"], [class*="role-title"], [class*="title"]');
    const title = titleEl ? titleEl.innerText.trim().replace(/\\s+/g, ' ').split('\\n')[0] : '';

    // Company from breadcrumb or header
    const breadcrumbs = Array.from(document.querySelectorAll('nav a, [class*="breadcrumb"] a, [class*="company"]'));
    const companyEl = breadcrumbs.find(el => {
      const href = el.href || '';
      return href.includes('/companies/') && el.innerText.trim().length > 1;
    }) || document.querySelector('[class*="company-name"], [class*="company"] h1, [class*="company"] h2');
    let company = companyEl ? companyEl.innerText.trim().split('\\n')[0] : '';
    company = company.replace(/\\s*\\([A-Z]\\d+\\).*$/, '').trim();

    // Description
    const descContainers = [
      document.querySelector('[class*="description"]'),
      document.querySelector('[class*="about"]'),
      document.querySelector('main'),
      document.querySelector('article')
    ];
    const descEl = descContainers.find(el => el && el.innerText && el.innerText.length > 100);
    const description = descEl ? descEl.innerText.trim().substring(0, 1000) : document.body.innerText.substring(0, 500);

    // Tech tags
    const techTags = Array.from(document.querySelectorAll('[class*="tag"], [class*="badge"], [class*="tech"], [class*="skill"], [class*="stack"]'))
      .map(t => t.innerText.trim()).filter(t => t.length > 0 && t.length < 40).join(', ');

    // Apply button - it's an <a> tag in YC
    const applyEl = Array.from(document.querySelectorAll('a, button')).find(el => {
      const txt = (el.innerText || '').trim().toLowerCase();
      return txt === 'apply' && el.offsetWidth > 0;
    });

    let applyX = 0, applyY = 0;
    if (applyEl) {
      const r = applyEl.getBoundingClientRect();
      applyX = Math.round(r.left + r.width / 2);
      applyY = Math.round(r.top + r.height / 2);
    }

    return {
      url,
      title: title || document.title.split(' at ')[0].trim(),
      company: company || document.title.split(' at ')[1]?.split('(')[0]?.trim() || '',
      description,
      techStack: techTags,
      hasApplyButton: Boolean(applyEl),
      applyX,
      applyY,
      applyTag: applyEl ? applyEl.tagName : ''
    };
  })()`);
}

/**
 * Click the Apply button on the job detail page using CDP mouse events.
 */
async function clickApplyOnDetailPage(ws, cdpEval) {
  const result = await cdpEval(ws, `(() => {
    const applyEl = Array.from(document.querySelectorAll('a, button')).find(el => {
      const txt = (el.innerText || '').trim().toLowerCase();
      return txt === 'apply' && el.offsetWidth > 0;
    });

    if (!applyEl) return { clicked: false, reason: 'no_apply_element' };

    applyEl.scrollIntoView({ behavior: 'instant', block: 'center' });
    const r = applyEl.getBoundingClientRect();

    // Fire full event sequence
    applyEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    applyEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    applyEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    applyEl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
    applyEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    applyEl.click();

    return {
      clicked: true,
      tag: applyEl.tagName,
      href: applyEl.href || '',
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
    await new Promise(r => setTimeout(r, 60));
    ws.send(JSON.stringify({
      id: Math.floor(Math.random() * 1000000),
      method: 'Input.dispatchMouseEvent',
      params: { type: 'mouseReleased', x: result.x, y: result.y, button: 'left', clickCount: 1 }
    }));
  }

  return result;
}

/**
 * Get list of all open Chrome tabs.
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
 * Wait for a new tab to appear.
 */
async function waitForNewTab(port, knownTabIds, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 350));
    try {
      const tabs = await getAllTabs(port);
      const newTab = tabs.find(t =>
        t.type === 'page' && t.url && !knownTabIds.has(t.id) &&
        !t.url.startsWith('chrome://') && !t.url.startsWith('about:')
      );
      if (newTab) return newTab;
    } catch (_) {}
  }
  return null;
}

/**
 * Close a tab by target ID.
 */
function closeTab(port, targetId) {
  return new Promise(resolve => {
    http.get(`http://127.0.0.1:9222/json/close/${targetId}`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', () => resolve('error'));
  });
}

/**
 * Scroll the page down to reveal more job cards.
 */
async function scrollYCFeed(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    window.scrollBy({ top: 800, behavior: 'smooth' });
    return { scrolled: true, scrollY: window.scrollY };
  })()`);
}

module.exports = {
  findNextYCJobLink,
  navigateToJob,
  waitForPageLoad,
  navigateBack,
  inspectJobDetailPage,
  clickApplyOnDetailPage,
  getAllTabs,
  waitForNewTab,
  closeTab,
  scrollYCFeed
};
