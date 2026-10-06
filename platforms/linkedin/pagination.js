/**
 * BioTailr AI StandBy - LinkedIn Pagination Solver
 * Continuously advances page-by-page (Page 1 -> 2 -> 3... 10+) until search termination.
 * Dispatches native CDP mouse events with full URL fallback.
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
      setTimeout(resolve, 300);
    }, 40);
  });
}

async function goToNextLinkedInPage(ws, cdpEval, targetPage) {
  // 1. Scroll container to bottom to ensure pagination buttons are rendered
  await cdpEval(ws, `(() => {
    const list = document.querySelector('.jobs-search-results-list, .scaffold-layout__list-detail-inner, .jobs-search__left-rail');
    if (list) list.scrollTop = list.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
  })()`);

  await new Promise(r => setTimeout(r, 600));

  // 2. Discover pagination target button
  const pageBtnInfo = await cdpEval(ws, `(() => {
    const target = ${Number(targetPage) || 0};

    // Priority 1: Modern or Legacy "Next" button if visible
    const nextBtn = document.querySelector('[data-testid="pagination-controls-next-button-visible"], .jobs-search-pagination__button--next, button[aria-label="View next page"], button[aria-label="Next"]');
    if (nextBtn && !nextBtn.disabled && nextBtn.offsetWidth > 0) {
      nextBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = nextBtn.getBoundingClientRect();
      nextBtn.click();
      return {
        found: true,
        type: 'next_button',
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2)
      };
    }

    // Priority 2: Numeric button for targetPage (e.g. Page 2, Page 3...)
    if (target > 0) {
      const specificBtn = document.querySelector(\`[aria-label="Page \${target}"], [data-testid="pagination-indicator-\${target - 1}"]\`);
      if (specificBtn && !specificBtn.disabled && specificBtn.offsetWidth > 0) {
        specificBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
        const r = specificBtn.getBoundingClientRect();
        specificBtn.click();
        return {
          found: true,
          type: 'target_page_button',
          x: Math.round(r.left + r.width / 2),
          y: Math.round(r.top + r.height / 2)
        };
      }
    }

    // Priority 3: Next numerical page relative to active page
    const pageBtns = Array.from(document.querySelectorAll('button[aria-label*="Page"], [data-testid^="pagination-indicator-"]'));
    const activeBtn = pageBtns.find(b => b.getAttribute('aria-current') === 'true');
    const activeNum = activeBtn ? parseInt(activeBtn.innerText.trim() || activeBtn.getAttribute('aria-label')?.replace(/\\D/g, ''), 10) : 1;
    const nextNum = activeNum + 1;

    const nextTargetBtn = pageBtns.find(b => {
      const num = parseInt(b.innerText.trim() || b.getAttribute('aria-label')?.replace(/\\D/g, ''), 10);
      return num === nextNum;
    });

    if (nextTargetBtn && !nextTargetBtn.disabled && nextTargetBtn.offsetWidth > 0) {
      nextTargetBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      const r = nextTargetBtn.getBoundingClientRect();
      nextTargetBtn.click();
      return {
        found: true,
        type: 'relative_next_page',
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2)
      };
    }

    return { found: false };
  })()`);

  let pageChanged = false;

  if (pageBtnInfo && pageBtnInfo.found && pageBtnInfo.x && pageBtnInfo.y) {
    // Native CDP click for React event handlers
    await dispatchCdpClick(ws, pageBtnInfo.x, pageBtnInfo.y);
    await new Promise(r => setTimeout(r, 2500));

    // Verify page changed
    const checkStatus = await cdpEval(ws, `(() => {
      const url = window.location.href;
      const target = ${Number(targetPage) || 0};
      if (target > 0) {
        const activeBtn = document.querySelector(\`[aria-label="Page \${target}"][aria-current="true"], [data-testid="pagination-indicator-\${target - 1}"][aria-current="true"]\`);
        if (activeBtn) return { success: true };
      }
      return { url };
    })()`);

    if (checkStatus.success) {
      pageChanged = true;
    }
  }

  // 3. Fallback: Direct URL Navigation if DOM click did not switch page or buttons were not found
  if (!pageChanged) {
    const urlNav = await cdpEval(ws, `(() => {
      const currentUrl = new URL(window.location.href);
      const target = ${Number(targetPage) || 0};
      let newStart = 0;
      if (target > 1) {
        newStart = (target - 1) * 25;
      } else {
        const currentStart = parseInt(currentUrl.searchParams.get('start') || '0', 10);
        newStart = currentStart + 25;
      }

      currentUrl.searchParams.set('start', String(newStart));
      window.location.href = currentUrl.toString();
      return { success: true, targetStart: newStart };
    })()`);

    if (urlNav && urlNav.success) {
      await new Promise(r => setTimeout(r, 3500));
      pageChanged = true;
    }
  }

  // 4. Reset feed scroll to top so new jobs are in view
  if (pageChanged) {
    await cdpEval(ws, `(() => {
      const list = document.querySelector('.jobs-search-results-list, .scaffold-layout__list-detail-inner, .jobs-search__left-rail');
      if (list) list.scrollTop = 0;
      window.scrollTo(0, 0);
    })()`);
    await new Promise(r => setTimeout(r, 1200));
    return { success: true };
  }

  return { success: false };
}

module.exports = {
  goToNextLinkedInPage
};
