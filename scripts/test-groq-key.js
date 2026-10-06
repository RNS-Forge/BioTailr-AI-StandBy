const groqKey = process.env.GROQ_API_KEY || 'YOUR_GROQ_API_KEY';
async function testGroq() {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Say hello' }]
      })
    });
    console.log('Groq status:', res.status, res.statusText);
    const txt = await res.text();
    console.log('Groq response:', txt.slice(0, 300));
  } catch(e) {
    console.error('Groq error:', e);
  }
}
testGroq();
