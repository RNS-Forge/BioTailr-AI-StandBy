const { spawn } = require('child_process');
const http = require('http');

const args = [
  '--remote-debugging-port=9222',
  '--remote-allow-origins=*',
  '--user-data-dir=C:\\Users\\6point3_FA0018\\.gemini\\antigravity-browser-profile',
  '--load-extension=C:\\Temp Files\\My Projects\\BioTailr.ai\\BioTailr-AI-Extension',
  '--no-first-run',
  '--no-default-browser-check',
  'https://www.linkedin.com/jobs/search/?keywords=full-time%20SQL%20Developer%20or%20Generative%20AI%20Engineer%20or%20Full%20Stack%20Engineer%20or%20Frontend%20Developer%20or%20Artificial%20Intelligence%20Engineer%2C%20on-site%20or%20hybrid%20or%20remote&f_AL=true&geoId=101031506'
];

console.log('Spawning and holding Chrome with antigravity-browser-profile...');
const child = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args, {
  stdio: 'inherit'
});

child.on('exit', (code, sig) => {
  console.log('Chrome exited with code:', code, sig);
  process.exit(code || 0);
});

setInterval(() => {
  http.get('http://127.0.0.1:9222/json/version', () => {}).on('error', () => {});
}, 5000);

console.log('Chrome holder daemon initialized, PID:', child.pid);
