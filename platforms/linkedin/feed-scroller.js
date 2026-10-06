/**
 * BioTailr AI StandBy - LinkedIn Feed Scroller
 * Scrolls the active jobs listings container to trigger virtual DOM loading of further cards.
 */

async function scrollLinkedInFeed(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    // 1. Modern layout scroll container detection
    const dismissBtn = document.querySelector('button[aria-label*="Dismiss"], button[aria-label*="dismiss"]');
    let container = null;
    if (dismissBtn) {
      let p = dismissBtn.parentElement;
      while (p && p.tagName !== 'BODY') {
        if (p.scrollHeight > p.clientHeight + 100 && p.offsetHeight > 200) {
          container = p;
          break;
        }
        p = p.parentElement;
      }
    }

    // 2. Legacy selectors fallback
    if (!container) {
      container = document.querySelector('.jobs-search-results-list, .jobs-search-results, div[data-view-name="job-search-results-list"], .scaffold-layout__list-detail');
    }

    if (container) {
      container.scrollTop += 600;
      container.dispatchEvent(new Event('scroll', { bubbles: true }));
      return true;
    }

    window.scrollBy(0, 600);
    return false;
  })()`);
}

module.exports = {
  scrollLinkedInFeed
};
