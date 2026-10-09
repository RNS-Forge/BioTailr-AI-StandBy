/**
 * BioTailr AI StandBy - Naukri Pagination Solver
 * Continuously advances page-by-page (Page 1 -> 2 -> 3... 10+) across Naukri search results.
 * Supports DOM click on pagination buttons with full URL routing fallback.
 */

const { dispatchCdpClick } = require('./card-selector');

async function goToNextNaukriPage(ws, cdpEval, targetPage) {
  // 1. Scroll to bottom of page to trigger pagination controls render
  await cdpEval(ws, `(() => {
    window.scrollTo(0, document.body.scrollHeight);
  })()`);

  await new Promise(r => setTimeout(r, 600));

  // 2. Discover pagination target button
  const pageBtnInfo = await cdpEval(ws, `(() => {
    const target = ${Number(targetPage) || 0};

    // Priority 1: "Next" pagination link/button
    const nextBtn = Array.from(document.querySelectorAll('a, button')).find(el => {
      if (el.offsetWidth <= 0) return false;
      const txt = (el.innerText || '').toLowerCase().trim();
      const cls = (el.className || '').toLowerCase();
      return (txt === 'next' || txt.includes('next »') || txt.includes('next >') || cls.includes('fright') || cls.includes('next')) &&
             !cls.includes('disabled') && !el.hasAttribute('disabled');
    });

    if (nextBtn) {
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

    // Priority 2: Target numerical page button (e.g. Page 2, Page 3)
    if (target > 0) {
      const numBtn = Array.from(document.querySelectorAll('a, button')).find(el => {
        if (el.offsetWidth <= 0) return false;
        const txt = (el.innerText || '').trim();
        return txt === String(target);
      });

      if (numBtn) {
        numBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
        const r = numBtn.getBoundingClientRect();
        numBtn.click();
        return {
          found: true,
          type: 'target_page_button',
          x: Math.round(r.left + r.width / 2),
          y: Math.round(r.top + r.height / 2)
        };
      }
    }

    return { found: false };
  })()`);

  let pageChanged = false;

  if (pageBtnInfo && pageBtnInfo.found && pageBtnInfo.x && pageBtnInfo.y) {
    await dispatchCdpClick(ws, pageBtnInfo.x, pageBtnInfo.y);
    await new Promise(r => setTimeout(r, 2500));
    pageChanged = true;
  }

  // 3. Fallback: Direct URL Navigation if DOM click did not switch page
  if (!pageChanged) {
    const urlNav = await cdpEval(ws, `(() => {
      const currentUrl = new URL(window.location.href);
      const target = ${Number(targetPage) || 2};

      // Check if URL has query parameter pageNo
      if (currentUrl.searchParams.has('pageNo')) {
        currentUrl.searchParams.set('pageNo', String(target));
        window.location.href = currentUrl.toString();
        return { success: true, method: 'searchParams' };
      }

      // Check if pathname has -jobs or -jobs-X
      let pathname = currentUrl.pathname;
      if (/-jobs(-\\d+)?$/.test(pathname)) {
        pathname = pathname.replace(/-jobs(-\\d+)?$/, \`-jobs-\${target}\`);
        currentUrl.pathname = pathname;
        window.location.href = currentUrl.toString();
        return { success: true, method: 'pathname' };
      }

      // Otherwise set pageNo query param
      currentUrl.searchParams.set('pageNo', String(target));
      window.location.href = currentUrl.toString();
      return { success: true, method: 'defaultParam' };
    })()`);

    if (urlNav && urlNav.success) {
      await new Promise(r => setTimeout(r, 3500));
      pageChanged = true;
    }
  }

  // 4. Reset scroll to top
  if (pageChanged) {
    await cdpEval(ws, `(() => {
      window.scrollTo(0, 0);
    })()`);
    await new Promise(r => setTimeout(r, 1200));
    return { success: true };
  }

  return { success: false };
}

module.exports = {
  goToNextNaukriPage
};
