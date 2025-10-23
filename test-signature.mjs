// Script para probar el sistema de App Signature
import { createHmac } from 'crypto';

const APP_ID = 'votetok-web-v1';
const APP_SECRET = '3c936cdc9c7087bef3e653780cd2209d4c8ec4c873f1c808f5c2e01cd69dc1a3405b4e6ee78e9a2795fe1a36';

function createSignature(method, path, timestamp, body = '') {
  const message = `${method}:${path}:${timestamp}:${body}`;
  return createHmac('sha256', APP_SECRET)
    .update(message)
    .digest('hex');
}

async function testRequest() {
  const method = 'GET';
  const path = '/api/polls/trending-by-region';
  const timestamp = Date.now();
  const signature = createSignature(method, path, timestamp);

  console.log('\n=== Test de App Signature ===');
  console.log('Método:', method);
  console.log('Path:', path);
  console.log('Timestamp:', timestamp);
  console.log('APP_ID:', APP_ID);
  console.log('APP_SECRET:', APP_SECRET.substring(0, 30) + '...');
  console.log('Signature generada:', signature.substring(0, 40) + '...');

  try {
    const response = await fetch(`http://localhost:5173${path}?region=Global&limit=12&hours=168`, {
      method,
      headers: {
        'X-App-ID': APP_ID,
        'X-Timestamp': timestamp.toString(),
        'X-Signature': signature
      }
    });

    console.log('\nRespuesta del servidor:');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Éxito! Datos recibidos:', data.data?.length || 0, 'polls');
    } else {
      const error = await response.json();
      console.log('❌ Error:', error);
    }
  } catch (err) {
    console.error('❌ Error de red:', err.message);
  }

  console.log('================================\n');
}

testRequest();
