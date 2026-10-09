/**
 * BioTailr AI StandBy - Naukri Feed Scroller
 * Scrolls the active jobs listings container or window to trigger lazy-loaded job tuples.
 */

async function scrollNaukriFeed(ws, cdpEval) {
  return await cdpEval(ws, `(() => {
    // 1. Look for scrollable listings container
    const listContainers = [
      document.querySelector('.styles_job_listing__container__...'),
      document.querySelector('[class*="job-listing-container"]'),
      document.querySelector('.srp-container'),
      document.querySelector('#listContainer')
    ].filter(Boolean);

    for (const c of listContainers) {
      if (c.scrollHeight > c.clientHeight + 100 && c.offsetHeight > 200) {
        c.scrollTop += 700;
        c.dispatchEvent(new Event('scroll', { bubbles: true }));
        return true;
      }
    }

    // 2. Fallback: Scroll window
    window.scrollBy(0, 700);
    return true;
  })()`);
}

module.exports = {
  scrollNaukriFeed
};
