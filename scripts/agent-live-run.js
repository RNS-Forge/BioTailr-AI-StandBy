const http = require('http');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tabs = JSON.parse(data);
    const li = tabs.find(t => t.url && t.url.includes('linkedin.com/jobs'));
    const ws = new WebSocket(li.webSocketDebuggerUrl);
    ws.onopen = () => {
      console.log('Running agent on active Beghou modal...');
      // Execute the agent in page context
      const code = `(async () => {
        const modal = document.querySelector('dialog, [role="dialog"], .jobs-easy-apply-modal, .artdeco-modal');
        if (!modal) return { error: 'No modal found' };

        const logs = [];
        const logger = (msg) => { console.log(msg); logs.push(msg); };

        const orchestrator = new window.AutoApplyOrchestrator();
        const linkedinPlatform = orchestrator.platforms.linkedin;

        const candidateContext = {
          personal: {
            firstName: 'Sanjay',
            lastName: 'N',
            fullName: 'Sanjay N',
            email: '2005sanjaynrs@gmail.com',
            phone: '9361599018',
            city: 'Coimbatore',
            country: 'India',
            linkedinUrl: 'https://www.linkedin.com/in/sanjay--n',
            githubUrl: 'https://github.com/RNS-Forge',
            portfolioUrl: 'https://rns-forge.github.io/RNS_Professional_Profile/'
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
            currentCompany: 'Axodian',
            expectedSalary: '1200000',
            currentSalary: '800000'
          },
          education: {
            degree: "Bachelor's Degree",
            fieldOfStudy: 'Computer Science and Engineering',
            institution: 'Anna University / SNS College of Technology',
            gradYear: '2026'
          }
        };

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
