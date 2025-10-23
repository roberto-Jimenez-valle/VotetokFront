import crypto from 'crypto'

console.log('\n🔑 Generando secrets aleatorios...\n')

const jwtSecret = crypto.randomBytes(32).toString('hex')
const appSecret = crypto.randomBytes(64).toString('hex')

console.log('Copia estas líneas a tu archivo .env:\n')
console.log('# ============================================')
console.log('# SECRETS DE SEGURIDAD')
console.log('# ============================================')
console.log(`JWT_SECRET=${jwtSecret}`)
console.log(`APP_SECRET=${appSecret}`)
console.log('')
console.log('# Frontend (Vite) - Mismo APP_SECRET que arriba')
console.log('VITE_APP_ID=votetok-web-v1')
console.log(`VITE_APP_SECRET=${appSecret}`)
console.log('\n⚠️  IMPORTANTE: Guarda estos secrets de forma segura')
console.log('⚠️  No los compartas ni los subas a Git\n')
