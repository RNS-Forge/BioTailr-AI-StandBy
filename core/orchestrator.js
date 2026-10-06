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
      appliedJobs: [],
      failedJobs: [],
      jobTitle: 'Initializing...',
      company: this.platform.getName(),
      status: 'ACTIVE'
    });

    log('START', `Autonomous continuous apply active. Initiating applications in Chrome...`);

    let jobIndex = 0;
    let currentPage = 1;
    let hasMoreJobs = true;

    while (appliedJobs.length < this.batchTarget && hasMoreJobs) {
      jobIndex++;
      console.log(`\n----------------------------------------------------`);
      const targetLabel = this.batchTarget === Infinity ? 'Unlimited' : String(this.batchTarget);
      log('BATCH', `[Applied: ${appliedJobs.length}/${targetLabel} | Inspected #${jobIndex} | Page ${currentPage}] Inspecting active job card...`);
      console.log(`----------------------------------------------------`);

      await ensureHudInjected(this.ws);

      let jobInfo = await this.platform.inspectCurrentJob();
      if (!jobInfo.hasEasyApply) {
        await sleep(400);
        const retryInfo = await this.platform.inspectCurrentJob();
        if (retryInfo.hasEasyApply) {
          jobInfo = retryInfo;
        }
      }
      log('INFO', `Target Job: "${jobInfo.title || 'Untitled'}" at "${jobInfo.company || 'Company'}"`);
      log('INFO', `Easy Apply Available: ${jobInfo.hasEasyApply}`);

      const currentKey = (jobInfo.title + '::' + jobInfo.company).toLowerCase();
      visitedJobKeys.add(currentKey);
      if (jobInfo.title) {
        visitedJobKeys.add(jobInfo.title.toLowerCase());
        visitedJobKeys.add(jobInfo.title.toLowerCase().replace(/^selected,?\s*/i, ''));
      }
      if (jobInfo.jobId) visitedJobKeys.add(String(jobInfo.jobId));

      await updateHud(this.ws, {
        page: currentPage,
        appliedCount: appliedJobs.length,
        failedCount: failedJobs.length,
        appliedJobs: appliedJobs,
        failedJobs: failedJobs,
        jobTitle: jobInfo.title,
        company: jobInfo.company,
        status: jobInfo.hasEasyApply ? 'Applying' : 'Skipping (No Apply Button)'
      });

      if (!jobInfo.hasEasyApply) {
        log('SKIP', 'Easy Apply button not present on current job card. Recording and moving to next listing...');
        failedJobs.push({
          title: jobInfo.title || 'Untitled Role',
          company: jobInfo.company || 'Unknown Company',
          reason: 'No Easy Apply button (External apply)'
        });

        await updateHud(this.ws, {
          page: currentPage,
          appliedCount: appliedJobs.length,
          failedCount: failedJobs.length,
          appliedJobs: appliedJobs,
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
          const paged = await this.platform.goToNextPage(currentPage + 1);
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
        await sleep(700);

        let preCheck = await this.platform.getModalStatus();
        if (!preCheck || !preCheck.modalOpen) {
          // Re-attempt click once in case of delayed DOM update
          await this.platform.clickApplyButton();
          await sleep(800);
          preCheck = await this.platform.getModalStatus();
        }

        if (!preCheck || !preCheck.modalOpen) {
          log('WARN', `Easy Apply modal did not open for "${jobInfo.title}". Marking as skipped.`);
          failedJobs.push({
            title: jobInfo.title || 'Technical Opportunity',
            company: jobInfo.company || 'Target Company',
            reason: 'Easy Apply modal did not open'
          });
          await updateHud(this.ws, {
            page: currentPage,
            appliedCount: appliedJobs.length,
            failedCount: failedJobs.length,
            appliedJobs: appliedJobs,
            failedJobs: failedJobs,
            jobTitle: jobInfo.title,
            company: jobInfo.company,
            status: 'Skipped - Modal Not Opened'
          });
          continue;
        }

        let stepCount = 0;
        let submitted = false;

        while (stepCount < 30) {
          stepCount++;
          await sleep(250);

          const stepStatus = await this.platform.getModalStatus();

          if (stepStatus && stepStatus.isPostSubmit) {
            log('POST_SUBMIT', 'Post-application confirmation dialog detected. Application submitted!');
            await sleep(400);
            await this.platform.dismissPostSubmit();
            submitted = true;
            break;
          }

          if (!stepStatus || !stepStatus.modalOpen) {
            if (submitted || stepCount > 1) {
              log('MODAL', 'Application modal closed after completion.');
              submitted = true;
            }
            break;
          }

          log('STEP', `Step ${stepCount}: "${stepStatus.title || 'Form'}" | Buttons: [${(stepStatus.buttons || []).join(', ')}]`);

          // Solve inputs, selects, radios, checkboxes, subforms
          await this.platform.solveCurrentStep(stepCount, stepStatus);

          // Try submit
          const submitClicked = await this.platform.trySubmit();
          if (submitClicked) {
            log('SUBMIT', 'Clicked "Submit application"!');
            await sleep(600);
            await this.platform.dismissPostSubmit();
            submitted = true;
            break;
          }

          // Try advance past review/next
          const nextClicked = await this.platform.tryAdvance();
          if (nextClicked) {
            log('NAV', `Advanced past "${nextClicked}" step.`);
            await sleep(350);
          } else {
            await sleep(250);
          }
        }

        if (submitted) {
          log('SUCCESS', `Application to "${jobInfo.title}" successfully submitted!`);
          appliedJobs.push({
            index: jobIndex,
            title: jobInfo.title,
            company: jobInfo.company,
            status: 'SUBMITTED',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          });
        } else {
          log('WARN', `Could not finish submission for "${jobInfo.title}". Discarding draft to free screen...`);
          failedJobs.push({
            title: jobInfo.title || 'Untitled Role',
            company: jobInfo.company || 'Unknown Company',
            reason: 'Incomplete or unsubmitted steps'
          });
          if (this.platform.discardIncompleteModal) {
            await this.platform.discardIncompleteModal();
          }
        }

        await updateHud(this.ws, {
          page: currentPage,
          appliedCount: appliedJobs.length,
          failedCount: failedJobs.length,
          appliedJobs: appliedJobs,
          failedJobs: failedJobs,
          jobTitle: jobInfo.title,
          company: jobInfo.company,
          status: submitted ? 'Applied' : 'Discarded'
        });

        await sleep(400);
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
      if (appliedJobs.length < this.batchTarget) {
        log('TRANSITION', 'Selecting next job card in search feed...');
        await updateHud(this.ws, {
          page: currentPage,
          appliedCount: appliedJobs.length,
          failedCount: failedJobs.length,
          appliedJobs: appliedJobs,
          failedJobs: failedJobs,
          jobTitle: 'Finding next job...',
          company: 'Listings Feed',
          status: 'Scanning Cards'
        });

        await this.platform.dismissPostSubmit();
        let nextJob = await this.platform.selectNextJob(visitedJobKeys);

        if (!nextJob || !nextJob.found) {
          log('FEED', 'End of visible cards on page. Scrolling search feed down to load more...');
          await this.platform.scrollFeed();
          await sleep(1500);
          nextJob = await this.platform.selectNextJob(visitedJobKeys);
        }

        if (!nextJob || !nextJob.found) {
          log('PAGINATION', `Page ${currentPage} completed. Advancing to Page ${currentPage + 1}...`);
          const paged = await this.platform.goToNextPage(currentPage + 1);
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
            appliedJobs: appliedJobs,
            failedJobs: failedJobs,
            jobTitle: nextJob.title,
            company: nextJob.company || 'Selected Job',
            status: 'Target Selected'
          });
          await sleep(800);
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
