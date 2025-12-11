import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Corrigiendo nombres de países...\n');
  
  const geojsonDir = path.join(process.cwd(), 'static', 'geojson');
  const countries = fs.readdirSync(geojsonDir);
  
  let fixed = 0;
  
  for (const countryIso3 of countries) {
    const countryPath = path.join(geojsonDir, countryIso3);
    if (!fs.statSync(countryPath).isDirectory()) continue;
    
    const countryFile = path.join(countryPath, `${countryIso3}.topojson`);
    if (!fs.existsSync(countryFile)) continue;
    
    try {
      const data = JSON.parse(fs.readFileSync(countryFile, 'utf-8'));
      const objectName = Object.keys(data.objects)[0];
      const topoFeature = data.objects[objectName];
      
      let countryName = countryIso3;
      if (topoFeature?.geometries?.[0]?.properties) {
        const props = topoFeature.geometries[0].properties;
        countryName = props.CountryNew || props.country || props.COUNTRY || props.name_0 || props.NAME_0 || countryIso3;
      }
      
      // Solo actualizar si el nombre es diferente del ISO
      if (countryName !== countryIso3) {
        await prisma.subdivision.upsert({
          where: { subdivisionId: countryIso3 },
          update: { name: countryName },
          create: { subdivisionId: countryIso3, name: countryName, level: 1, latitude: 0, longitude: 0 }
        });
        console.log(`  ✅ ${countryIso3} → ${countryName}`);
        fixed++;
      }
    } catch (e) {
      // Silenciar errores
    }
  }
  
  console.log(`\n🎉 Corregidos ${fixed} países`);
  
  // Verificar España y Japón
  const check = await prisma.subdivision.findMany({
    where: { subdivisionId: { in: ['ESP', 'JPN', 'USA', 'GBR', 'FRA', 'DEU'] } },
    select: { subdivisionId: true, name: true }
  });
  console.log('\n=== Verificación ===');
  check.forEach(c => console.log(`${c.subdivisionId}: ${c.name}`));
  
  await prisma.$disconnect();
}

main();
