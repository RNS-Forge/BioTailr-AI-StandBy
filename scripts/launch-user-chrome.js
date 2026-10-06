const { spawn } = require('child_process');

const args = [
  '--remote-debugging-port=9222',
  '--remote-allow-origins=*',
  '--user-data-dir=C:\\Temp\\biotailr-chrome-profile',
  '--load-extension=C:\\Temp Files\\My Projects\\BioTailr.ai\\BioTailr-AI-Extension',
  '--no-first-run',
  '--no-default-browser-check',
  'https://www.linkedin.com/jobs/search/?keywords=full-time%20SQL%20Developer%20or%20Generative%20AI%20Engineer%20or%20Full%20Stack%20Engineer%20or%20Frontend%20Developer%20or%20Artificial%20Intelligence%20Engineer%2C%20on-site%20or%20hybrid%20or%20remote&f_AL=true&geoId=101031506'
];

console.log('Spawning Chrome with copied profile and port 9222...');
const child = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args, {
  detached: true,
  stdio: 'ignore'
});
child.unref();

console.log('Spawned successfully with PID:', child.pid);
