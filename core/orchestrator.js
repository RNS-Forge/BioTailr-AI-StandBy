/**
 * BioTailr AI StandBy - Batch Orchestrator
 * Coordinates continuous, multi-page automated applications across platforms.
 * Interacts with HUD controls, stream logger, and platform adapters.
 */

const { log, sleep } = require('./cdp-client');
const { ensureHudInjected, updateHud, appendHudLog, isHudStarted, isHudPaused } = require('./hud-manager');

class Orchestrator {
  constructor(ws, platform, profile) {
    this.ws = ws;
    this.platform = platform;
    this.profile = profile;
    this.batchTarget = (profile.settings?.batchTarget === 0 || profile.settings?.batchTarget === 'unlimited')
      ? Infinity
      : (profile.settings?.batchTarget || Infinity);
  }

  async run() {
    console.log('====================================================');
    console.log(`   BioTailr AI StandBy - ${this.platform.getName()} Engine`);
    console.log('====================================================');
    log('INIT', `Starting autonomous auto-apply orchestrator...`);

    await ensureHudInjected(this.ws);
    await updateHud(this.ws, {
      page: 1,
      appliedCount: 0,
      jobTitle: 'Ready in StandBy',
      company: this.platform.getName(),
      status: 'StandBy - Click Start'
    });

    await appendHudLog(this.ws, 'INIT', `Attached to ${this.platform.getName()} active feed.`);
    await appendHudLog(this.ws, 'STANDBY', 'StandBy container is draggable. Click "START AUTO APPLY" to begin.');

    log('STANDBY', 'StandBy HUD active in Chrome (Draggable). Awaiting user click on "START AUTO APPLY"...');

    // Wait until the user clicks "START AUTO APPLY" in the on-screen StandBy HUD
    while (!(await isHudStarted(this.ws))) {
      await sleep(400);
    }

    log('START', 'User initiated Auto-Apply from StandBy HUD! Starting batch loop...');
    await appendHudLog(this.ws, 'START', 'Autonomous continuous application session started.');

    const appliedJobs = [];
    const visitedJobKeys = new Set();

    let jobIndex = 0;
    let currentPage = 1;
    let hasMoreJobs = true;

    while (jobIndex < this.batchTarget && hasMoreJobs) {
      // 1. Check for Pause state from on-screen HUD
      while (await isHudPaused(this.ws)) {
        log('PAUSE', 'Automation paused from StandBy HUD. Waiting for user to click RESUME...');
        await sleep(1000);
      }

      jobIndex++;
      console.log(`\n----------------------------------------------------`);
      const targetLabel = this.batchTarget === Infinity ? 'Unlimited' : String(this.batchTarget);
      log('BATCH', `[Job #${jobIndex} | Page ${currentPage} | Target: ${targetLabel}] Inspecting active job card...`);
      console.log(`----------------------------------------------------`);

      await ensureHudInjected(this.ws);

      const jobInfo = await this.platform.inspectCurrentJob();
      log('INFO', `Target Job: "${jobInfo.title || 'Untitled'}" at "${jobInfo.company || 'Company'}"`);
      log('INFO', `Easy Apply Available: ${jobInfo.hasEasyApply}`);

      const currentKey = (jobInfo.title + '::' + jobInfo.company).toLowerCase();
      visitedJobKeys.add(currentKey);

      await updateHud(this.ws, {
        page: currentPage,
        appliedCount: appliedJobs.length,
        jobTitle: jobInfo.title,
        company: jobInfo.company,
        status: jobInfo.hasEasyApply ? 'Applying' : 'Skipping (No Apply Button)'
      });

      if (!jobInfo.hasEasyApply) {
        log('SKIP', 'Easy Apply button not present on current job card. Moving to next card in search feed...');
        await appendHudLog(this.ws, 'SKIP', `No Easy Apply on "${jobInfo.title}" - advancing.`);

        let nextJob = await this.platform.selectNextJob(visitedJobKeys);
        if (!nextJob || !nextJob.found) {
          await this.platform.scrollFeed();
          await sleep(1500);
          nextJob = await this.platform.selectNextJob(visitedJobKeys);
        }
        if (!nextJob || !nextJob.found) {
          const paged = await this.platform.goToNextPage();
          if (paged.success) {
            currentPage++;
            log('PAGINATION', `Advanced to Search Results Page ${currentPage}. Loading fresh jobs...`);
            await appendHudLog(this.ws, 'PAGE', `Advanced to Page ${currentPage}. Loading fresh jobs...`);
            await sleep(3500);
            await ensureHudInjected(this.ws);
          } else {
            hasMoreJobs = false;
          }
        }
        await sleep(1500);
        continue;
      }

      log('ACTION', `Clicking Apply button for "${jobInfo.title}"...`);
      await appendHudLog(this.ws, 'APPLY', `Opening application for "${jobInfo.title}" at "${jobInfo.company}".`);

      await updateHud(this.ws, {
        page: currentPage,
        appliedCount: appliedJobs.length,
        jobTitle: jobInfo.title,
        company: jobInfo.company,
        status: 'Opening Form'
      });

      await this.platform.clickApplyButton();
      await sleep(1500);

      let stepCount = 0;
      let submitted = false;

      while (stepCount < 60) {
        while (await isHudPaused(this.ws)) {
          await sleep(1000);
        }

        stepCount++;
        await sleep(400);

        const stepStatus = await this.platform.getModalStatus();

        if (!stepStatus || !stepStatus.modalOpen) {
          log('MODAL', 'Application modal closed. Verifying completion...');
          submitted = true;
          break;
        }

        log('STEP', `Step ${stepCount}: "${stepStatus.title || 'Form'}" | Buttons: [${(stepStatus.buttons || []).join(', ')}]`);
        await updateHud(this.ws, {
          page: currentPage,
          appliedCount: appliedJobs.length,
          jobTitle: jobInfo.title,
          company: jobInfo.company,
          status: `Solving Step ${stepCount}`
        });

        await appendHudLog(this.ws, 'STEP', `Step ${stepCount}: ${stepStatus.title || 'Form Verification'}`);

        // Solve inputs, selects, radios, checkboxes, subforms
        await this.platform.solveCurrentStep(stepCount, stepStatus);

        // Try submit
        const submitClicked = await this.platform.trySubmit();
        if (submitClicked) {
          log('SUBMIT', 'Clicked "Submit application"!');
          await appendHudLog(this.ws, 'SUBMIT', `Submitted application to "${jobInfo.title}"!`);

          await updateHud(this.ws, {
            page: currentPage,
            appliedCount: appliedJobs.length + 1,
            jobTitle: jobInfo.title,
            company: jobInfo.company,
            status: 'Submitted!'
          });

          await sleep(1500);
          await this.platform.dismissPostSubmit();
          submitted = true;
          break;
        }

        // Try advance past review/next
        const nextClicked = await this.platform.tryAdvance();
        if (nextClicked) {
          log('NAV', `Advanced past "${nextClicked}" step.`);
          await sleep(600);
        } else {
          await sleep(400);
        }
      }

      if (submitted) {
        log('SUCCESS', `Application to "${jobInfo.title}" successfully submitted!`);
        appliedJobs.push({
          index: jobIndex,
          title: jobInfo.title,
          company: jobInfo.company,
          status: 'SUBMITTED'
        });
      }

      await sleep(800);
      await this.platform.dismissPostSubmit();

      // Transition to next job card or page
      if (jobIndex < this.batchTarget) {
        log('TRANSITION', 'Selecting next job card in search feed...');
        await updateHud(this.ws, {
          page: currentPage,
          appliedCount: appliedJobs.length,
          jobTitle: 'Finding next job...',
          company: 'Listings Feed',
          status: 'Scanning Cards'
        });

        let nextJob = await this.platform.selectNextJob(visitedJobKeys);

        if (!nextJob || !nextJob.found) {
          log('FEED', 'End of visible cards on page. Scrolling search feed down to load more...');
          await appendHudLog(this.ws, 'SCROLL', 'Scrolling feed down to reveal more jobs...');
          await this.platform.scrollFeed();
          await sleep(1500);
          nextJob = await this.platform.selectNextJob(visitedJobKeys);
        }

        if (!nextJob || !nextJob.found) {
          log('PAGINATION', `Page ${currentPage} completed. Checking for next search page...`);
          await updateHud(this.ws, {
            page: currentPage,
            appliedCount: appliedJobs.length,
            jobTitle: `Advancing to Page ${currentPage + 1}...`,
            company: 'Search Pagination',
            status: 'Advancing Page'
          });

          await appendHudLog(this.ws, 'PAGE', `Completed Page ${currentPage}. Advancing to Page ${currentPage + 1}...`);

          const paged = await this.platform.goToNextPage();
          if (paged.success) {
            currentPage++;
            log('PAGINATION', `Advanced to Search Results Page ${currentPage}. Loading fresh jobs...`);
            await sleep(3500);
            await ensureHudInjected(this.ws);

            nextJob = await this.platform.selectNextJob(visitedJobKeys);
            if (!nextJob || !nextJob.found) {
              await this.platform.scrollFeed();
              await sleep(1500);
              nextJob = await this.platform.selectNextJob(visitedJobKeys);
            }
          }
        }

        if (nextJob && nextJob.found) {
          log('TRANSITION', `Targeting: "${nextJob.title}"`);
          await appendHudLog(this.ws, 'CARD', `Selected listing: "${nextJob.title}"`);
          await updateHud(this.ws, {
            page: currentPage,
            appliedCount: appliedJobs.length,
            jobTitle: nextJob.title,
            company: nextJob.company || 'Selected Job',
            status: 'Target Selected'
          });
          await sleep(2000);
        } else {
          log('COMPLETE', 'Reached the end of all search result pages. All Easy Apply jobs applied!');
          await appendHudLog(this.ws, 'COMPLETE', 'Reached the end of all search result pages.');
          hasMoreJobs = false;
        }
      }
    }

    console.log('\n====================================================');
    log('COMPLETE', `Batch session finished: ${appliedJobs.length} jobs applied!`);
    console.log('====================================================');
    console.table(appliedJobs);

    await updateHud(this.ws, {
      page: currentPage,
      appliedCount: appliedJobs.length,
      jobTitle: 'All Pages Completed',
      company: 'Session Finished',
      status: 'COMPLETE'
    });

    await appendHudLog(this.ws, 'COMPLETE', `Session finished! Total ${appliedJobs.length} jobs applied.`);
    this.ws.close();
    process.exit(0);
  }
}

module.exports = Orchestrator;
