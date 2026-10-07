/**
 * BioTailr AI StandBy - YC (Work at a Startup) Orchestrator
 *
 * Real flow based on DOM inspection:
 *  1. Start on listing page (workatastartup.com/companies?... or /jobs)
 *  2. Find all job links (a[href*="/jobs/NNNN"]) → navigate same tab to each
 *  3. On job detail page: click Apply <a> button
 *  4. Modal or new tab opens with "Reach out to X at Y" form
 *  5. Fill personalized message → tick location checkbox → Send
 *  6. Navigate back to listing page → repeat
 */

const { log, sleep, connectWebSocket, cdpEval } = require('./cdp-client');
const { ensureHudInjected, resetHudToStandby, updateHud } = require('./hud-manager');
const { generateYCMessage } = require('../platforms/yc/message-generator');
const {
  getYCModalStatus,
  fillYCMessageTextarea,
  handleLocationCheckbox,
  clickYCSendButton,
  dismissYCModal
} = require('../platforms/yc/apply-modal');
const {
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
} = require('../platforms/yc/card-selector');

class YCOrchestrator {
  constructor(ws, profile, cdpPort = 9222) {
    this.ws = ws;
    this.profile = profile;
    this.cdpPort = cdpPort;
    this.listingUrl = '';  // Will be captured on start
    this.batchTarget = (profile.settings?.batchTarget === 0 || profile.settings?.batchTarget === 'unlimited')
      ? Infinity
      : (profile.settings?.batchTarget || Infinity);
  }

  async run() {
    console.log('====================================================');
    console.log('   BioTailr AI StandBy - YC Work at a Startup Engine');
    console.log('====================================================');
    log('INIT', 'Starting YC autonomous auto-apply orchestrator...');

    await ensureHudInjected(this.ws);
    await resetHudToStandby(this.ws);

    // Capture the listing page URL so we can return to it
    this.listingUrl = await cdpEval(this.ws, `window.location.href`);
    log('LISTING', `Starting from: ${this.listingUrl}`);

    const appliedJobs = [];
    const failedJobs = [];
    const visitedJobIds = new Set();

    await updateHud(this.ws, {
      page: 1,
      appliedCount: 0,
      failedCount: 0,
      appliedJobs: [],
      failedJobs: [],
      jobTitle: 'Scanning YC listings...',
      company: 'Work at a Startup',
      status: 'ACTIVE'
    });

    log('START', 'YC continuous apply active. Finding job links...');

    let jobIndex = 0;
    let scrollCount = 0;
    const MAX_SCROLLS = 30;

    while (appliedJobs.length < this.batchTarget) {
      jobIndex++;
      console.log('\n----------------------------------------------------');
      const targetLabel = this.batchTarget === Infinity ? 'Unlimited' : String(this.batchTarget);
      log('BATCH', `[Applied: ${appliedJobs.length}/${targetLabel} | Job #${jobIndex}] Scanning for next unvisited job...`);

      // Make sure we're on the listing page
      const currentUrl = await cdpEval(this.ws, `window.location.href`);
      if (currentUrl && !currentUrl.includes(this.listingUrl.split('?')[0].replace('https://www.workatastartup.com', ''))) {
        log('NAV', 'Not on listing page — navigating back...');
        await cdpEval(this.ws, `window.location.href = ${JSON.stringify(this.listingUrl)}`);
        await sleep(3000);
        await ensureHudInjected(this.ws);
      }

      // Find next unvisited job link
      const nextJob = await findNextYCJobLink(this.ws, cdpEval, visitedJobIds);

      if (!nextJob || !nextJob.found) {
        if (scrollCount >= MAX_SCROLLS) {
          log('COMPLETE', 'Scrolled through all visible listings. Session complete.');
          break;
        }
        scrollCount++;
        log('FEED', `No more unvisited jobs visible. Scrolling (${scrollCount}/${MAX_SCROLLS})...`);
        await scrollYCFeed(this.ws, cdpEval);
        await sleep(1800);
        continue;
      }

      scrollCount = 0;

      // Mark as visited
      visitedJobIds.add(nextJob.jobId);
      visitedJobIds.add(nextJob.href);
      visitedJobIds.add(nextJob.title.toLowerCase());

      log('INFO', `Next job: "${nextJob.title}" at "${nextJob.company}" → ${nextJob.href}`);

      await updateHud(this.ws, {
        page: 1,
        appliedCount: appliedJobs.length,
        failedCount: failedJobs.length,
        appliedJobs,
        failedJobs,
        jobTitle: nextJob.title,
        company: nextJob.company,
        status: 'Navigating to Job'
      });

      // Step 1: Navigate to the job detail page
      log('NAV', `Navigating to ${nextJob.href}...`);
      await navigateToJob(this.ws, cdpEval, nextJob.href);
      await sleep(2500);

      // Verify we landed on the right page
      const landedUrl = await cdpEval(this.ws, `window.location.href`);
      if (!landedUrl || !landedUrl.includes('/jobs/')) {
        log('WARN', `Navigation failed for job #${nextJob.jobId}. Skipping...`);
        failedJobs.push({ title: nextJob.title, company: nextJob.company, reason: 'Navigation to job detail failed' });
        continue;
      }

      // Reinject HUD after navigation
      await ensureHudInjected(this.ws);

      // Step 2: Read job details
      const jobDetail = await inspectJobDetailPage(this.ws, cdpEval);
      const title = jobDetail?.title || nextJob.title;
      const company = jobDetail?.company || nextJob.company;
      const description = jobDetail?.description || nextJob.cardSnippet || '';
      const techStack = jobDetail?.techStack || '';

      log('INFO', `Detail page: "${title}" at "${company}" | Has Apply: ${jobDetail?.hasApplyButton}`);

      if (!jobDetail?.hasApplyButton) {
        log('WARN', `No Apply button found on detail page for "${title}". Skipping...`);
        failedJobs.push({ title, company, reason: 'No Apply button on detail page' });
        // Go back to listing
        await cdpEval(this.ws, `window.location.href = ${JSON.stringify(this.listingUrl)}`);
        await sleep(2500);
        await ensureHudInjected(this.ws);
        continue;
      }

      await updateHud(this.ws, {
        page: 1,
        appliedCount: appliedJobs.length,
        failedCount: failedJobs.length,
        appliedJobs,
        failedJobs,
        jobTitle: title,
        company,
        status: 'Clicking Apply'
      });

      // Step 3: Snapshot tabs before clicking Apply (in case it opens a new tab)
      let tabsBefore;
      try { tabsBefore = await getAllTabs(this.cdpPort); } catch (_) { tabsBefore = []; }
      const knownTabIds = new Set(tabsBefore.map(t => t.id));

      // Click Apply button
      log('ACTION', `Clicking Apply for "${title}"...`);
      const applyResult = await clickApplyOnDetailPage(this.ws, cdpEval);
      log('INFO', `Apply click result: ${JSON.stringify(applyResult)}`);
      await sleep(1500);

      // Step 4: Detect if new tab opened or modal appeared on same page
      let applied = false;

      // Check if a new tab opened
      let newTab = null;
      try {
        const tabsAfter = await getAllTabs(this.cdpPort);
        newTab = tabsAfter.find(t =>
          t.type === 'page' && t.url && !knownTabIds.has(t.id) &&
          !t.url.startsWith('chrome://') && !t.url.startsWith('about:')
        );
      } catch (_) {}

      if (newTab) {
        // Case A: New tab opened
        log('TAB', `New tab opened: ${newTab.url}`);
        applied = await this._handleNewTab(newTab, title, company, description, techStack, appliedJobs, failedJobs, jobIndex);
      } else {
        // Case B: Modal appeared on current page (same tab)
        log('MODAL', 'No new tab — checking for modal on current page...');
        applied = await this._handleModalOnSamePage(title, company, description, techStack, appliedJobs, failedJobs, jobIndex);
      }

      // Step 5: Navigate back to listing page
      log('NAV', 'Returning to listing page...');
      await cdpEval(this.ws, `window.location.href = ${JSON.stringify(this.listingUrl)}`);
      await sleep(3000);
      await ensureHudInjected(this.ws);

      await updateHud(this.ws, {
        page: 1,
        appliedCount: appliedJobs.length,
        failedCount: failedJobs.length,
        appliedJobs,
        failedJobs,
        jobTitle: 'Scanning next job...',
        company: 'Work at a Startup',
        status: applied ? 'Applied — Finding Next' : 'Failed — Finding Next'
      });

      log('LISTING', `Back on listing page. Total applied: ${appliedJobs.length}`);
      await sleep(500);
    }

    // Final summary
    console.log('\n====================================================');
    log('COMPLETE', `YC session finished: ${appliedJobs.length} applied, ${failedJobs.length} failed/skipped.`);
    console.log('====================================================');
    if (appliedJobs.length > 0) {
      console.log('\nSuccessful Applications:');
      console.table(appliedJobs);
    }
    if (failedJobs.length > 0) {
      console.log('\nFailed / Skipped:');
      console.table(failedJobs);
    }

    await updateHud(this.ws, {
      page: 1,
      appliedCount: appliedJobs.length,
      failedCount: failedJobs.length,
      appliedJobs,
      failedJobs,
      jobTitle: 'All YC Jobs Processed',
      company: 'Session Finished',
      status: 'COMPLETE'
    });

    this.ws.close();
    process.exit(0);
  }

  /**
   * Handle apply modal that opened on the SAME page (no new tab).
   */
  async _handleModalOnSamePage(title, company, description, techStack, appliedJobs, failedJobs, jobIndex) {
    const modalStatus = await getYCModalStatus(this.ws, cdpEval);

    if (!modalStatus || !modalStatus.open) {
      log('WARN', `No modal found on page for "${title}".`);
      failedJobs.push({ title, company, reason: 'Apply clicked but no modal appeared' });
      return false;
    }

    log('MODAL', `Modal open: "${modalStatus.headingText}"`);
    return await this._fillAndSendModal(this.ws, title, company, description, techStack, appliedJobs, failedJobs, jobIndex);
  }

  /**
   * Handle apply when a new tab was opened.
   */
  async _handleNewTab(newTab, title, company, description, techStack, appliedJobs, failedJobs, jobIndex) {
    let newTabWs;
    try {
      newTabWs = await connectWebSocket(newTab.webSocketDebuggerUrl);
    } catch (e) {
      log('WARN', `Could not connect to new tab: ${e.message}`);
      failedJobs.push({ title, company, reason: `New tab WebSocket failed: ${e.message}` });
      try { await closeTab(this.cdpPort, newTab.id); } catch (_) {}
      return false;
    }

    await sleep(1500);

    // Check if there's an Apply button on the new tab's page too
    const newTabDetail = await inspectJobDetailPage(newTabWs, cdpEval);
    if (newTabDetail && newTabDetail.hasApplyButton) {
      log('INFO', `New tab has Apply button too. Clicking it...`);
      await clickApplyOnDetailPage(newTabWs, cdpEval);
      await sleep(1200);
    }

    // Check modal on new tab
    const modalStatus = await getYCModalStatus(newTabWs, cdpEval);
    let result = false;

    if (modalStatus && modalStatus.open) {
      log('MODAL', `Modal on new tab: "${modalStatus.headingText}"`);
      result = await this._fillAndSendModal(newTabWs, title, company, description, techStack, appliedJobs, failedJobs, jobIndex);
    } else {
      log('WARN', `No modal on new tab for "${title}". Marking failed.`);
      failedJobs.push({ title, company, reason: 'New tab opened but no apply modal found' });
    }

    try { newTabWs.close(); } catch (_) {}
    await sleep(300);
    await closeTab(this.cdpPort, newTab.id);
    await sleep(500);
    return result;
  }

  /**
   * Fill the "Reach out to X" modal and click Send.
   */
  async _fillAndSendModal(ws, title, company, description, techStack, appliedJobs, failedJobs, jobIndex) {
    // Generate personalized message
    const message = generateYCMessage({ title, company, description, techStack }, this.profile);
    log('MESSAGE', `Message (${message.length} chars): "${message.substring(0, 70)}..."`);

    await updateHud(this.ws, {
      page: 1,
      appliedCount: appliedJobs.length,
      failedCount: failedJobs.length,
      appliedJobs,
      failedJobs,
      jobTitle: title,
      company,
      status: 'Filling Message'
    });

    // Fill textarea
    const filled = await fillYCMessageTextarea(ws, cdpEval, message);
    if (!filled || !filled.filled) {
      log('WARN', `Could not fill textarea for "${title}".`);
      failedJobs.push({ title, company, reason: 'Could not fill message textarea' });
      try { await dismissYCModal(ws, cdpEval); } catch (_) {}
      return false;
    }
    log('FILL', `Filled ${filled.length} chars`);
    await sleep(300);

    // Tick location checkbox
    await handleLocationCheckbox(ws, cdpEval);
    await sleep(200);

    // Send with retries
    for (let attempt = 1; attempt <= 3; attempt++) {
      const sendResult = await clickYCSendButton(ws, cdpEval);
      if (!sendResult || !sendResult.clicked) {
        log('WARN', `Send not clicked (attempt ${attempt}/3)...`);
        await sleep(600);
        continue;
      }

      log('SEND', `Clicked Send (attempt ${attempt}/3)...`);
      await sleep(1500);

      const postStatus = await getYCModalStatus(ws, cdpEval);

      if (!postStatus || !postStatus.open || postStatus.isSent) {
        log('SUCCESS', `Application sent to "${company}" for "${title}"!`);
        appliedJobs.push({
          index: jobIndex,
          title, company,
          status: 'SENT',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        await updateHud(this.ws, {
          page: 1,
          appliedCount: appliedJobs.length,
          failedCount: failedJobs.length,
          appliedJobs,
          failedJobs,
          jobTitle: title, company,
          status: 'Applied'
        });
        return true;
      }

      // Error - extend message if char count
      if (postStatus.errorText) {
        log('RETRY', `Error: "${postStatus.errorText.substring(0, 60)}". Extending message...`);
        const extMsg = message + ` I am genuinely excited about ${company} and believe I can add immediate value. Would love to connect and tell you more!`;
        await fillYCMessageTextarea(ws, cdpEval, extMsg);
        await sleep(300);
      }
    }

    // Failed after retries
    log('WARN', `Could not confirm send for "${title}".`);
    failedJobs.push({ title, company, reason: 'Message send failed after 3 retries' });
    try { await dismissYCModal(ws, cdpEval); } catch (_) {}
    return false;
  }
}

module.exports = YCOrchestrator;
