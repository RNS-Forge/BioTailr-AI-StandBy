/**
 * BioTailr AI StandBy - Naukri Auto-Apply Runner
 *
 * Usage:
 *   1. Open Chrome with debugging:
 *      chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\ChromeDebug"
 *   2. Navigate to: https://www.naukri.com/jobs-in-india (or any Naukri job search URL)
 *   3. Run: node naukri-runner.js
 *
 * The runner will:
 *  - Auto-detect the naukri.com tab
 *  - Iterate through all job cards on the search results page
 *  - Click each card -> click Apply button
 *  - Solve chatbot / modal questions (CTC, notice period, experience, location)
 *  - Submit application -> move to next job
 *  - Track applied/failed in HUD overlay
 *  - Repeat across pages until all jobs processed (unlimited by default)
 */

const fs = require('fs');
const path = require('path');
const { log, sleep, getTargetTab, connectWebSocket, cdpEval } = require('./core/cdp-client');
const PlatformFactory = require('./platforms/platform-factory');
const Orchestrator = require('./core/orchestrator');

// Load Candidate Profile Configuration
let profile = {
  personal: {
    fullName: 'Sanjay N',
    firstName: 'Sanjay',
    lastName: 'N',
    email: '2005sanjaynrs@gmail.com',
    phone: '+91 9361599018',
    city: 'Coimbatore, Tamil Nadu, India',
    linkedinUrl: 'https://www.linkedin.com/in/sanjay--n',
    githubUrl: 'https://github.com/RNS-Forge',
    portfolioUrl: 'https://rns-forge.github.io/RNS_Professional_Profile/'
  },
  workAuth: {
    authorizedInCountry: 'Yes',
    needSponsorship: 'No'
  },
  experience: {
    totalYears: 1,
    noticePeriodDays: 15,
    currentTitle: 'Full Stack & AI Engineer',
    currentCompany: 'Axodian',
    currentSalary: '200000',
    expectedSalary: '450000',
    currentSalaryLpa: '2',
    expectedSalaryLpa: '4.5'
  },
  education: {
    degree: 'Bachelor of Technology - BTech',
    fieldOfStudy: 'Computer Science and Engineering',
    institution: 'Anna University / SNS College of Technology',
    gradYear: '2026'
  },
  settings: {
    batchTarget: 0, // 0 = unlimited continuous apply
    cdpPort: 9222
  }
};

try {
  const profilePath = path.join(__dirname, 'candidate-profile.json');
  if (fs.existsSync(profilePath)) {
    const raw = fs.readFileSync(profilePath, 'utf8');
    const loaded = JSON.parse(raw);
    // Deep merge
    profile = {
      ...profile,
      ...loaded,
      personal: { ...profile.personal, ...loaded.personal },
      experience: { ...profile.experience, ...loaded.experience },
      education: { ...profile.education, ...loaded.education },
      settings: { ...profile.settings, ...loaded.settings }
    };
  }
} catch (e) {
  log('WARN', 'Could not parse candidate-profile.json, using defaults.');
}

const cdpPort = profile.settings?.cdpPort || 9222;

async function main() {
  log('INIT', `BioTailr AI StandBy - Naukri Engine`);
  log('INIT', `Connecting to Chrome DevTools Protocol at 127.0.0.1:${cdpPort}...`);

  const activeTab = await getTargetTab(cdpPort, [
    'naukri.com'
  ]);
  log('CONNECTED', `Attached to tab: "${activeTab.title}" (${activeTab.url})`);

  const ws = await connectWebSocket(activeTab.webSocketDebuggerUrl);

  const platform = PlatformFactory.createPlatform(activeTab.url, ws, cdpEval, profile, { sleep, log });
  log('PLATFORM', `Active Platform Adapter: [${platform.getName()}]`);

  const orchestrator = new Orchestrator(ws, platform, profile);
  await orchestrator.run();
}

main().catch(err => {
  log('ERROR', err.message);
  process.exit(1);
});
