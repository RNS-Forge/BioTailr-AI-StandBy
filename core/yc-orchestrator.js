/**
 * BioTailr AI StandBy - YC (Work at a Startup) Orchestrator
 * Handles the real YC apply flow:
 *
 *  1. On listing page → find next unvisited "Apply" button on a card
 *  2. Click it → a NEW TAB opens with the job detail page
 *  3. Connect CDP to the new tab
 *  4. On new tab → read title/company/description → click Apply again
 *  5. "Reach out to X at Y" modal opens → fill personalized message → Send
 *  6. Verify sent → close the new tab via CDP
 *  7. Back on listing tab → continue to next card
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
  findNextYCCard,
  clickApplyOnCard,
  waitForNewTab,
  getAllTabs,
  closeTab,
  inspectJobDetailPage,
  clickApplyOnDetailPage,
  scrollYCFeed
} = require('../platforms/yc/card-selector');

class YCOrchestrator {
  constructor(ws, profile, cdpPort = 9222) {
    this.ws = ws;             // WebSocket to the LISTING TAB
    this.profile = profile;
    this.cdpPort = cdpPort;
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
    const visitedKeys = new Set();

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

    log('START', 'YC continuous apply active. Scanning job cards...');

    let jobIndex = 0;
    let scrollCount = 0;
    const MAX_SCROLLS = 20;

    while (appliedJobs.length < this.batchTarget) {
      jobIndex++;
      console.log('\n----------------------------------------------------');
      const targetLabel = this.batchTarget === Infinity ? 'Unlimited' : String(this.batchTarget);
      log('BATCH', `[Applied: ${appliedJobs.length}/${targetLabel} | Card #${jobIndex}] Scanning listing cards...`);

      await ensureHudInjected(this.ws);

      // Step 1: Find next unvisited Apply button on listing page
      const card = await findNextYCCard(this.ws, cdpEval, visitedKeys);

      if (!card || !card.found) {
        if (scrollCount >= MAX_SCROLLS) {
          log('COMPLETE', 'Scrolled to bottom of all listings. Session complete.');
          break;
        }
        scrollCount++;
        log('FEED', `No more unvisited cards visible. Scrolling (${scrollCount}/${MAX_SCROLLS})...`);
        await scrollYCFeed(this.ws, cdpEval);
        await sleep(2000);
        continue;
      }

      scrollCount = 0; // Reset scroll counter when we find jobs

      // Mark as visited immediately
      const cardKey = (card.title + '::' + card.company).toLowerCase();
      visitedKeys.add(cardKey);
      visitedKeys.add(card.title.toLowerCase());

      log('INFO', `Found job: "${card.title}" at "${card.company}" (card #${card.cardIndex})`);

      await updateHud(this.ws, {
        page: 1,
        appliedCount: appliedJobs.length,
        failedCount: failedJobs.length,
        appliedJobs,
        failedJobs,
        jobTitle: card.title,
        company: card.company,
        status: 'Opening Job Tab'
      });

      // Step 2: Snapshot current tabs, then click Apply
      let tabsBefore;
      try {
        tabsBefore = await getAllTabs(this.cdpPort);
      } catch (e) {
        log('WARN', `Could not get tab list: ${e.message}. Skipping...`);
        failedJobs.push({ title: card.title, company: card.company, reason: 'Could not enumerate tabs' });
        continue;
      }
      const knownTabIds = new Set(tabsBefore.map(t => t.id));

      log('ACTION', `Clicking Apply on "${card.title}"...`);
      await clickApplyOnCard(this.ws, card.x, card.y);

      // Step 3: Wait for the new tab to open
      log('WAIT', 'Waiting for new tab to open...');
      const newTab = await waitForNewTab(this.cdpPort, knownTabIds, 6000);

      if (!newTab) {
        log('WARN', `New tab did not open for "${card.title}". Skipping...`);
        failedJobs.push({ title: card.title, company: card.company, reason: 'New tab did not open after Apply click' });
        continue;
      }

      log('TAB', `New tab opened: "${newTab.title}" (${newTab.url})`);

      // Step 4: Connect to the new tab
      let newTabWs;
      try {
        newTabWs = await connectWebSocket(newTab.webSocketDebuggerUrl);
        log('CONNECTED', `Connected to new tab CDP`);
      } catch (e) {
        log('WARN', `Could not connect to new tab: ${e.message}`);
        failedJobs.push({ title: card.title, company: card.company, reason: `New tab WebSocket connect failed: ${e.message}` });
        try { await closeTab(this.cdpPort, newTab.id); } catch (_) {}
        continue;
      }

      // Step 5: Wait for the job detail page to fully load
      await sleep(2000);

      try {
        // Read job details from the new tab
        const jobDetail = await inspectJobDetailPage(newTabWs, cdpEval);
        const title = jobDetail?.title || card.title;
        const company = jobDetail?.company || card.company;
        const description = jobDetail?.description || card.cardText || '';
        const techStack = jobDetail?.techStack || '';

        log('INFO', `Job detail: "${title}" at "${company}" | Has Apply: ${jobDetail?.hasApplyButton}`);

        await updateHud(this.ws, {
          page: 1,
          appliedCount: appliedJobs.length,
          failedCount: failedJobs.length,
          appliedJobs,
          failedJobs,
          jobTitle: title,
          company,
          status: 'Solving Application'
        });

        // Step 6: Click Apply on the detail page (opens the modal)
        if (jobDetail && jobDetail.hasApplyButton) {
          await clickApplyOnDetailPage(newTabWs, cdpEval);
          log('INFO', 'Clicked Apply on detail page. Waiting for modal...');
          await sleep(1200);
        } else {
          // Modal might already be visible if Apply was enough on listing
          log('INFO', 'No second Apply button found — checking if modal is already open...');
          await sleep(800);
        }

        // Step 7: Check modal is open
        let modalStatus = await getYCModalStatus(newTabWs, cdpEval);

        if (!modalStatus || !modalStatus.open) {
          // Try clicking Apply one more time
          await clickApplyOnDetailPage(newTabWs, cdpEval);
          await sleep(1200);
          modalStatus = await getYCModalStatus(newTabWs, cdpEval);
        }

        if (!modalStatus || !modalStatus.open) {
          log('WARN', `Apply modal did not open for "${title}". Closing tab and skipping...`);
          failedJobs.push({ title, company, reason: 'Apply modal did not open on detail page' });
          newTabWs.close();
          await closeTab(this.cdpPort, newTab.id);
          await sleep(500);
          continue;
        }

        log('MODAL', `Modal open: "${modalStatus.headingText}" | Recruiter: ${modalStatus.recruiterName}`);

        // Step 8: Generate personalized message
        const message = generateYCMessage({ title, company, description, techStack }, this.profile);
        log('MESSAGE', `Generated ${message.length}-char message: "${message.substring(0, 70)}..."`);

        // Step 9: Fill the message textarea
        const filled = await fillYCMessageTextarea(newTabWs, cdpEval, message);
        if (!filled || !filled.filled) {
          log('WARN', `Could not fill textarea for "${title}". Closing tab...`);
          failedJobs.push({ title, company, reason: 'Could not fill message textarea' });
          newTabWs.close();
          await closeTab(this.cdpPort, newTab.id);
          await sleep(500);
          continue;
        }
        log('FILL', `Textarea filled: ${filled.length} characters`);
        await sleep(300);

        // Step 10: Tick location/relocation checkbox
        await handleLocationCheckbox(newTabWs, cdpEval);
        await sleep(200);

        // Step 11: Click Send — with retry logic
        let submitted = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const sendResult = await clickYCSendButton(newTabWs, cdpEval);
          if (!sendResult || !sendResult.clicked) {
            log('WARN', `Send button not found (attempt ${attempt}/3)...`);
            await sleep(600);
            continue;
          }

          log('SEND', `Clicked Send (attempt ${attempt}/3)...`);
          await sleep(1500);

          const postStatus = await getYCModalStatus(newTabWs, cdpEval);

          // Success: modal closed or shows confirmation
          if (!postStatus || !postStatus.open || postStatus.isSent) {
            submitted = true;
            break;
          }

          // Error: message too short — extend and retry
          if (postStatus.errorText) {
            log('RETRY', `Error "${postStatus.errorText.substring(0, 60)}". Extending message...`);
            const extMsg = message + ' I am highly motivated to contribute to ' + company + ' and would love the opportunity to connect. Thank you for your consideration!';
            await fillYCMessageTextarea(newTabWs, cdpEval, extMsg);
            await sleep(300);
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
            page: 1,
            appliedCount: appliedJobs.length,
            failedCount: failedJobs.length,
            appliedJobs,
            failedJobs,
            jobTitle: title,
            company,
            status: 'Applied'
          });
        } else {
          log('WARN', `Could not confirm submission for "${title}".`);
          failedJobs.push({ title, company, reason: 'Message could not be sent (modal stayed open)' });
          await updateHud(this.ws, {
            page: 1,
            appliedCount: appliedJobs.length,
            failedCount: failedJobs.length,
            appliedJobs,
            failedJobs,
            jobTitle: title,
            company,
            status: 'Failed'
          });
        }

      } catch (err) {
        log('ERROR', `Error processing "${card.title}": ${err.message}`);
        failedJobs.push({ title: card.title, company: card.company, reason: err.message });
      }

      // Step 12: Close the new tab and return to listing tab
      try {
        newTabWs.close();
      } catch (_) {}

      log('CLOSE', `Closing new tab: ${newTab.id}`);
      await closeTab(this.cdpPort, newTab.id);
      await sleep(800);

      // Bring listing tab back into focus by refreshing HUD
      await ensureHudInjected(this.ws);
      log('LISTING', 'Returned to listing page. Continuing...');
      await sleep(400);
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
      jobTitle: 'All YC Listings Processed',
      company: 'Session Finished',
      status: 'COMPLETE'
    });

    this.ws.close();
    process.exit(0);
  }
}

module.exports = YCOrchestrator;
