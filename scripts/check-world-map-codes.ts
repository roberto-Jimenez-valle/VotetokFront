/**
 * Verificar códigos ISO en el mapa mundial para países específicos
 */

import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🔍 Verificando códigos ISO en world.topojson.json...\n');
  
  const worldFile = path.join('static/maps/world.topojson.json');
  
  if (!fs.existsSync(worldFile)) {
    console.log('❌ Archivo no existe');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(worldFile, 'utf8'));
  
  // Buscar ARE (Emiratos Árabes)
  console.log('🔎 Buscando Emiratos Árabes Unidos (ARE):\n');
  
  const areFeatures = data.features.filter((f: any) => {
    const p = f.properties;
    return (
      p.ISO_A3 === 'ARE' || 
      p.ADM0_A3 === 'ARE' ||
      p.SOV_A3 === 'ARE' ||
      p.NAME?.includes('Emirates') ||
      p.NAME?.includes('UAE')
    );
  });
  
  if (areFeatures.length > 0) {
    areFeatures.forEach((f: any, i: number) => {
      console.log(`   Feature ${i + 1}:`);
      console.log(`      NAME: ${f.properties.NAME}`);
      console.log(`      ISO_A3: ${f.properties.ISO_A3}`);
      console.log(`      ADM0_A3: ${f.properties.ADM0_A3}`);
      console.log(`      SOV_A3: ${f.properties.SOV_A3}`);
    });
  } else {
    console.log('   ❌ NO ENCONTRADO en world.topojson.json');
    console.log('   Buscando por otros identificadores...\n');
    
    // Buscar por variantes
    const variants = data.features.filter((f: any) => {
      const p = f.properties;
      const name = (p.NAME || '').toLowerCase();
      return name.includes('arab') || name.includes('emirat') || name.includes('uae');
    });
    
    if (variants.length > 0) {
      console.log('   Posibles coincidencias por nombre:\n');
      variants.forEach((f: any, i: number) => {
        console.log(`   Variante ${i + 1}:`);
        console.log(`      NAME: ${f.properties.NAME}`);
        console.log(`      ISO_A3: ${f.properties.ISO_A3}`);
        console.log(`      ADM0_A3: ${f.properties.ADM0_A3}`);
      });
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🔎 Buscando Groenlandia (GRL):\n');
  
  const grlFeatures = data.features.filter((f: any) => {
    const p = f.properties;
    return (
      p.ISO_A3 === 'GRL' || 
      p.ADM0_A3 === 'GRL' ||
      p.SOV_A3 === 'GRL' ||
      p.NAME?.includes('Greenland') ||
      p.NAME?.includes('Grønland')
    );
  });
  
  if (grlFeatures.length > 0) {
    grlFeatures.forEach((f: any, i: number) => {
      console.log(`   Feature ${i + 1}:`);
      console.log(`      NAME: ${f.properties.NAME}`);
      console.log(`      ISO_A3: ${f.properties.ISO_A3}`);
      console.log(`      ADM0_A3: ${f.properties.ADM0_A3}`);
      console.log(`      SOV_A3: ${f.properties.SOV_A3}`);
    });
  } else {
    console.log('   ❌ NO ENCONTRADO en world.topojson.json');
    console.log('   Buscando por otros identificadores...\n');
    
    // Buscar por variantes
    const variants = data.features.filter((f: any) => {
      const p = f.properties;
      const name = (p.NAME || '').toLowerCase();
      return name.includes('green') || name.includes('grøn');
    });
    
    if (variants.length > 0) {
      console.log('   Posibles coincidencias por nombre:\n');
      variants.forEach((f: any, i: number) => {
        console.log(`   Variante ${i + 1}:`);
        console.log(`      NAME: ${f.properties.NAME}`);
        console.log(`      ISO_A3: ${f.properties.ISO_A3}`);
        console.log(`      ADM0_A3: ${f.properties.ADM0_A3}`);
      });
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('💡 SI NO SE ENCUENTRAN:\n');
  console.log('El archivo world.topojson.json necesita corrección manual');
  console.log('O estos países no están en el mapa mundial actual');
}

main().catch(console.error);
