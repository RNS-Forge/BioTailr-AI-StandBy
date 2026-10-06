const { spawn } = require('child_process');
const http = require('http');

async function testDefaultProfile() {
  const dataDir = 'C:\\Users\\6point3_FA0018\\AppData\\Local\\Google\\Chrome\\User Data';
  console.log('Testing with default user data dir...');
  const child = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    `--user-data-dir=${dataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  setTimeout(() => {
    http.get('http://127.0.0.1:9222/json/version', (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        console.log('Default profile SUCCESS:', d);
        child.kill();
      });
    }).on('error', (err) => {
      console.log('Default profile FAILED:', err.message);
      child.kill();
    });
  }, 3000);
}

testDefaultProfile();
