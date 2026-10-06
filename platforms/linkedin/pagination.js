/**
 * BioTailr AI StandBy - LinkedIn Pagination Solver
 * Continuously advances page-by-page (Page 1 -> 2 -> 3... 10+) until search termination.
 */

async function goToNextLinkedInPage(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    // 1. Next button
    const nextBtns = Array.from(document.querySelectorAll('button, a[role="button"]')).filter(b => {
      const t = b.innerText.trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return (t === 'next' || aria === 'next' || aria.includes('next page') || b.classList.contains('jobs-search-pagination__button--next')) && !b.disabled && b.offsetWidth > 0;
    });

    if (nextBtns.length > 0) {
      const nextBtn = nextBtns[0];
      nextBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      nextBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      nextBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      nextBtn.click();
      return { success: true };
    }

    // 2. Numeric page buttons (e.g. Page 1 -> Page 2 -> Page 3...)
    const pageBtns = Array.from(document.querySelectorAll('button, a[role="button"]')).filter(b => {
      const aria = (b.getAttribute('aria-label') || '');
      const t = b.innerText.trim();
      return /Page\\s+\\d+/i.test(aria) || /^\\d+$/.test(t);
    });

    const activeBtn = pageBtns.find(b => b.getAttribute('aria-current') === 'true' || b.classList.contains('active') || b.parentElement?.classList.contains('active'));
    const activeNum = activeBtn ? parseInt(activeBtn.innerText.trim() || activeBtn.getAttribute('aria-label')?.replace(/\\D/g, ''), 10) : 1;
    const nextNum = activeNum + 1;
    const targetBtn = pageBtns.find(b => {
      const num = parseInt(b.innerText.trim() || b.getAttribute('aria-label')?.replace(/\\D/g, ''), 10);
      return num === nextNum;
    });

    if (targetBtn && !targetBtn.disabled) {
      targetBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      targetBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      targetBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      targetBtn.click();
      return { success: true };
    }

    return { success: false };
  })()`);
}

module.exports = {
  goToNextLinkedInPage
};
