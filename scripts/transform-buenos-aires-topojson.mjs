import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leer el archivo original
const inputPath = path.join(__dirname, '..', 'static', 'geojson', 'ARG', 'ARG.5.topojson');
const outputPath = inputPath; // Sobrescribir el mismo archivo

console.log('📖 Leyendo archivo:', inputPath);
const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

// Mapa de IDs originales a número de comuna
const idToComunaMap = {
  497: 1,  // COMUNA 1
  498: 2,  // COMUNA 2
  499: 3,  // COMUNA 3
  500: 4,  // COMUNA 4
  501: 5,  // COMUNA 5
  502: 6,  // COMUNA 6
  503: 7,  // COMUNA 7
  504: 8,  // COMUNA 8
  505: 9,  // COMUNA 9
  506: 10, // COMUNA 10
  507: 11, // COMUNA 11
  508: 12, // COMUNA 12
  509: 13, // COMUNA 13
  510: 14, // COMUNA 14
  511: 15  // COMUNA 15
};

console.log('🔄 Transformando propiedades...');

// Transformar cada feature
data.features = data.features.map((feature, index) => {
  const oldId = feature.properties.id;
  const comunaNumber = idToComunaMap[oldId];
  
  if (!comunaNumber) {
    console.warn(`⚠️  No se encontró mapeo para ID ${oldId}`);
    return feature;
  }

  // Nuevas propiedades siguiendo la lógica jerárquica
  // Usar formato ARG.5.1 para que coincida con los votos de la BD
  const newProperties = {
    ID_1: "ARG.5",
    ID_2: `ARG.5.${comunaNumber}`,
    NAME_1: "Ciudad Autónoma de Buenos Aires",
    NAME_2: `Comuna ${comunaNumber}`,
    VARNAME_2: feature.properties.departamento,
    TYPE_2: "Comuna",
    ENGTYPE_2: "Commune"
  };

  console.log(`  ✅ ${feature.properties.departamento} → ${newProperties.ID_2}`);

  return {
    ...feature,
    properties: newProperties
  };
});

// Guardar el archivo transformado
console.log('💾 Guardando archivo transformado...');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 1), 'utf-8');

console.log('✅ Transformación completada!');
console.log(`   Total de features: ${data.features.length}`);
console.log(`   Archivo: ${outputPath}`);
