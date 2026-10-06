/**
 * BioTailr AI StandBy - Base Platform Interface
 * Defines the standard contract that all job platform adapters (LinkedIn, Indeed, etc.) implement.
 */

class BasePlatform {
  constructor(ws, cdpEval, profile, helpers = {}) {
    this.ws = ws;
    this.cdpEval = cdpEval;
    this.profile = profile;
    this.helpers = helpers;
  }

  /**
   * Platform display name (e.g. 'LinkedIn', 'Indeed')
   */
  getName() {
    throw new Error('Platform.getName() must be implemented.');
  }

  /**
   * Inspect current top/active job card details in right pane or modal
   */
  async inspectCurrentJob() {
    throw new Error('Platform.inspectCurrentJob() must be implemented.');
  }

  /**
   * Click the primary Easy Apply / Apply button
   */
  async clickApplyButton() {
    throw new Error('Platform.clickApplyButton() must be implemented.');
  }

  /**
   * Inspect whether the application modal is open
   */
  async getModalStatus() {
    throw new Error('Platform.getModalStatus() must be implemented.');
  }

  /**
   * Solve current step inputs, selects, dropdowns, subforms, and pruning
   */
  async solveCurrentStep(stepNumber) {
    throw new Error('Platform.solveCurrentStep() must be implemented.');
  }

  /**
   * Try to click Submit application button
   */
  async trySubmit() {
    throw new Error('Platform.trySubmit() must be implemented.');
  }

  /**
   * Try to advance to Next / Review step
   */
  async tryAdvance() {
    throw new Error('Platform.tryAdvance() must be implemented.');
  }

  /**
   * Dismiss post-submission confirmation or review dialogs
   */
  async dismissPostSubmit() {
    throw new Error('Platform.dismissPostSubmit() must be implemented.');
  }

  /**
   * Select next unvisited job card in the listings feed
   */
  async selectNextJob(visitedKeys) {
    throw new Error('Platform.selectNextJob() must be implemented.');
  }

  /**
   * Scroll the job listings feed container to trigger virtualization load
   */
  async scrollFeed() {
    throw new Error('Platform.scrollFeed() must be implemented.');
  }

  /**
   * Advance to the next search results page (e.g. Page 1 -> 2 -> 3)
   */
  async goToNextPage() {
    throw new Error('Platform.goToNextPage() must be implemented.');
  }
}

module.exports = BasePlatform;
