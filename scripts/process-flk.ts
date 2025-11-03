/**
 * Procesar Falkland Islands (Malvinas)
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import rewind from '@mapbox/geojson-rewind';

const prisma = new PrismaClient();
const TEMP_DIR = 'temp_gadm_downloads';

async function main() {
  console.log('🔧 Procesando Falkland Islands (Malvinas)...\n');
  
  const file = path.join(TEMP_DIR, 'FLK_level1.json');
  
  if (!fs.existsSync(file)) {
    console.log('❌ Archivo no existe');
    return;
  }
  
  const geoData = JSON.parse(fs.readFileSync(file, 'utf8'));
  
  console.log('📁 Archivo: FLK_level1.json');
  console.log(`   Features: ${geoData.features.length}\n`);
  
  // Como es nivel 1 (país), vamos a crear una subdivisión artificial nivel 2
  // para que funcione con el sistema de votos
  
  let added = 0;
  
  for (const feature of geoData.features) {
    const props = feature.properties;
    
    const subdivisionId = 'FLK.1'; // Artificial
    const name = props.shapeName || props.NAME || 'Falkland Islands';
    
    // Calcular centroide
    let latitude: number | null = null;
    let longitude: number | null = null;
    
    if (feature.geometry && feature.geometry.coordinates) {
      const coords = feature.geometry.coordinates;
      
      try {
        if (feature.geometry.type === 'Polygon' && coords[0] && coords[0].length > 0) {
          const ring = coords[0];
          const sum = ring.reduce((acc: any, coord: any) => {
            return { lng: acc.lng + coord[0], lat: acc.lat + coord[1] };
          }, { lng: 0, lat: 0 });
          longitude = sum.lng / ring.length;
          latitude = sum.lat / ring.length;
        } else if (feature.geometry.type === 'MultiPolygon' && coords[0] && coords[0][0] && coords[0][0].length > 0) {
          const ring = coords[0][0];
          const sum = ring.reduce((acc: any, coord: any) => {
            return { lng: acc.lng + coord[0], lat: acc.lat + coord[1] };
          }, { lng: 0, lat: 0 });
          longitude = sum.lng / ring.length;
          latitude = sum.lat / ring.length;
        }
      } catch (e) {
        console.log(`⚠️  Error calculando centroide: ${e}`);
      }
    }
    
    if (latitude === null || longitude === null) {
      console.log('⚠️  Sin coordenadas válidas, usando coordenadas aproximadas');
      latitude = -51.7;
      longitude = -59.0;
    }
    
    // Verificar si existe
    const existing = await prisma.subdivision.findUnique({
      where: { subdivisionId }
    });
    
    if (!existing) {
      await prisma.subdivision.create({
        data: {
          subdivisionId,
          name,
          level: 2, // Nivel 2 para compatibilidad
          latitude,
          longitude
        }
      });
      added++;
      console.log(`✅ Subdivisión creada: ${subdivisionId} - ${name}`);
      console.log(`   Coordenadas: ${latitude}, ${longitude}`);
    } else {
      console.log(`⚠️  Ya existe: ${subdivisionId}`);
    }
  }
  
  console.log(`\n✅ ${added} subdivisiones agregadas\n`);
  
  // Agregar votos
  console.log('🎲 Agregando votos...\n');
  
  const polls = await prisma.poll.findMany({
    where: { status: 'active' },
    include: { options: true }
  });
  
  const users = await prisma.user.findMany({ take: 100 });
  const userIds = users.map(u => u.id);
  
  const subdivisions: any[] = await prisma.$queryRaw`
    SELECT id, subdivision_id, name, level, latitude, longitude
    FROM subdivisions
    WHERE subdivision_id LIKE 'FLK.%'
  `;
  
  if (subdivisions.length === 0) {
    console.log('❌ No hay subdivisiones para agregar votos');
    return;
  }
  
  const values: string[] = [];
  let totalVotes = 0;
  
  for (const poll of polls) {
    if (poll.options.length === 0) continue;
    
    for (const sub of subdivisions) {
      const numVotes = Math.floor(Math.random() * 6) + 3; // 3-8 votos
      
      for (let i = 0; i < numVotes; i++) {
        const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
        const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];
        
        values.push(`(${poll.id}, ${randomOption.id}, ${randomUserId}, ${sub.latitude}, ${sub.longitude}, ${sub.id}, NOW())`);
        totalVotes++;
      }
    }
  }
  
  if (values.length > 0) {
    const chunkSize = 1000;
    for (let i = 0; i < values.length; i += chunkSize) {
      const chunk = values.slice(i, i + chunkSize);
      await prisma.$executeRawUnsafe(`
        INSERT INTO votes (poll_id, option_id, user_id, latitude, longitude, subdivision_id, created_at)
        VALUES ${chunk.join(', ')}
        ON CONFLICT DO NOTHING
      `);
    }
    
    console.log(`✅ ${totalVotes} votos agregados a FLK\n`);
  }
  
  console.log('='.repeat(70));
  console.log('✅ Falkland Islands (Malvinas) procesadas completamente');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
