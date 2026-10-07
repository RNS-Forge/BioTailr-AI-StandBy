/**
 * BioTailr AI StandBy - YC (Work at a Startup) Platform Adapter
 * Implements BasePlatform for workatastartup.com job applications.
 *
 * Flow:
 *  1. On listings page: find unvisited "View job" links → click to navigate
 *  2. On job detail page: read title/company/description → click Apply
 *  3. Modal opens: "Reach out to [Recruiter] at [Company]"
 *  4. Fill personalized message → check location checkbox → click Send
 *  5. Verify sent → go back to listings → repeat
 */

const BasePlatform = require('../base-platform');
const { generateYCMessage } = require('./message-generator');
const {
  getYCModalStatus,
  solveYCApplyModal,
  dismissYCModal
} = require('./apply-modal');
const {
  selectNextYCJob,
  inspectYCJob,
  clickYCApplyButton,
  goBackToListings,
  scrollYCFeed,
  goToNextYCPage
} = require('./card-selector');

class YCPlatform extends BasePlatform {
  constructor(ws, cdpEval, profile, helpers = {}) {
    super(ws, cdpEval, profile, helpers);
    this._currentJobInfo = null;
  }

  getName() {
    return 'YC (Work at a Startup)';
  }

  /**
   * Read current job details from the job detail page.
   * If on list page, returns hasEasyApply: false (need to navigate first).
   */
  async inspectCurrentJob() {
    const info = await inspectYCJob(this.ws, this.cdpEval);

    if (!info) {
      return { title: '', company: '', hasEasyApply: false };
    }

    // Store job info for later use in message generation
    this._currentJobInfo = info;

    return {
      title: info.title || 'Startup Role',
      company: info.company || 'YC Company',
      jobId: (info.title + info.company).replace(/\s+/g, '_').toLowerCase(),
      hasEasyApply: info.hasApplyButton,
      isListPage: info.isListPage,
      isJobDetailPage: info.isJobDetailPage,
      description: info.description,
      techStack: info.techStack
    };
  }

  /**
   * Click Apply on the job detail page.
   * This opens the "Reach out to X at Y" modal.
   */
  async clickApplyButton() {
    const result = await clickYCApplyButton(this.ws, this.cdpEval);
    if (result && result.clicked) {
      // Wait for modal to appear
      await new Promise(r => setTimeout(r, 800));
    }
    return Boolean(result && result.clicked);
  }

  /**
   * Get modal status — checks if the apply modal is open.
   */
  async getModalStatus() {
    const status = await getYCModalStatus(this.ws, this.cdpEval);

    if (!status) return { modalOpen: false };

    return {
      modalOpen: status.open,
      isPostSubmit: status.isSent,
      title: status.headingText,
      buttons: [status.hasSendBtn ? 'Send' : '', status.hasCloseBtn ? 'Close' : ''].filter(Boolean),
      recruiterName: status.recruiterName,
      companyName: status.companyName
    };
  }

  /**
   * Solve the current step — for YC this means filling the message textarea.
   * Message is auto-generated based on job title, company, and description.
   */
  async solveCurrentStep(stepNumber, stepStatus) {
    const jobInfo = this._currentJobInfo || {};
    const message = generateYCMessage(
      {
        title: jobInfo.title || stepStatus?.title || '',
        company: jobInfo.company || stepStatus?.companyName || '',
        description: jobInfo.description || '',
        techStack: jobInfo.techStack || ''
      },
      this.profile
    );

    if (this.helpers.log) {
      this.helpers.log('MESSAGE', `Generated personalized message (${message.length} chars) for "${jobInfo.company || 'company'}"`);
    }

    await new Promise(r => setTimeout(r, 200));
    const { fillYCMessageTextarea, handleLocationCheckbox } = require('./apply-modal');
    await fillYCMessageTextarea(this.ws, this.cdpEval, message);
    await new Promise(r => setTimeout(r, 200));
    await handleLocationCheckbox(this.ws, this.cdpEval);
  }

  /**
   * Try to submit the application (click Send button).
   * Returns true if sent successfully.
   */
  async trySubmit() {
    const status = await getYCModalStatus(this.ws, this.cdpEval);
    if (!status || !status.open) return false;
    if (status.isSent) return true;

    const { clickYCSendButton } = require('./apply-modal');
    const result = await clickYCSendButton(this.ws, this.cdpEval);
    if (!result || !result.clicked) return false;

    // Wait for confirmation
    await new Promise(r => setTimeout(r, 1200));

    const postStatus = await getYCModalStatus(this.ws, this.cdpEval);
    return !postStatus || !postStatus.open || Boolean(postStatus.isSent);
  }

  /**
   * YC single-step apply — no "Next" advancement needed.
   * Modal is one-step: fill message → send.
   */
  async tryAdvance() {
    return false; // YC is single-step
  }

  /**
   * Dismiss post-submit dialogs / close the modal after sending.
   */
  async dismissPostSubmit() {
    await dismissYCModal(this.ws, this.cdpEval);
    // After dismissing, go back to the job list
    await new Promise(r => setTimeout(r, 500));
    await goBackToListings(this.ws, this.cdpEval);
    await new Promise(r => setTimeout(r, 2000)); // Wait for page navigation
  }

  /**
   * Select the next unvisited job card from the listings.
   * On list page: clicks "View job" → navigates to detail page.
   * On detail page: reads and returns current job info.
   */
  async selectNextJob(visitedKeys) {
    const currentInfo = await inspectYCJob(this.ws, this.cdpEval);

    // If already on a detail page, go back to listings first
    if (currentInfo && currentInfo.isJobDetailPage) {
      await goBackToListings(this.ws, this.cdpEval);
      await new Promise(r => setTimeout(r, 2000));
    }

    return await selectNextYCJob(this.ws, this.cdpEval, visitedKeys);
  }

  /**
   * Scroll the YC listings feed to load more jobs.
   */
  async scrollFeed() {
    return await scrollYCFeed(this.ws, this.cdpEval);
  }

  /**
   * Go to next page of YC listings.
   */
  async goToNextPage(targetPage) {
    return await goToNextYCPage(this.ws, this.cdpEval, targetPage);
  }

  /**
   * Discard incomplete modal (just close it).
   */
  async discardIncompleteModal() {
    await dismissYCModal(this.ws, this.cdpEval);
    await new Promise(r => setTimeout(r, 300));
    const currentInfo = await inspectYCJob(this.ws, this.cdpEval);
    if (currentInfo && currentInfo.isJobDetailPage) {
      await goBackToListings(this.ws, this.cdpEval);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

module.exports = YCPlatform;
