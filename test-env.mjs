// Test rápido para verificar que .env está correcto
import fs from 'fs'

console.log('🔍 Verificando archivo .env...\n')

const envContent = fs.readFileSync('.env', 'utf8')

// Buscar variables importantes
const jwtMatch = envContent.match(/^JWT_SECRET=(.+)$/m)
const appMatch = envContent.match(/^APP_SECRET=(.+)$/m)
const viteAppMatch = envContent.match(/^VITE_APP_SECRET=(.+)$/m)

console.log('📋 Variables encontradas:')
console.log(`JWT_SECRET: ${jwtMatch ? '✅ ' + jwtMatch[1].substring(0, 15) + '... (' + jwtMatch[1].length + ' chars)' : '❌ NO ENCONTRADO'}`)
console.log(`APP_SECRET: ${appMatch ? '✅ ' + appMatch[1].substring(0, 15) + '... (' + appMatch[1].length + ' chars)' : '❌ NO ENCONTRADO'}`)
console.log(`VITE_APP_SECRET: ${viteAppMatch ? '✅ ' + viteAppMatch[1].substring(0, 15) + '... (' + viteAppMatch[1].length + ' chars)' : '❌ NO ENCONTRADO'}`)

// Verificar que APP_SECRET y VITE_APP_SECRET son iguales
if (appMatch && viteAppMatch) {
  if (appMatch[1] === viteAppMatch[1]) {
    console.log('\n✅ APP_SECRET y VITE_APP_SECRET coinciden')
  } else {
    console.log('\n❌ ERROR: APP_SECRET y VITE_APP_SECRET NO coinciden!')
    console.log('   APP_SECRET:', appMatch[1].substring(0, 20) + '...')
    console.log('   VITE_APP_SECRET:', viteAppMatch[1].substring(0, 20) + '...')
  }
}

// Verificar saltos de línea
const hasLineBreaks = /SECRET=.+\n.+/m.test(envContent)
if (hasLineBreaks) {
  console.log('\n⚠️  ADVERTENCIA: Detectados saltos de línea en valores de secrets')
}

console.log('\n✅ Archivo .env parece correcto\n')
