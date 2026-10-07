/**
 * BioTailr AI StandBy - YC (Work at a Startup) Auto-Apply Runner
 *
 * Usage:
 *   1. Open Chrome with debugging:
 *      chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\ChromeDebug"
 *   2. Navigate to: https://www.workatastartup.com/companies?...
 *   3. Run: node yc-runner.js
 *
 * The runner will:
 *  - Auto-detect the workatastartup.com tab
 *  - Iterate through all job listings
 *  - Click each "View job" → navigate to detail page
 *  - Click "Apply" → generate personalized message → fill → Send
 *  - Track applied/failed in HUD overlay
 *  - Repeat until all jobs processed (unlimited by default)
 */

const fs = require('fs');
const path = require('path');
const { log, sleep, getTargetTab, connectWebSocket, cdpEval } = require('./core/cdp-client');
const YCOrchestrator = require('./core/yc-orchestrator');

// Load candidate profile
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
    batchTarget: 0, // 0 = unlimited
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
  log('INIT', `BioTailr AI StandBy - YC Runner`);
  log('INIT', `Connecting to Chrome DevTools Protocol at 127.0.0.1:${cdpPort}...`);

  const activeTab = await getTargetTab(cdpPort, [
    'workatastartup.com',
    'ycombinator.com/jobs'
  ]);
  log('CONNECTED', `Attached to tab: "${activeTab.title}" (${activeTab.url})`);

  const ws = await connectWebSocket(activeTab.webSocketDebuggerUrl);

  const orchestrator = new YCOrchestrator(ws, profile, cdpPort);
  await orchestrator.run();
}

main().catch(err => {
  log('ERROR', err.message);
  console.error(err.stack);
  process.exit(1);
});
