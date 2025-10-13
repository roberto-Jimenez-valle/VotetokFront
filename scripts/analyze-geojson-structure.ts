/**
 * Analiza la estructura de todos los archivos GeoJSON/TopoJSON
 * para entender las propiedades disponibles y crear mejores tablas maestras
 */

import fs from 'fs';
import path from 'path';

interface PropertyAnalysis {
  country: string;
  fileCount: number;
  sampleProperties: any;
  allPropertyKeys: Set<string>;
}

async function analyzeGeoJsonStructure() {
  console.log('🔍 Analizando estructura de archivos GeoJSON/TopoJSON...\n');

  const geojsonDir = path.join(process.cwd(), 'static', 'geojson');
  const countries = fs.readdirSync(geojsonDir).filter(f => 
    fs.statSync(path.join(geojsonDir, f)).isDirectory()
  );

  const analysis: Record<string, PropertyAnalysis> = {};
  const globalPropertyKeys = new Set<string>();

  // Analizar primeros 10 países para obtener muestra representativa
  const samplesToAnalyze = ['ESP', 'USA', 'FRA', 'DEU', 'ITA', 'GBR', 'MEX', 'BRA', 'ARG', 'JPN'];
  
  console.log('📊 Analizando países de muestra...\n');

  for (const countryIso3 of samplesToAnalyze) {
    if (!countries.includes(countryIso3)) continue;

    const countryPath = path.join(geojsonDir, countryIso3);
    const files = fs.readdirSync(countryPath).filter(f => f.endsWith('.topojson'));

    if (files.length === 0) continue;

    console.log(`📍 ${countryIso3}: ${files.length} archivos`);

    const propertyKeys = new Set<string>();
    let sampleProps: any = null;

    for (const file of files) {
      try {
        const filePath = path.join(countryPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // Obtener el primer objeto
        const objectName = Object.keys(data.objects)[0];
        const topoFeature = data.objects[objectName];

        if (topoFeature && topoFeature.properties) {
          const props = topoFeature.properties;
          
          // Guardar primera muestra
          if (!sampleProps) {
            sampleProps = props;
          }

          // Recoger todas las claves
          Object.keys(props).forEach(key => {
            propertyKeys.add(key);
            globalPropertyKeys.add(key);
          });
        }
      } catch (error) {
        // Ignorar errores en archivos individuales
      }
    }

    analysis[countryIso3] = {
      country: countryIso3,
      fileCount: files.length,
      sampleProperties: sampleProps,
      allPropertyKeys: propertyKeys
    };

    // Mostrar propiedades de muestra
    if (sampleProps) {
      console.log(`  📋 Propiedades disponibles: ${Array.from(propertyKeys).join(', ')}`);
      console.log(`  🔑 Ejemplo de valores:`);
      Object.entries(sampleProps).forEach(([key, value]) => {
        const displayValue = typeof value === 'string' && value.length > 50 
          ? value.substring(0, 50) + '...' 
          : value;
        console.log(`     - ${key}: ${displayValue}`);
      });
      console.log();
    }
  }

  // Resumen global
  console.log('\n' + '═'.repeat(80));
  console.log('📊 RESUMEN GLOBAL');
  console.log('═'.repeat(80));
  console.log(`\n✅ Total de propiedades únicas encontradas: ${globalPropertyKeys.size}\n`);
  console.log('🔑 Propiedades globales:');
  Array.from(globalPropertyKeys).sort().forEach(key => {
    console.log(`   - ${key}`);
  });

  // Propiedades comunes importantes
  console.log('\n💡 Propiedades clave para tabla maestra:');
  const keyProperties = [
    'ID_0',      // ID del país
    'ISO',       // Código ISO del país
    'NAME_0',    // Nombre del país
    'ID_1',      // ID de nivel 1 (estado/comunidad)
    'NAME_1',    // Nombre de nivel 1
    'ID_2',      // ID de nivel 2 (provincia/condado)
    'NAME_2',    // Nombre de nivel 2
    'ID_3',      // ID de nivel 3 (municipio)
    'NAME_3',    // Nombre de nivel 3
    'TYPE_1',    // Tipo de subdivisión nivel 1
    'TYPE_2',    // Tipo de subdivisión nivel 2
    'ENGTYPE_1', // Tipo en inglés nivel 1
    'ENGTYPE_2', // Tipo en inglés nivel 2
    'NL_NAME_1', // Nombre local nivel 1
    'NL_NAME_2', // Nombre local nivel 2
    'VARNAME_1', // Variante de nombre nivel 1
    'VARNAME_2', // Variante de nombre nivel 2
  ];

  keyProperties.forEach(prop => {
    const hasIt = globalPropertyKeys.has(prop);
    console.log(`   ${hasIt ? '✅' : '❌'} ${prop}`);
  });

  // Guardar análisis en JSON
  const outputPath = path.join(process.cwd(), 'scripts', 'geojson-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    totalCountriesAnalyzed: Object.keys(analysis).length,
    globalProperties: Array.from(globalPropertyKeys).sort(),
    countryAnalysis: analysis
  }, null, 2));

  console.log(`\n💾 Análisis guardado en: ${outputPath}`);

  // Sugerencia de estructura de tabla
  console.log('\n' + '═'.repeat(80));
  console.log('💡 ESTRUCTURA SUGERIDA PARA TABLA MAESTRA');
  console.log('═'.repeat(80));
  console.log(`
model Subdivision {
  id              Int      @id @default(autoincrement())
  
  // Identificación jerárquica
  countryId       Int                                    // ID_0
  countryIso3     String                                 // ISO
  countryName     String                                 // NAME_0
  
  subdivisionId   String   @unique                       // Formato: ESP.1 o ESP.1.2
  level           Int                                    // 1, 2, 3
  parentId        String?                                // ID del padre
  
  // Nombres
  name            String                                 // NAME_1, NAME_2, NAME_3
  nameLatin       String?                                // Nombre en alfabeto latino
  nameLocal       String?                                // NL_NAME_1, NL_NAME_2
  nameVariant     String?                                // VARNAME_1, VARNAME_2
  nameEnglish     String?                                // ENGNAME_1, ENGNAME_2
  
  // Tipo de subdivisión
  type            String?                                // TYPE_1, TYPE_2 (ej: "Comunidad Autónoma", "State")
  typeEnglish     String?                                // ENGTYPE_1, ENGTYPE_2
  
  // Geolocalización
  latitude        Float
  longitude       Float
  
  // Metadata
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([countryIso3])
  @@index([level])
  @@index([parentId])
  @@index([latitude, longitude])
}
`);

  console.log('\n✅ Análisis completado');
}

analyzeGeoJsonStructure();
