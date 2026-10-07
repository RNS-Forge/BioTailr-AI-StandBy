/**
 * BioTailr AI StandBy - YC (Work at a Startup) Orchestrator
 *
 * Flow:
 *  1. Listing tab (workatastartup.com/companies?... or /jobs) remains open.
 *  2. Scan listing page for next unvisited job card / link.
 *  3. Open job in a NEW TAB via CDP endpoint (keeps listing page intact).
 *  4. On the new tab (detail page):
 *     - Inspect job info (title, company, description, tech stack).
 *     - If already applied -> skip and close tab.
 *     - Click orange "Apply" button -> popup modal opens.
 *  5. In the opened popup modal ("Reach out to X at Y"):
 *     - Click textarea input box area to focus.
 *     - Generate personalized, human-crafted message for Sanjay N.
 *     - Paste/insert message (satisfies 50-char minimum & React state).
 *     - Check location acknowledgement checkbox if present.
 *     - Click "Send" button.
 *     - Verify message sent.
 *  6. Close the new tab via CDP.
 *  7. Return to listing tab -> update HUD -> continue to next job!
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
  openJobInNewTab,
  closeTab,
  inspectJobDetailPage,
  clickApplyOnDetailPage,
  scrollYCFeed
} = require('../platforms/yc/card-selector');

class YCOrchestrator {
  constructor(ws, profile, cdpPort = 9222) {
    this.ws = ws;
    this.profile = profile;
    this.cdpPort = cdpPort;
    this.listingUrl = '';
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

    this.listingUrl = await cdpEval(this.ws, `window.location.href`);
    log('LISTING', `Active listing page: ${this.listingUrl}`);

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

    log('START', 'YC continuous apply active. Scanning jobs from listing...');

    let jobIndex = 0;
    let scrollCount = 0;
    const MAX_SCROLLS = 35;

    while (appliedJobs.length < this.batchTarget) {
      jobIndex++;
      console.log('\n----------------------------------------------------');
      const targetLabel = this.batchTarget === Infinity ? 'Unlimited' : String(this.batchTarget);
      log('BATCH', `[Applied: ${appliedJobs.length}/${targetLabel} | Job #${jobIndex}] Scanning listing page...`);

      // 1. Find next unvisited job on listing page
      const nextJob = await findNextYCJobLink(this.ws, cdpEval, visitedJobIds);

      if (!nextJob || !nextJob.found) {
        if (scrollCount >= MAX_SCROLLS) {
          log('COMPLETE', 'Scrolled through all visible listings. Session complete.');
          break;
        }
        scrollCount++;
        log('FEED', `No more unvisited jobs visible in current viewport. Scrolling (${scrollCount}/${MAX_SCROLLS})...`);
        await scrollYCFeed(this.ws, cdpEval);
        await sleep(2000);
        continue;
      }

      scrollCount = 0;

      // Mark as visited immediately
      visitedJobIds.add(nextJob.jobId);
      visitedJobIds.add(nextJob.href);
      if (nextJob.title) visitedJobIds.add(nextJob.title.toLowerCase());

      log('JOB', `Found job #${nextJob.jobId}: "${nextJob.title}" at "${nextJob.company}"`);
      log('LINK', `${nextJob.href}`);

      await updateHud(this.ws, {
        page: 1,
        appliedCount: appliedJobs.length,
        failedCount: failedJobs.length,
        appliedJobs,
        failedJobs,
        jobTitle: nextJob.title,
        company: nextJob.company,
        status: 'Opening New Tab'
      });

      // 2. Open the job in a NEW TAB via CDP
      log('TAB', `Opening job in new tab: ${nextJob.href}`);
      let newTabInfo = null;
      try {
        newTabInfo = await openJobInNewTab(this.cdpPort, nextJob.href);
      } catch (err) {
        log('ERROR', `Failed to open new tab: ${err.message}`);
        failedJobs.push({ title: nextJob.title, company: nextJob.company, reason: `Failed to open tab: ${err.message}` });
        continue;
      }

      if (!newTabInfo || !newTabInfo.id || !newTabInfo.webSocketDebuggerUrl) {
        log('WARN', `Could not get new tab debugger URL. Skipping...`);
        failedJobs.push({ title: nextJob.title, company: nextJob.company, reason: 'Tab creation returned no debugger URL' });
        continue;
      }

      // Connect to the new tab
      let newWs = null;
      try {
        newWs = await connectWebSocket(newTabInfo.webSocketDebuggerUrl);
      } catch (err) {
        log('WARN', `Could not connect to new tab WebSocket: ${err.message}`);
        failedJobs.push({ title: nextJob.title, company: nextJob.company, reason: `WS connect failed: ${err.message}` });
        try { await closeTab(this.cdpPort, newTabInfo.id); } catch (_) {}
        continue;
      }

      // Wait for job detail page to load
      await sleep(3000);

      try {
        // 3. Inspect job detail page
        const jobDetail = await inspectJobDetailPage(newWs, cdpEval);
        const title = jobDetail?.title || nextJob.title;
        const company = jobDetail?.company || nextJob.company;
        const description = jobDetail?.description || nextJob.cardSnippet || '';
        const techStack = jobDetail?.techStack || '';

        log('INFO', `Detail page: "${title}" at "${company}"`);

        // Check if already applied
        if (jobDetail?.isAlreadyApplied) {
          log('INFO', `Already applied to "${title}" at "${company}". Skipping.`);
          failedJobs.push({ title, company, reason: 'Already applied' });
          continue;
        }

        if (!jobDetail?.hasApplyButton) {
          log('WARN', `No Apply button found for "${title}". Skipping.`);
          failedJobs.push({ title, company, reason: 'No Apply button found' });
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

        // 4. Click the orange Apply button
        log('ACTION', `Clicking Apply button for "${title}"...`);
        const applyRes = await clickApplyOnDetailPage(newWs, cdpEval);
        log('INFO', `Apply click result: ${JSON.stringify(applyRes)}`);
        await sleep(1800);

        // 5. Check if popup modal opened
        let modalStatus = await getYCModalStatus(newWs, cdpEval);
        if (!modalStatus || !modalStatus.open) {
          log('RETRY', `Modal not open yet — retrying click Apply...`);
          await clickApplyOnDetailPage(newWs, cdpEval);
          await sleep(1800);
          modalStatus = await getYCModalStatus(newWs, cdpEval);
        }

        if (!modalStatus || !modalStatus.open) {
          log('WARN', `Popup modal did not open for "${title}". Skipping.`);
          failedJobs.push({ title, company, reason: 'Popup modal failed to open' });
          continue;
        }

        log('MODAL', `Popup modal opened: "${modalStatus.headingText || 'Reach out'}"`);

        // 6. Generate attractive, human-crafted message for Sanjay N
        const message = generateYCMessage({ title, company, description, techStack }, this.profile);
        log('MESSAGE', `Generated message (${message.length} chars) from Sanjay N:\n"${message.substring(0, 100)}..."`);

        await updateHud(this.ws, {
          page: 1,
          appliedCount: appliedJobs.length,
          failedCount: failedJobs.length,
          appliedJobs,
          failedJobs,
          jobTitle: title,
          company,
          status: 'Pasting Message'
        });

        // 7. Click input box area and paste message
        log('PASTE', `Clicking input box area and pasting generated text...`);
        const fillRes = await fillYCMessageTextarea(newWs, cdpEval, message);

        if (!fillRes || !fillRes.filled) {
          log('WARN', `Textarea fill validation failed (${fillRes?.length || 0} chars). Retrying with direct setter...`);
          await cdpEval(newWs, `(() => {
            const ta = document.querySelector('textarea');
            if (ta) {
              ta.value = ${JSON.stringify(message)};
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              ta.dispatchEvent(new Event('change', { bubbles: true }));
            }
          })()`);
          await sleep(300);
        } else {
          log('SUCCESS', `Message pasted successfully (${fillRes.length} chars)!`);
        }

        await sleep(400);

        // 8. Handle any location/acknowledgement checkbox
        await handleLocationCheckbox(newWs, cdpEval);
        await sleep(300);

        // 9. Click Send button
        await updateHud(this.ws, {
          page: 1,
          appliedCount: appliedJobs.length,
          failedCount: failedJobs.length,
          appliedJobs,
          failedJobs,
          jobTitle: title,
          company,
          status: 'Sending Application'
        });

        log('ACTION', `Clicking Send button...`);
        let sent = false;

        for (let attempt = 1; attempt <= 3; attempt++) {
          const sendRes = await clickYCSendButton(newWs, cdpEval);
          log('SEND', `Send button clicked (attempt ${attempt}/3): ${JSON.stringify(sendRes)}`);
          await sleep(2000);

          const postStatus = await getYCModalStatus(newWs, cdpEval);
          if (!postStatus || !postStatus.open || postStatus.isSent) {
            sent = true;
            break;
          }

          if (postStatus.errorText) {
            log('WARN', `Modal reported: "${postStatus.errorText}". Retrying fill...`);
            const extMsg = message + ` I am deeply passionate about ${company}'s domain and mission. Looking forward to connecting!`;
            await fillYCMessageTextarea(newWs, cdpEval, extMsg);
            await sleep(500);
          }
        }

        if (sent) {
          log('SUCCESS', `🎉 Application successfully sent to "${company}" for "${title}"!`);
          appliedJobs.push({
            index: jobIndex,
            title,
            company,
            status: 'SENT',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          });
        } else {
          log('WARN', `Could not confirm modal closed/sent for "${title}".`);
          failedJobs.push({ title, company, reason: 'Modal did not confirm send' });
        }

      } catch (err) {
        log('ERROR', `Error processing job tab: ${err.message}`);
        failedJobs.push({ title: nextJob.title, company: nextJob.company, reason: err.message });
      } finally {
        // 10. Close the opened new tab via CDP HTTP
        log('TAB', `Closing tab for job #${nextJob.jobId}...`);
        try { newWs.close(); } catch (_) {}
        await sleep(300);
        try { await closeTab(this.cdpPort, newTabInfo.id); } catch (_) {}
        await sleep(600);
      }

      // 11. Back on listing tab: update HUD
      await updateHud(this.ws, {
        page: 1,
        appliedCount: appliedJobs.length,
        failedCount: failedJobs.length,
        appliedJobs,
        failedJobs,
        jobTitle: 'Ready for next job',
        company: 'Work at a Startup',
        status: 'Scanning Next Job'
      });

      log('LISTING', `Back on listing page. Total applied so far: ${appliedJobs.length}`);
      await sleep(1000);
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
}

module.exports = YCOrchestrator;
