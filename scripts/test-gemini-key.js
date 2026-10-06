const key = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';
async function testModel(model) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Hello, reply with JSON: {"status": "ok"}' }] }]
      })
    });
    console.log(model, res.status, res.statusText);
    if (res.ok) {
      const data = await res.json();
      console.log('Success:', data.candidates?.[0]?.content?.parts?.[0]?.text);
    } else {
      const err = await res.text();
      console.log('Error details:', err.slice(0, 200));
    }
  } catch(e) {
    console.log(model, 'exception:', e.message);
  }
}
async function run() {
  await testModel('gemini-1.5-flash');
  await testModel('gemini-1.5-flash-latest');
  await testModel('gemini-2.0-flash');
  await testModel('gemini-2.0-flash-exp');
  await testModel('gemini-2.5-flash');
}
run();
