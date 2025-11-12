import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

try {
  // 1. Ver estados en DB
  const dbSubs = await prisma.subdivision.findMany({
    where: {
      subdivisionId: {
        startsWith: 'BRA.'
      },
      level: 2
    },
    select: {
      subdivisionId: true,
      name: true,
      _count: {
        select: {
          votes: true
        }
      }
    },
    orderBy: {
      subdivisionId: 'asc'
    }
  });
  
  console.log('📊 Estados de Brasil en DB:');
  dbSubs.forEach(s => {
    const votes = s._count.votes.toString().padStart(5);
    console.log(`  ${s.subdivisionId.padEnd(10)} - ${s.name.padEnd(30)} - ${votes} votos`);
  });
  
  // 2. Ver estados en TopoJSON
  const topoFile = 'static/geojson/BRA/BRA.topojson';
  const data = JSON.parse(fs.readFileSync(topoFile, 'utf8'));
  const objects = data.objects || {};
  const firstKey = Object.keys(objects)[0];
  const geometries = objects[firstKey].geometries || [];
  
  console.log('\n📦 Estados en TopoJSON:');
  geometries.forEach(g => {
    const id = g.properties.ID_1 || g.properties.id_1;
    const name = g.properties.NAME_1 || g.properties.name_1;
    console.log(`  ${id.padEnd(10)} - ${name}`);
  });
  
  // 3. Buscar Mato Grosso do Sul
  console.log('\n🔍 Buscando Mato Grosso do Sul...');
  const msInDb = dbSubs.find(s => s.name.toLowerCase().includes('mato grosso do sul'));
  const msInTopo = geometries.find(g => 
    (g.properties.NAME_1 || g.properties.name_1 || '').toLowerCase().includes('mato grosso do sul')
  );
  
  if (msInDb) {
    console.log('  ✅ En DB:', msInDb.subdivisionId, '-', msInDb.name, '-', msInDb._count.votes, 'votos');
  } else {
    console.log('  ❌ NO encontrado en DB');
  }
  
  if (msInTopo) {
    const id = msInTopo.properties.ID_1 || msInTopo.properties.id_1;
    const name = msInTopo.properties.NAME_1 || msInTopo.properties.name_1;
    console.log('  ✅ En TopoJSON:', id, '-', name);
  } else {
    console.log('  ❌ NO encontrado en TopoJSON');
  }
  
  // 4. Verificar si coinciden
  if (msInDb && msInTopo) {
    const dbId = msInDb.subdivisionId;
    const topoId = msInTopo.properties.ID_1 || msInTopo.properties.id_1;
    
    if (dbId === topoId) {
      console.log('\n  ✅ IDs COINCIDEN');
    } else {
      console.log('\n  ❌ IDs NO COINCIDEN:');
      console.log('     DB:', dbId);
      console.log('     TopoJSON:', topoId);
    }
  }
  
} finally {
  await prisma.$disconnect();
}
