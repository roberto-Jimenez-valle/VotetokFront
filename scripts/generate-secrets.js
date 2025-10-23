// Script para generar secrets seguros para Railway
import { randomBytes } from 'crypto';

console.log('\n🔐 Secrets Generados para Railway:\n');
console.log('════════════════════════════════════════════════════════════════');

const jwtSecret = randomBytes(32).toString('hex');
const appSecret = randomBytes(64).toString('hex');

console.log('\nCopia estos valores en Railway → Variables:');
console.log('\n1. JWT_SECRET:');
console.log(jwtSecret);
console.log('\n2. APP_SECRET:');
console.log(appSecret);
console.log('\n3. VITE_APP_SECRET (mismo que APP_SECRET):');
console.log(appSecret);

console.log('\n════════════════════════════════════════════════════════════════');
console.log('\n✅ También necesitas configurar en Railway:\n');
console.log('DATABASE_URL=postgresql://... (auto-generada por Railway si agregaste PostgreSQL)');
console.log('NODE_ENV=production');
console.log('PORT=3000');
console.log('\n');
