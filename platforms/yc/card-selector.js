/**
 * BioTailr AI StandBy - YC Card Selector & Tab Manager
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
      return /\\/jobs\\/\\d+/.test(href) && a.offsetWidth > 0;
    });

    const jobMap = new Map();
    allJobLinks.forEach(a => {
      const href = a.href.split('?')[0];
      const jobId = href.match(/\\/jobs\\/(\\d+)/)?.[1] || '';
      if (!jobId) return;

      if (!jobMap.has(jobId)) {
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

      const lines = info.cardSnippet.split('\\n').map(l => l.trim()).filter(l => l.length > 2);
      const title = lines[0] || info.title;
      let company = '';
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
 * Open a job URL in a new Chrome tab via CDP HTTP endpoint.
 */
function openJobInNewTab(port = 9222, href) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(href);
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: `/json/new?${encoded}`,
      method: 'PUT'
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Close a Chrome tab via CDP HTTP endpoint.
 */
function closeTab(port = 9222, tabId) {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${port}/json/close/${tabId}`, () => resolve());
    req.on('error', () => resolve());
    req.setTimeout(3000, () => { req.destroy(); resolve(); });
  });
}

/**
 * Inspect the job detail page - get title, company, description, and Apply button state.
 */
async function inspectJobDetailPage(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    try {
      const url = window.location.href;

      const titleEl = document.querySelector('h1, [class*="job-title"], [class*="role-title"], [class*="title"]');
      const title = titleEl ? titleEl.innerText.trim().replace(/\\s+/g, ' ').split('\\n')[0] : '';

      const breadcrumbs = Array.from(document.querySelectorAll('nav a, [class*="breadcrumb"] a, [class*="company"]'));
      const companyEl = breadcrumbs.find(el => {
        const href = el.href || '';
        return href.includes('/companies/') && el.innerText.trim().length > 1;
      }) || document.querySelector('[class*="company-name"], [class*="company"] h1, [class*="company"] h2');
      let company = companyEl ? companyEl.innerText.trim().split('\\n')[0] : '';
      company = company.replace(/\\s*\\|.*$/g, '').replace(/\\s*\\([A-Za-z0-9]+\\).*$/g, '').trim();
      if (!company && document.title.includes(' at ')) {
        company = document.title.split(' at ')[1]?.split('|')[0]?.split('(')[0]?.trim() || '';
      }

      const descContainers = [
        document.querySelector('[class*="description"]'),
        document.querySelector('[class*="about"]'),
        document.querySelector('main'),
        document.querySelector('article')
      ];
      const descEl = descContainers.find(el => el && el.innerText && el.innerText.length > 100);
      const description = descEl ? descEl.innerText.trim().substring(0, 1000) : document.body.innerText.substring(0, 500);

      const techTags = Array.from(document.querySelectorAll('[class*="tag"], [class*="badge"], [class*="tech"], [class*="skill"], [class*="stack"]'))
        .map(t => t.innerText.trim()).filter(t => t.length > 0 && t.length < 40).join(', ');

      const applyEl = Array.from(document.querySelectorAll('a, button')).find(el => {
        if (el.closest('#biotailr-hud')) return false;
        const txt = (el.innerText || '').trim().toLowerCase();
        return (txt === 'apply' || txt === 'apply now') && el.offsetWidth > 0;
      });

      const appliedBtn = Array.from(document.querySelectorAll('a, button')).find(el => {
        if (el.closest('#biotailr-hud')) return false;
        const txt = (el.innerText || '').trim().toLowerCase();
        return (txt === 'applied' || txt === 'already applied') && el.offsetWidth > 0;
      });

      const isAlreadyApplied = Boolean(appliedBtn) && !applyEl;
      const hasApplyButton = Boolean(applyEl);

      let applyX = 0, applyY = 0;
      if (applyEl) {
        applyEl.scrollIntoView({ behavior: 'instant', block: 'center' });
        const r = applyEl.getBoundingClientRect();
        applyX = Math.round(r.left + r.width / 2);
        applyY = Math.round(r.top + r.height / 2);
      }

      return {
        url,
        title: title || document.title.split(' at ')[0].trim(),
        company: company || 'Startup',
        description,
        techStack: techTags,
        isAlreadyApplied,
        hasApplyButton,
        applyX,
        applyY,
        applyTag: applyEl ? applyEl.tagName : ''
      };
    } catch (e) {
      return { error: e.message };
    }
  })()`);
}

/**
 * Click the Apply button on the job detail page using focus() + click().
 */
async function clickApplyOnDetailPage(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    const applyEl = Array.from(document.querySelectorAll('a, button')).find(el => {
      if (el.closest('#biotailr-hud')) return false;
      const txt = (el.innerText || '').trim().toLowerCase();
      return (txt === 'apply' || txt === 'apply now') && el.offsetWidth > 0;
    });

    if (!applyEl) return { clicked: false, reason: 'no_apply_element' };

    applyEl.scrollIntoView({ behavior: 'instant', block: 'center' });
    applyEl.focus();
    applyEl.click();

    return {
      clicked: true,
      tag: applyEl.tagName,
      href: applyEl.href || ''
    };
  })()`);
}

/**
 * Scroll the listing page feed down to load more cards.
 */
async function scrollYCFeed(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    window.scrollBy({ top: 800, behavior: 'smooth' });
    return { scrolled: true, scrollY: window.scrollY };
  })()`);
}

module.exports = {
  findNextYCJobLink,
  openJobInNewTab,
  closeTab,
  inspectJobDetailPage,
  clickApplyOnDetailPage,
  scrollYCFeed
};
