/**
 * BioTailr AI StandBy - YC (Work at a Startup) Dedicated Orchestrator
 * Coordinates job discovery, navigation, personalized message generation, and application submission
 * on workatastartup.com.
 *
 * Flow per job:
 *  1. On list page → find unvisited "View job" link → click it
 *  2. Wait for job detail page to load
 *  3. Read: title, company, description, tech stack
 *  4. Click "Apply" button → modal opens
 *  5. Generate personalized message → fill textarea → tick location checkbox → click Send
 *  6. Verify sent → close modal → go back to list → repeat
 */

const { log, sleep } = require('./cdp-client');
const { ensureHudInjected, resetHudToStandby, updateHud } = require('./hud-manager');
const { generateYCMessage } = require('../platforms/yc/message-generator');
const { getYCModalStatus, fillYCMessageTextarea, handleLocationCheckbox, clickYCSendButton, dismissYCModal } = require('../platforms/yc/apply-modal');
const { inspectYCJob, clickYCApplyButton, selectNextYCJob, scrollYCFeed, goToNextYCPage, goBackToListings } = require('../platforms/yc/card-selector');

class YCOrchestrator {
  constructor(ws, profile) {
    this.ws = ws;
    this.profile = profile;
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

    const appliedJobs = [];
    const failedJobs = [];
    const visitedJobKeys = new Set();

    await updateHud(this.ws, {
      page: 1,
      appliedCount: 0,
      failedCount: 0,
      appliedJobs: [],
      failedJobs: [],
      jobTitle: 'Initializing YC Engine...',
      company: 'Work at a Startup',
      status: 'ACTIVE'
    });

    log('START', 'YC continuous apply active. Scanning listings...');

    let jobIndex = 0;
    let currentPage = 1;
    let hasMoreJobs = true;
    let consecutiveNoJobCount = 0;

    // cdpEval wrapper bound to this.ws
    const cdpEval = require('./cdp-client').cdpEval;

    while (appliedJobs.length < this.batchTarget && hasMoreJobs) {
      jobIndex++;
      console.log('\n----------------------------------------------------');
      const targetLabel = this.batchTarget === Infinity ? 'Unlimited' : String(this.batchTarget);
      log('BATCH', `[Applied: ${appliedJobs.length}/${targetLabel} | Job #${jobIndex} | Page ${currentPage}] Scanning YC listings...`);
      console.log('----------------------------------------------------');

      await ensureHudInjected(this.ws);

      // Step 1: Check current page state
      const pageInfo = await inspectYCJob(this.ws, cdpEval);

      if (pageInfo && pageInfo.isJobDetailPage && pageInfo.hasApplyButton) {
        // We're already on a detail page - apply to this job
        log('INFO', `On job detail page: "${pageInfo.title}" at "${pageInfo.company}"`);

        const jobKey = (pageInfo.title + '::' + pageInfo.company).toLowerCase();
        if (visitedJobKeys.has(jobKey)) {
          log('SKIP', 'Already applied to this job. Navigating back...');
          await goBackToListings(this.ws, cdpEval);
          await sleep(2000);
          continue;
        }

        visitedJobKeys.add(jobKey);
        visitedJobKeys.add(pageInfo.title.toLowerCase());

        await this._applyToJob(cdpEval, pageInfo, appliedJobs, failedJobs, currentPage, jobIndex, targetLabel);

        // Go back to listings for next job
        await goBackToListings(this.ws, cdpEval);
        await sleep(2500);
        consecutiveNoJobCount = 0;
        continue;
      }

      // Step 2: On list page — select next unvisited job
      await updateHud(this.ws, {
        page: currentPage,
        appliedCount: appliedJobs.length,
        failedCount: failedJobs.length,
        appliedJobs,
        failedJobs,
        jobTitle: 'Scanning listings...',
        company: 'Work at a Startup',
        status: 'Scanning Cards'
      });

      const nextJob = await selectNextYCJob(this.ws, cdpEval, visitedJobKeys);

      if (!nextJob || !nextJob.found) {
        consecutiveNoJobCount++;
        log('FEED', `No unvisited jobs found (attempt ${consecutiveNoJobCount}). Scrolling for more...`);

        if (consecutiveNoJobCount <= 3) {
          await scrollYCFeed(this.ws, cdpEval);
          await sleep(1800);
          continue;
        }

        // Try next page
        log('PAGINATION', `Page ${currentPage} exhausted. Advancing to next page...`);
        const paged = await goToNextYCPage(this.ws, cdpEval, currentPage + 1);
        if (paged && paged.success) {
          currentPage++;
          consecutiveNoJobCount = 0;
          log('PAGINATION', `Advanced to page ${currentPage}. Loading fresh listings...`);
          await sleep(3500);
          await ensureHudInjected(this.ws);
          continue;
        }

        log('COMPLETE', 'No more jobs found on any page. Session complete.');
        hasMoreJobs = false;
        continue;
      }

      consecutiveNoJobCount = 0;
      log('NAVIGATE', `Opening job detail: "${nextJob.title}" at "${nextJob.company}"...`);

      // Add to visited immediately to avoid re-selecting
      visitedJobKeys.add((nextJob.title + '::' + nextJob.company).toLowerCase());
      if (nextJob.title) visitedJobKeys.add(nextJob.title.toLowerCase());
      if (nextJob.href) visitedJobKeys.add(nextJob.href);
      if (nextJob.urlKey) visitedJobKeys.add(nextJob.urlKey);

      await updateHud(this.ws, {
        page: currentPage,
        appliedCount: appliedJobs.length,
        failedCount: failedJobs.length,
        appliedJobs,
        failedJobs,
        jobTitle: nextJob.title,
        company: nextJob.company,
        status: 'Navigating to Job'
      });

      // Wait for job detail page to load
      await sleep(2500);

      // Step 3: Now on job detail page — inspect and apply
      const jobDetail = await inspectYCJob(this.ws, cdpEval);

      if (!jobDetail || jobDetail.isListPage || !jobDetail.hasApplyButton) {
        log('WARN', `Could not load job detail page for "${nextJob.title}". Skipping...`);
        failedJobs.push({ title: nextJob.title, company: nextJob.company, reason: 'Job detail page did not load or no Apply button' });
        await goBackToListings(this.ws, cdpEval);
        await sleep(1500);
        continue;
      }

      await this._applyToJob(cdpEval, { ...nextJob, ...jobDetail }, appliedJobs, failedJobs, currentPage, jobIndex, targetLabel);

      // Go back to listings for next job
      await goBackToListings(this.ws, cdpEval);
      await sleep(2500);
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
      console.log('\nFailed / Skipped Listings:');
      console.table(failedJobs);
    }

    await updateHud(this.ws, {
      page: currentPage,
      appliedCount: appliedJobs.length,
      failedCount: failedJobs.length,
      appliedJobs,
      failedJobs,
      jobTitle: 'All YC Pages Completed',
      company: 'Session Finished',
      status: 'COMPLETE'
    });

    this.ws.close();
    process.exit(0);
  }

  /**
   * Internal: click Apply, fill modal, send, verify.
   */
  async _applyToJob(cdpEval, jobInfo, appliedJobs, failedJobs, currentPage, jobIndex, targetLabel) {
    const { title, company, description, techStack } = jobInfo;
    log('ACTION', `Applying to "${title}" at "${company}"...`);

    await updateHud(this.ws, {
      page: currentPage,
      appliedCount: appliedJobs.length,
      failedCount: failedJobs.length,
      appliedJobs,
      failedJobs,
      jobTitle: title,
      company,
      status: 'Solving Application'
    });

    try {
      // Click Apply button
      const clickResult = await clickYCApplyButton(this.ws, cdpEval);
      if (!clickResult || !clickResult.clicked) {
        log('WARN', `Could not click Apply button for "${title}". Skipping...`);
        failedJobs.push({ title, company, reason: 'Apply button not found or not clickable' });
        return;
      }

      log('INFO', 'Apply button clicked. Waiting for modal...');
      await sleep(1000);

      // Verify modal opened
      let modalStatus = await getYCModalStatus(this.ws, cdpEval);
      if (!modalStatus || !modalStatus.open) {
        // Retry once
        await clickYCApplyButton(this.ws, cdpEval);
        await sleep(1200);
        modalStatus = await getYCModalStatus(this.ws, cdpEval);
      }

      if (!modalStatus || !modalStatus.open) {
        log('WARN', `Apply modal did not open for "${title}". Skipping...`);
        failedJobs.push({ title, company, reason: 'Apply modal did not open' });
        return;
      }

      log('MODAL', `Modal open: "${modalStatus.headingText}"`);

      // Generate personalized message
      const message = generateYCMessage({ title, company, description, techStack }, this.profile);
      log('MESSAGE', `Generated message (${message.length} chars): ${message.substring(0, 80)}...`);

      // Fill message textarea
      const filled = await fillYCMessageTextarea(this.ws, cdpEval, message);
      if (!filled || !filled.filled) {
        log('WARN', `Could not fill textarea for "${title}". Skipping...`);
        failedJobs.push({ title, company, reason: 'Could not fill message textarea' });
        await dismissYCModal(this.ws, cdpEval);
        return;
      }
      log('FILL', `Filled textarea: ${filled.length} chars`);
      await sleep(300);

      // Handle location checkbox (tick it - open to relocation)
      await handleLocationCheckbox(this.ws, cdpEval);
      await sleep(200);

      // Click Send
      let submitted = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const sendResult = await clickYCSendButton(this.ws, cdpEval);
        if (!sendResult || !sendResult.clicked) {
          log('WARN', `Send button not clicked (attempt ${attempt + 1})...`);
          await sleep(500);
          continue;
        }

        log('SEND', `Clicked Send button (attempt ${attempt + 1})...`);
        await sleep(1500);

        // Check result
        const postStatus = await getYCModalStatus(this.ws, cdpEval);

        // If modal closed → sent
        if (!postStatus || !postStatus.open || postStatus.isSent) {
          submitted = true;
          break;
        }

        // If char count error → extend message and retry
        if (postStatus.errorText && (postStatus.errorText.includes('50') || postStatus.errorText.toLowerCase().includes('character'))) {
          log('RETRY', 'Message too short error. Extending message and retrying...');
          const extendedMsg = message + ' I am confident I can add real value to your team and would love to discuss further. Thank you for your time!';
          await fillYCMessageTextarea(this.ws, cdpEval, extendedMsg);
          await sleep(300);
          continue;
        }

        // If some other error, log and break
        if (postStatus.errorText) {
          log('WARN', `Send error: "${postStatus.errorText}"`);
          break;
        }
      }

      if (submitted) {
        log('SUCCESS', `Application sent to "${company}" for "${title}"!`);
        appliedJobs.push({
          index: jobIndex,
          title,
          company,
          status: 'SENT',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        await updateHud(this.ws, {
          page: currentPage,
          appliedCount: appliedJobs.length,
          failedCount: failedJobs.length,
          appliedJobs,
          failedJobs,
          jobTitle: title,
          company,
          status: 'Applied ✓'
        });
        await sleep(500);
        await dismissYCModal(this.ws, cdpEval);
      } else {
        log('WARN', `Could not confirm submission for "${title}". Marking as failed.`);
        failedJobs.push({ title, company, reason: 'Could not confirm message was sent' });
        await updateHud(this.ws, {
          page: currentPage,
          appliedCount: appliedJobs.length,
          failedCount: failedJobs.length,
          appliedJobs,
          failedJobs,
          jobTitle: title,
          company,
          status: 'Failed'
        });
        await dismissYCModal(this.ws, cdpEval);
      }
    } catch (err) {
      log('ERROR', `Error applying to "${title}": ${err.message}`);
      failedJobs.push({ title, company, reason: err.message });
      try { await dismissYCModal(this.ws, cdpEval); } catch (e) {}
    }
  }
}

module.exports = YCOrchestrator;
