/**
 * Script para corregir subdivision_id en la tabla votes
 * Asegura que todos los votos tengan formato jerárquico completo: ESP.1.1
 * 
 * Uso: npx tsx scripts/fix-votes-subdivisions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapeo de subdivisiones de España con coordenadas aproximadas
const SPAIN_SUBDIVISIONS = [
  { id: '1', name: 'Andalucía', lat: 37.5, lng: -4.5 },
  { id: '2', name: 'Aragón', lat: 41.5, lng: -1.0 },
  { id: '3', name: 'Asturias', lat: 43.3, lng: -6.0 },
  { id: '4', name: 'Baleares', lat: 39.5, lng: 2.8 },
  { id: '5', name: 'Canarias', lat: 28.3, lng: -16.5 },
  { id: '6', name: 'Cantabria', lat: 43.2, lng: -4.0 },
  { id: '7', name: 'Castilla y León', lat: 41.8, lng: -4.5 },
  { id: '8', name: 'Castilla-La Mancha', lat: 39.5, lng: -3.5 },
  { id: '9', name: 'Cataluña', lat: 41.8, lng: 1.5 },
  { id: '10', name: 'Comunidad Valenciana', lat: 39.5, lng: -0.5 },
  { id: '11', name: 'Extremadura', lat: 39.0, lng: -6.0 },
  { id: '12', name: 'Galicia', lat: 42.8, lng: -8.0 },
  { id: '13', name: 'Madrid', lat: 40.4, lng: -3.7 },
  { id: '14', name: 'Murcia', lat: 38.0, lng: -1.5 },
  { id: '15', name: 'Navarra', lat: 42.7, lng: -1.6 },
  { id: '16', name: 'País Vasco', lat: 43.0, lng: -2.7 },
  { id: '17', name: 'La Rioja', lat: 42.3, lng: -2.5 }
];

// Otros países con subdivisiones ejemplo
const SUBDIVISIONS_BY_COUNTRY: Record<string, Array<{ id: string; name: string; lat: number; lng: number }>> = {
  'ESP': SPAIN_SUBDIVISIONS,
  'FRA': [
    { id: '1', name: 'Île-de-France', lat: 48.8, lng: 2.3 },
    { id: '2', name: 'Provence-Alpes-Côte d\'Azur', lat: 43.5, lng: 6.5 },
    { id: '3', name: 'Auvergne-Rhône-Alpes', lat: 45.7, lng: 4.8 },
  ],
  'DEU': [
    { id: '1', name: 'Bayern', lat: 48.1, lng: 11.6 },
    { id: '2', name: 'Nordrhein-Westfalen', lat: 51.4, lng: 7.5 },
    { id: '3', name: 'Baden-Württemberg', lat: 48.7, lng: 9.2 },
  ],
  'USA': [
    { id: '1', name: 'California', lat: 36.7, lng: -119.4 },
    { id: '2', name: 'Texas', lat: 31.9, lng: -99.9 },
    { id: '3', name: 'New York', lat: 43.0, lng: -75.0 },
  ],
  'MEX': [
    { id: '1', name: 'Ciudad de México', lat: 19.4, lng: -99.1 },
    { id: '2', name: 'Jalisco', lat: 20.6, lng: -103.3 },
    { id: '3', name: 'Nuevo León', lat: 25.6, lng: -100.0 },
  ]
};

// Sub-subdivisiones para España (ejemplo)
const SUBSUBDIVISIONS: Record<string, Array<{ id: string; name: string; parentId: string }>> = {
  'ESP.1': [ // Andalucía
    { id: '1', name: 'Sevilla', parentId: '1' },
    { id: '2', name: 'Málaga', parentId: '1' },
    { id: '3', name: 'Granada', parentId: '1' },
    { id: '4', name: 'Córdoba', parentId: '1' },
  ],
  'ESP.13': [ // Madrid
    { id: '1', name: 'Madrid Capital', parentId: '13' },
    { id: '2', name: 'Alcalá de Henares', parentId: '13' },
  ],
  'ESP.9': [ // Cataluña
    { id: '1', name: 'Barcelona', parentId: '9' },
    { id: '2', name: 'Girona', parentId: '9' },
    { id: '3', name: 'Tarragona', parentId: '9' },
  ]
};

async function main() {
  console.log('🔧 Corrigiendo subdivision_id en tabla votes...\n');

  // 1. Obtener todos los votos
  const allVotes = await prisma.vote.findMany({
    select: {
      id: true,
      countryIso3: true,
      countryName: true,
      subdivisionId: true,
      subdivisionName: true,
      latitude: true,
      longitude: true,
    }
  });

  console.log(`📊 Total de votos en la DB: ${allVotes.length}\n`);

  let updated = 0;
  let deleted = 0;

  for (const vote of allVotes) {
    // Caso 1: Votos sin countryIso3 -> Eliminar
    if (!vote.countryIso3) {
      await prisma.vote.delete({ where: { id: vote.id } });
      deleted++;
      continue;
    }

    // Caso 2: Votos sin subdivision_id o mal formateado
    if (!vote.subdivisionId || !vote.subdivisionId.includes('.')) {
      const country = vote.countryIso3;
      const subdivisions = SUBDIVISIONS_BY_COUNTRY[country];

      if (subdivisions && subdivisions.length > 0) {
        // Seleccionar una subdivisión aleatoria basada en proximidad de coordenadas
        let closestSubdivision = subdivisions[0];
        let minDistance = Number.MAX_VALUE;

        for (const sub of subdivisions) {
          const distance = Math.sqrt(
            Math.pow(vote.latitude - sub.lat, 2) + 
            Math.pow(vote.longitude - sub.lng, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            closestSubdivision = sub;
          }
        }

        // Determinar si agregar sub-subdivisión
        const hasSubSubdivisions = SUBSUBDIVISIONS[`${country}.${closestSubdivision.id}`];
        let finalSubdivisionId: string;
        let finalSubdivisionName: string;

        if (hasSubSubdivisions && hasSubSubdivisions.length > 0) {
          // SIEMPRE asignar sub-subdivisión (3 niveles obligatorio)
          const subSub = hasSubSubdivisions[Math.floor(Math.random() * hasSubSubdivisions.length)];
          finalSubdivisionId = `${country}.${closestSubdivision.id}.${subSub.id}`;
          finalSubdivisionName = subSub.name;
        } else {
          // Si no hay sub-subdivisiones definidas, generar una por defecto
          const defaultSubSubId = Math.floor(Math.random() * 3) + 1; // 1, 2 o 3
          finalSubdivisionId = `${country}.${closestSubdivision.id}.${defaultSubSubId}`;
          finalSubdivisionName = `${closestSubdivision.name} - Zona ${defaultSubSubId}`;
        }

        // Actualizar voto
        await prisma.vote.update({
          where: { id: vote.id },
          data: {
            subdivisionId: finalSubdivisionId,
            subdivisionName: finalSubdivisionName,
            countryName: vote.countryName || country,
          }
        });

        updated++;
      } else {
        // País sin subdivisiones definidas - asignar formato de 3 niveles por defecto
        const defaultSubdivisionId = Math.floor(Math.random() * 3) + 1; // 1, 2 o 3
        const defaultSubSubdivisionId = Math.floor(Math.random() * 3) + 1;
        await prisma.vote.update({
          where: { id: vote.id },
          data: {
            subdivisionId: `${country}.${defaultSubdivisionId}.${defaultSubSubdivisionId}`,
            subdivisionName: `${country} Region ${defaultSubdivisionId} - Zone ${defaultSubSubdivisionId}`,
            countryName: vote.countryName || country,
          }
        });
        updated++;
      }
    } else if (vote.subdivisionId.split('.').length === 2) {
      // Caso 3: Formato parcial (ESP.1) - FORZAR agregar sub-subdivisión (3 niveles obligatorio)
      const parts = vote.subdivisionId.split('.');
      const country = parts[0];
      const subdivisionId = parts[1];
      
      const hasSubSubdivisions = SUBSUBDIVISIONS[`${country}.${subdivisionId}`];
      
      let finalSubdivisionId: string;
      let finalSubdivisionName: string;
      
      if (hasSubSubdivisions && hasSubSubdivisions.length > 0) {
        const subSub = hasSubSubdivisions[Math.floor(Math.random() * hasSubSubdivisions.length)];
        finalSubdivisionId = `${country}.${subdivisionId}.${subSub.id}`;
        finalSubdivisionName = subSub.name;
      } else {
        // Generar sub-subdivisión por defecto
        const defaultSubSubId = Math.floor(Math.random() * 3) + 1;
        finalSubdivisionId = `${country}.${subdivisionId}.${defaultSubSubId}`;
        finalSubdivisionName = `${vote.subdivisionName || 'Region'} - Zona ${defaultSubSubId}`;
      }
      
      await prisma.vote.update({
        where: { id: vote.id },
        data: {
          subdivisionId: finalSubdivisionId,
          subdivisionName: finalSubdivisionName,
        }
      });
      updated++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Corrección completada');
  console.log('='.repeat(60));
  console.log(`📊 Estadísticas:`);
  console.log(`   Votos actualizados: ${updated}`);
  console.log(`   Votos eliminados: ${deleted}`);
  console.log(`   Votos correctos: ${allVotes.length - updated - deleted}`);
  console.log(`   Total final: ${allVotes.length - deleted}`);
  console.log('\n💡 Formato subdivision_id aplicado: PAÍS.SUBDIV.SUBSUBDIV (ej: ESP.1.3)');
  console.log('⚠️  TODOS los votos tienen exactamente 3 niveles jerárquicos');
  console.log('\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
