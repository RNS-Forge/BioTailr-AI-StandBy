const { spawn } = require('child_process');
const http = require('http');

async function testPort(port, dataDir) {
  return new Promise((resolve) => {
    console.log(`Testing port ${port} with dataDir ${dataDir}...`);
    const child = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
      `--remote-debugging-port=${port}`,
      '--remote-allow-origins=*',
      `--user-data-dir=${dataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank'
    ]);

    setTimeout(() => {
      http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
        let d = '';
        res.on('data', chunk => d += chunk);
        res.on('end', () => {
          console.log(`Port ${port} SUCCESS:`, d);
          child.kill();
          resolve(true);
        });
      }).on('error', (err) => {
        console.log(`Port ${port} FAILED:`, err.message);
        child.kill();
        resolve(false);
      });
    }, 2500);
  });
}

async function run() {
  await testPort(9222, 'C:\\Temp\\chrome-debug-profile');
  await testPort(9333, 'C:\\Temp\\chrome-debug-profile-2');
}

run();
