import fs from 'fs'

const jwtSecret = "84549e29caccddafc192bca90fa2e653c9d78c16afe1fa968a86e369215194f7"
const appSecret = "3c936cdc9c7087bef3e653780cd2209d4c8ec4c873f1c808f5c2e01cd69dc1a3405b4e8f35c50728c250d8bf28300cc5293ee54b05d76b1ee78e9a2795fe1a36"

// Leer .env
let content = fs.readFileSync('.env', 'utf8')

// Reemplazar secrets
content = content.replace(/JWT_SECRET=.*/g, `JWT_SECRET=${jwtSecret}`)
content = content.replace(/APP_SECRET=.*/g, `APP_SECRET=${appSecret}`)
content = content.replace(/VITE_APP_SECRET=.*/g, `VITE_APP_SECRET=${appSecret}`)

// Guardar
fs.writeFileSync('.env', content)

console.log('\n✅ Archivo .env actualizado con los secrets\n')
console.log('📋 Configuración aplicada:')
console.log(`  JWT_SECRET: ${jwtSecret.substring(0, 20)}...`)
console.log(`  APP_SECRET: ${appSecret.substring(0, 20)}...`)
console.log('  VITE_APP_ID: voutop-web-v1')
console.log(`  VITE_APP_SECRET: ${appSecret.substring(0, 20)}...\n`)
