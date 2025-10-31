import fs from 'fs'
import crypto from 'crypto'

console.log('🔧 Arreglando archivo .env...\n')

// Leer secrets existentes si los hay
let existingEnv = ''
try {
  existingEnv = fs.readFileSync('.env', 'utf8')
} catch (e) {
  console.log('⚠️  No existe .env, creando uno nuevo')
}

// Extraer secrets existentes
const jwtSecretMatch = existingEnv.match(/JWT_SECRET=([a-f0-9]+)/i)
const appSecretMatch = existingEnv.match(/APP_SECRET=([a-f0-9]+)/i)

// Usar secrets existentes o generar nuevos
const jwtSecret = jwtSecretMatch ? jwtSecretMatch[1] : crypto.randomBytes(32).toString('hex')
const appSecret = appSecretMatch ? appSecretMatch[1] : crypto.randomBytes(64).toString('hex')

console.log('✅ Secrets detectados/generados:')
console.log(`   JWT_SECRET: ${jwtSecret.substring(0, 20)}... (${jwtSecret.length} chars)`)
console.log(`   APP_SECRET: ${appSecret.substring(0, 20)}... (${appSecret.length} chars)`)

// Crear archivo .env limpio (TODO EN UNA LÍNEA)
const envContent = `# ============================================
# CONFIGURACIÓN DE SEGURIDAD - VouTop
# ============================================

# JWT Secret (64 caracteres hex)
JWT_SECRET=${jwtSecret}

# App Secret para App Signature (128 caracteres hex)
APP_SECRET=${appSecret}

# ============================================
# FRONTEND (Vite)
# ============================================

# App ID (identificador de la aplicación)
VITE_APP_ID=voutop-web-v1

# App Secret (MISMO valor que APP_SECRET del backend)
VITE_APP_SECRET=${appSecret}

# ============================================
# BASE DE DATOS
# ============================================

DATABASE_URL="file:./prisma/dev.db"

# ============================================
# OPCIONAL: Servicios Externos
# ============================================

# Cloudflare Turnstile (anti-bots)
# VITE_TURNSTILE_SITE_KEY=your-site-key
# TURNSTILE_SECRET_KEY=your-secret-key

# Firebase App Check (seguridad avanzada)
# VITE_FIREBASE_API_KEY=your-api-key
# VITE_FIREBASE_PROJECT_ID=your-project-id
# VITE_FIREBASE_APP_ID=your-app-id
# VITE_RECAPTCHA_SITE_KEY=your-recaptcha-key
# FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
`

// Guardar
fs.writeFileSync('.env', envContent)

console.log('\n✅ Archivo .env regenerado correctamente')
console.log('\n📋 Configuración final:')
console.log(`   JWT_SECRET: ${jwtSecret.substring(0, 15)}...`)
console.log(`   APP_SECRET: ${appSecret.substring(0, 15)}...`)
console.log(`   VITE_APP_ID: voutop-web-v1`)
console.log(`   VITE_APP_SECRET: ${appSecret.substring(0, 15)}...`)
console.log('\n⚠️  IMPORTANTE: Reinicia el servidor con Ctrl+C y luego npm run dev\n')
