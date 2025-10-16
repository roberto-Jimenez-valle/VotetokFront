import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script para calcular coordenadas aproximadas de subdivisiones nivel 3
 * usando el promedio de las provincias hermanas o datos del padre
 */
async function fixLevel3Coords() {
  console.log('\n🔧 Calculando coordenadas para nivel 3...\n');
  
  // Obtener subdivisiones nivel 3 de España sin coordenadas (lat=0, lon=0)
  const level3Subs = await prisma.subdivision.findMany({
    where: {
      level: 3,
      latitude: 0,
      subdivisionId: { startsWith: 'ESP.' }
    }
  });
  
  console.log(`📊 Encontradas ${level3Subs.length} subdivisiones nivel 3 sin coordenadas\n`);
  
  // Coordenadas aproximadas de provincias españolas (centros aproximados)
  const provinceCoords: Record<string, { lat: number; lon: number }> = {
    // Andalucía (ESP.1.X)
    'ESP.1.1': { lat: 36.8381, lon: -2.4597 },   // Almería
    'ESP.1.2': { lat: 36.5271, lon: -6.2886 },   // Cádiz
    'ESP.1.3': { lat: 37.8882, lon: -4.7794 },   // Córdoba
    'ESP.1.4': { lat: 37.1773, lon: -3.5986 },   // Granada
    'ESP.1.5': { lat: 37.2614, lon: -6.9447 },   // Huelva
    'ESP.1.6': { lat: 37.7796, lon: -3.7849 },   // Jaén
    'ESP.1.7': { lat: 36.7213, lon: -4.4214 },   // Málaga
    'ESP.1.8': { lat: 37.3891, lon: -5.9845 },   // Sevilla
    
    // Aragón (ESP.2.X)
    'ESP.2.1': { lat: 41.6561, lon: -0.8773 },   // Zaragoza
    'ESP.2.2': { lat: 40.9602, lon: -1.1189 },   // Teruel
    'ESP.2.3': { lat: 42.1401, lon: -0.4087 },   // Huesca
    
    // Cataluña (ESP.9.X)
    'ESP.9.1': { lat: 41.3851, lon: 2.1734 },    // Barcelona
    'ESP.9.2': { lat: 41.9794, lon: 2.8214 },    // Girona
    'ESP.9.3': { lat: 41.6176, lon: 0.6200 },    // Lleida
    'ESP.9.4': { lat: 41.1189, lon: 1.2445 },    // Tarragona
    
    // Comunidad Valenciana (ESP.10.X)
    'ESP.10.1': { lat: 38.3460, lon: -0.4907 },  // Alicante
    'ESP.10.2': { lat: 39.9864, lon: -0.0513 },  // Castellón
    'ESP.10.3': { lat: 39.4699, lon: -0.3763 },  // Valencia
    
    // Extremadura (ESP.11.X)
    'ESP.11.1': { lat: 38.8794, lon: -6.9706 },  // Badajoz
    'ESP.11.2': { lat: 39.4753, lon: -6.3724 },  // Cáceres
    
    // Galicia (ESP.12.X)
    'ESP.12.1': { lat: 43.3623, lon: -8.4115 },  // A Coruña
    'ESP.12.2': { lat: 43.0097, lon: -7.5567 },  // Lugo
    'ESP.12.3': { lat: 42.3406, lon: -7.8644 },  // Ourense
    'ESP.12.4': { lat: 42.4296, lon: -8.6446 },  // Pontevedra
    
    // Madrid (ESP.13.X) - IMPORTANTE!
    'ESP.13.1': { lat: 40.4168, lon: -3.7038 },  // Madrid
    
    // País Vasco (ESP.16.X)
    'ESP.16.1': { lat: 42.8467, lon: -2.6716 },  // Álava
    'ESP.16.2': { lat: 43.2630, lon: -2.9350 },  // Vizcaya
    'ESP.16.3': { lat: 43.3183, lon: -1.9812 },  // Guipúzcoa
    
    // Castilla y León (ESP.5.X)
    'ESP.5.1': { lat: 42.3440, lon: -3.6967 },   // Burgos
    'ESP.5.2': { lat: 41.6520, lon: -4.7245 },   // Valladolid
    'ESP.5.3': { lat: 40.9651, lon: -5.6640 },   // Salamanca
    'ESP.5.4': { lat: 42.5987, lon: -5.5671 },   // León
    
    // Castilla-La Mancha (ESP.4.X)
    'ESP.4.1': { lat: 39.8628, lon: -4.0273 },   // Toledo
    'ESP.4.2': { lat: 38.9958, lon: -3.9271 },   // Ciudad Real
    'ESP.4.3': { lat: 40.4165, lon: -3.1615 },   // Guadalajara
    'ESP.4.4': { lat: 39.9943, lon: -1.8585 },   // Cuenca
    'ESP.4.5': { lat: 38.9954, lon: -1.8585 },   // Albacete
    
    // Asturias (ESP.3.X)
    'ESP.3.1': { lat: 43.3614, lon: -5.8493 },   // Asturias
  };
  
  let updated = 0;
  
  // Mostrar primeras 10 para debug
  console.log('🔍 Primeras 10 subdivisiones a procesar:');
  level3Subs.slice(0, 10).forEach(s => {
    console.log(`  - ${s.subdivisionId} → ${s.name} (lat: ${s.latitude}, lon: ${s.longitude})`);
  });
  console.log('');
  
  for (const sub of level3Subs) {
    const coords = provinceCoords[sub.subdivisionId];
    
    if (coords) {
      await prisma.subdivision.update({
        where: { id: sub.id },
        data: {
          latitude: coords.lat,
          longitude: coords.lon
        }
      });
      
      console.log(`✅ ${sub.name} (${sub.subdivisionId}): ${coords.lat}, ${coords.lon}`);
      updated++;
    }
  }
  
  console.log(`\n✅ Actualizadas ${updated} subdivisiones nivel 3`);
  await prisma.$disconnect();
}

fixLevel3Coords().catch(console.error);
