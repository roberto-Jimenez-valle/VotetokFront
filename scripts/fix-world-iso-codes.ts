/**
 * Script para corregir códigos ISO en el archivo mundial
 */

import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🔧 Corrigiendo códigos ISO en archivo mundial...\n');

  const worldFile = path.join(process.cwd(), 'static/maps/world.topojson.json');
  const worldData = JSON.parse(fs.readFileSync(worldFile, 'utf8'));
  
  let fixedCount = 0;
  
  // Mapeo de correcciones necesarias
  const fixes: Record<string, { from: string, to: string, name: string }> = {
    'FRA': { from: '-99', to: 'FRA', name: 'France' },
    'NOR': { from: '-99', to: 'NOR', name: 'Norway' },
    'CYP': { from: 'CYN', to: 'CYP', name: 'N. Cyprus' },
    'XKO': { from: 'KOS', to: 'XKO', name: 'Kosovo' },
    'SLB': { from: 'SOL', to: 'SLB', name: 'Solomon Islands' }
  };
  
  console.log('Correcciones a aplicar:');
  Object.entries(fixes).forEach(([iso, fix]) => {
    console.log(`  ${fix.name}: ${fix.from} → ${iso}`);
  });
  console.log('');
  
  // Procesar cada feature
  for (const feature of worldData.features) {
    const p = feature.properties;
    
    // Buscar por ADM0_A3 o nombre
    for (const [correctISO, fix] of Object.entries(fixes)) {
      const matchByCode = p.ADM0_A3 === correctISO || p.SOV_A3?.startsWith(correctISO.substring(0, 2));
      const matchByName = p.NAME?.includes(fix.name) || p.ADMIN?.includes(fix.name);
      
      if (matchByCode || matchByName) {
        // Corregir ISO_A3
        if (p.ISO_A3 === fix.from || p.ISO_A3 === '-99') {
          console.log(`✅ Corrigiendo ${p.NAME || fix.name}: ISO_A3 = "${p.ISO_A3}" → "${correctISO}"`);
          p.ISO_A3 = correctISO;
          fixedCount++;
        }
      }
    }
  }
  
  // Guardar archivo corregido
  const backupFile = worldFile.replace('.json', '.backup.json');
  fs.writeFileSync(backupFile, JSON.stringify(worldData, null, 2));
  console.log(`\n💾 Backup guardado: ${path.basename(backupFile)}`);
  
  fs.writeFileSync(worldFile, JSON.stringify(worldData));
  console.log(`✅ Archivo corregido: ${path.basename(worldFile)}`);
  
  console.log(`\n📊 Total de correcciones aplicadas: ${fixedCount}`);
  
  // Verificar correcciones
  console.log('\n🔍 Verificando correcciones...\n');
  
  const verifyData = JSON.parse(fs.readFileSync(worldFile, 'utf8'));
  
  for (const [iso, fix] of Object.entries(fixes)) {
    const feature = verifyData.features.find((f: any) => {
      const p = f.properties;
      return p.ADM0_A3 === iso || p.NAME?.includes(fix.name) || p.ADMIN?.includes(fix.name);
    });
    
    if (feature && feature.properties.ISO_A3 === iso) {
      console.log(`✅ ${fix.name}: ISO_A3 = "${feature.properties.ISO_A3}" ✓`);
    } else if (feature) {
      console.log(`⚠️  ${fix.name}: ISO_A3 = "${feature.properties.ISO_A3}" (esperaba "${iso}")`);
    } else {
      console.log(`❌ ${fix.name}: NO encontrado`);
    }
  }
  
  console.log('\n✨ Listo! Refresca la página para ver los cambios.');
}

main().catch(console.error);
