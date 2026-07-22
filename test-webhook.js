const fetch = require('node-fetch');

async function testWebhook() {
  const url = 'https://vfsenzzuoisgcvppfbbz.supabase.co/functions/v1/mp-webhook?seller_id=123&is_platform=true';
  const payload = {
    type: 'payment',
    data: {
      id: 'test_payment_123'
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (e) {
    console.error(e);
  }
}

testWebhook();
