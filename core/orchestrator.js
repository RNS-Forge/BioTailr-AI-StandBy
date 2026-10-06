/**
 * BioTailr AI StandBy - Batch Orchestrator
 * Coordinates continuous, multi-page automated applications across platforms.
 * Immediately starts from local execution, injects the StandBy HUD,
 * and maintains real-time counts and failed job listings.
 */

const { log, sleep, cdpEval } = require('./cdp-client');
const { ensureHudInjected, resetHudToStandby, updateHud } = require('./hud-manager');

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

    // Inject StandBy metrics HUD in Chrome
    await ensureHudInjected(this.ws);
    await resetHudToStandby(this.ws);

    const appliedJobs = [];
    const failedJobs = [];
    const visitedJobKeys = new Set();

    await updateHud(this.ws, {
      page: 1,
      appliedCount: 0,
      failedCount: 0,
      failedJobs: [],
      jobTitle: 'Initializing...',
      company: this.platform.getName(),
      status: 'ACTIVE'
    });

    log('START', `Autonomous continuous apply active. Initiating applications in Chrome...`);

    let jobIndex = 0;
    let currentPage = 1;
    let hasMoreJobs = true;

    while (jobIndex < this.batchTarget && hasMoreJobs) {
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
      if (jobInfo.title) visitedJobKeys.add(jobInfo.title.toLowerCase());

      await updateHud(this.ws, {
        page: currentPage,
        appliedCount: appliedJobs.length,
        failedCount: failedJobs.length,
        failedJobs: failedJobs,
        jobTitle: jobInfo.title,
        company: jobInfo.company,
        status: jobInfo.hasEasyApply ? 'Applying' : 'Skipping (No Apply Button)'
      });

      if (!jobInfo.hasEasyApply) {
        log('SKIP', 'Easy Apply button not present on current job card. Recording and moving to next listing...');
        failedJobs.push({
          title: jobInfo.title || 'Untitled Role',
          company: jobInfo.company || 'Unknown Company'
        });

        await updateHud(this.ws, {
          page: currentPage,
          appliedCount: appliedJobs.length,
          failedCount: failedJobs.length,
          failedJobs: failedJobs,
          jobTitle: jobInfo.title,
          company: jobInfo.company,
          status: 'Skipped'
        });

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
            await sleep(3500);
            await ensureHudInjected(this.ws);
          } else {
            hasMoreJobs = false;
          }
        }
        await sleep(1500);
        continue;
      }

      try {
        log('ACTION', `Clicking Apply button for "${jobInfo.title}"...`);

        await updateHud(this.ws, {
          page: currentPage,
          appliedCount: appliedJobs.length,
          failedCount: failedJobs.length,
          failedJobs: failedJobs,
          jobTitle: jobInfo.title,
          company: jobInfo.company,
          status: 'Solving Application'
        });

        await this.platform.clickApplyButton();
        await sleep(1500);

        let stepCount = 0;
        let submitted = false;

        while (stepCount < 40) {
          stepCount++;
          await sleep(400);

          const stepStatus = await this.platform.getModalStatus();

          if (!stepStatus || !stepStatus.modalOpen) {
            log('MODAL', 'Application modal closed. Verifying completion...');
            submitted = true;
            break;
          }

          log('STEP', `Step ${stepCount}: "${stepStatus.title || 'Form'}" | Buttons: [${(stepStatus.buttons || []).join(', ')}]`);

          // Solve inputs, selects, radios, checkboxes, subforms
          await this.platform.solveCurrentStep(stepCount, stepStatus);

          // Try submit
          const submitClicked = await this.platform.trySubmit();
          if (submitClicked) {
            log('SUBMIT', 'Clicked "Submit application"!');

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
        } else {
          log('WARN', `Could not finish submission for "${jobInfo.title}". Discarding draft to free screen...`);
          failedJobs.push({
            title: jobInfo.title || 'Untitled Role',
            company: jobInfo.company || 'Unknown Company'
          });
          if (this.platform.discardIncompleteModal) {
            await this.platform.discardIncompleteModal();
          }
        }

        await updateHud(this.ws, {
          page: currentPage,
          appliedCount: appliedJobs.length,
          failedCount: failedJobs.length,
          failedJobs: failedJobs,
          jobTitle: jobInfo.title,
          company: jobInfo.company,
          status: submitted ? 'Applied' : 'Discarded'
        });

        await sleep(800);
        await this.platform.dismissPostSubmit();
      } catch (err) {
        log('WARN', `Error processing "${jobInfo.title}": ${err.message}. Advancing to next listing...`);
        failedJobs.push({
          title: jobInfo.title || 'Untitled Role',
          company: jobInfo.company || 'Unknown Company'
        });
        if (this.platform.discardIncompleteModal) {
          await this.platform.discardIncompleteModal();
        }
        await this.platform.dismissPostSubmit();
      }

      // Transition to next job card or page
      if (jobIndex < this.batchTarget) {
        log('TRANSITION', 'Selecting next job card in search feed...');
        await updateHud(this.ws, {
          page: currentPage,
          appliedCount: appliedJobs.length,
          failedCount: failedJobs.length,
          failedJobs: failedJobs,
          jobTitle: 'Finding next job...',
          company: 'Listings Feed',
          status: 'Scanning Cards'
        });

        let nextJob = await this.platform.selectNextJob(visitedJobKeys);

        if (!nextJob || !nextJob.found) {
          log('FEED', 'End of visible cards on page. Scrolling search feed down to load more...');
          await this.platform.scrollFeed();
          await sleep(1500);
          nextJob = await this.platform.selectNextJob(visitedJobKeys);
        }

        if (!nextJob || !nextJob.found) {
          log('PAGINATION', `Page ${currentPage} completed. Advancing to Page ${currentPage + 1}...`);
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
          log('TRANSITION', `Targeting: "${nextJob.title}" at "${nextJob.company || 'Company'}"`);
          await updateHud(this.ws, {
            page: currentPage,
            appliedCount: appliedJobs.length,
            failedCount: failedJobs.length,
            failedJobs: failedJobs,
            jobTitle: nextJob.title,
            company: nextJob.company || 'Selected Job',
            status: 'Target Selected'
          });
          await sleep(2000);
        } else {
          log('COMPLETE', 'Reached the end of all search result pages. All Easy Apply jobs processed!');
          hasMoreJobs = false;
        }
      }
    }

    console.log('\n====================================================');
    log('COMPLETE', `Batch session finished: ${appliedJobs.length} applied, ${failedJobs.length} failed/skipped.`);
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
      failedJobs: failedJobs,
      jobTitle: 'All Pages Completed',
      company: 'Session Finished',
      status: 'COMPLETE'
    });

    this.ws.close();
    process.exit(0);
  }
}

module.exports = Orchestrator;
