const { spawn } = require('child_process');

const extPath = 'C:\\Temp Files\\My Projects\\BioTailr.ai\\BioTailr-AI-Extension';
const targetUrl = 'https://www.linkedin.com/jobs/search/?currentJobId=4462607537&keywords=full-time%20SQL%20Developer%20or%20Generative%20AI%20Engineer%20or%20Full%20Stack%20Engineer%20or%20Frontend%20Developer%20or%20Artificial%20Intelligence%20Engineer%2C%20on-site%20or%20hybrid%20or%20remote&origin=PREFERENCES_LANDING&geoId=101031506&f_AL=true';

const args = [
  '--remote-debugging-port=9222',
  '--remote-allow-origins=*',
  `--load-extension=${extPath}`,
  targetUrl
];

console.log('Spawning Chrome with args:', args);
const child = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args, {
  detached: true,
  stdio: 'ignore'
});
child.unref();
console.log('Spawned Chrome with PID:', child.pid);
