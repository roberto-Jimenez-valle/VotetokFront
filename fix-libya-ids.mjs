import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  // 1. Obtener subdivisiones de la base de datos
  const dbSubs = await prisma.subdivision.findMany({
    where: {
      subdivisionId: {
        startsWith: 'LBY.'
      }
    },
    select: {
      subdivisionId: true,
      name: true
    }
  });
  
  console.log(`📊 ${dbSubs.length} subdivisiones en DB`);
  
  // 2. Leer TopoJSON
  const file = 'static/geojson/LBY/LBY.topojson';
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const objects = data.objects || {};
  const firstKey = Object.keys(objects)[0];
  const geometries = objects[firstKey].geometries || [];
  
  console.log(`📦 ${geometries.length} geometrías en TopoJSON`);
  
  // 3. Mapear por nombre (hacer matching)
  let matched = 0;
  let unmatched = 0;
  
  geometries.forEach((geom, index) => {
    const topoName = geom.properties.NAME_1 || geom.properties.shapeName || '';
    
    // Buscar en DB por nombre (normalizado)
    const dbMatch = dbSubs.find(sub => 
      sub.name.toLowerCase().replace(/[^a-z]/g, '') === 
      topoName.toLowerCase().replace(/[^a-z]/g, '')
    );
    
    if (dbMatch) {
      const oldId = geom.properties.ID_1;
      geom.properties.ID_1 = dbMatch.subdivisionId;
      console.log(`  ✅ ${oldId} → ${dbMatch.subdivisionId} (${topoName})`);
      matched++;
    } else {
      console.warn(`  ⚠️ No match para: ${topoName} (ID: ${geom.properties.ID_1})`);
      unmatched++;
    }
  });
  
  console.log(`\n✅ Matched: ${matched}`);
  console.log(`⚠️ Unmatched: ${unmatched}`);
  
  // 4. Guardar TopoJSON actualizado
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n💾 Archivo guardado: ${file}`);
  
  // 5. Verificar
  const verification = JSON.parse(fs.readFileSync(file, 'utf8'));
  const verifyGeom = verification.objects[firstKey].geometries[0];
  console.log('\n🔍 Verificación - Primera geometría:');
  console.log('  ID_1:', verifyGeom.properties.ID_1);
  console.log('  NAME_1:', verifyGeom.properties.NAME_1);
  
} finally {
  await prisma.$disconnect();
}
