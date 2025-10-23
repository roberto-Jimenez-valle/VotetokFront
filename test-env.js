// Script para verificar que las variables de entorno se cargan correctamente
console.log('=== Variables de Entorno Vite ===')
console.log('VITE_APP_ID:', import.meta.env.VITE_APP_ID)
console.log('VITE_APP_SECRET:', import.meta.env.VITE_APP_SECRET ? 'Presente (' + import.meta.env.VITE_APP_SECRET.substring(0, 20) + '...)' : 'NO PRESENTE')
console.log('=================================')
