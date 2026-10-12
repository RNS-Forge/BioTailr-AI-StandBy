const http = require('http');
const fs = require('fs');
const path = require('path');

let candidateContext = {};
try {
  const profilePath = path.resolve(__dirname, '../candidate-profile.json');
  candidateContext = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
} catch (e) {
  candidateContext = {
    personal: {
      firstName: 'Candidate',
      lastName: '',
      fullName: 'Candidate',
      email: 'candidate@example.com',
      phone: '9876543210',
      city: 'Bangalore',
      country: 'India',
      linkedinUrl: 'https://www.linkedin.com/in/candidate',
      githubUrl: 'https://github.com/candidate',
      portfolioUrl: 'https://candidate.portfolio.dev'
    },
    workAuth: {
      authorizedInCountry: 'Yes',
      needSponsorship: 'No',
      currentVisaStatus: 'Citizen'
    },
    experience: {
      totalYears: 2,
      noticePeriodDays: 15,
      currentTitle: 'Software Development Engineer',
      currentCompany: 'Technology Company',
      expectedSalary: '1000000',
      currentSalary: '600000'
    },
    education: {
      degree: "Bachelor's Degree",
      fieldOfStudy: 'Computer Science and Engineering',
      institution: 'University / Institute of Technology',
      gradYear: '2024'
    }
  };
}

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tabs = JSON.parse(data);
    const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
    const ws = new WebSocket(li.webSocketDebuggerUrl);
    ws.onopen = () => {
      console.log('Running agent on active modal...');
      // Execute the agent in page context
      const code = `(async () => {
        const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
        if (!modal) return { error: 'No modal found' };

        const logs = [];
        const logger = (msg) => { console.log(msg); logs.push(msg); };

        const orchestrator = new window.AutoApplyOrchestrator();
        const linkedinPlatform = orchestrator.platforms.linkedin;

        const candidateContext = ${JSON.stringify(candidateContext)};

        const result = await linkedinPlatform.executeFastApply(candidateContext, null, logger);
        return { result, logs };
      })()`;
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: code, awaitPromise: true, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.id === 1) {
        console.log('Agent Execution Result:', JSON.stringify(parsed.result.result.value, null, 2));
        ws.close();
      }
    };
  });
});
