/**
 * Script para eliminar todos los votos y regenerarlos con subdivisionId correctos
 * en formato jerárquico de 3 niveles (ej: ESP.1.1, ARG.3.2)
 * 
 * Uso: npx tsx scripts/reset-votes-with-hierarchical-ids.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface SubdivisionInfo {
  fullId: string;      // ESP.1.1 (ID completo)
  level2Id: string;    // ESP.1 (comunidad/estado)
  level3Id: string;    // ESP.1.1 (provincia/condado)
  level2Name: string;  // Andalucía
  level3Name: string;  // Almería
  lat?: number;
  lng?: number;
}

interface CountryData {
  iso: string;
  name: string;
  lat: number;
  lng: number;
  subdivisions: SubdivisionInfo[];
}

/**
 * Lee todos los archivos TopoJSON y extrae las subdivisiones con su estructura jerárquica
 */
async function loadSubdivisionsFromTopoJSON(): Promise<Map<string, CountryData>> {
  console.log('📂 Leyendo archivos TopoJSON...\n');
  
  const geojsonDir = path.join(process.cwd(), 'static', 'geojson');
  const countriesData = new Map<string, CountryData>();
  
  const countryDirs = fs.readdirSync(geojsonDir);
  
  for (const countryIso of countryDirs) {
    const countryPath = path.join(geojsonDir, countryIso);
    if (!fs.statSync(countryPath).isDirectory()) continue;
    
    const subdivisions: SubdivisionInfo[] = [];
    const files = fs.readdirSync(countryPath);
    
    // Leer archivos de nivel 2 (ej: ESP.1.topojson, ESP.2.topojson)
    for (const file of files) {
      if (!file.endsWith('.topojson')) continue;
      if (file === `${countryIso}.topojson`) continue;
      
      try {
        const filePath = path.join(countryPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        // Extraer geometrías de nivel 3
        for (const [key, value] of Object.entries(data.objects || {})) {
          const obj = value as any;
          if (obj.geometries) {
            for (const geom of obj.geometries) {
              const props = geom.properties;
              if (props && props.ID_2) {
                const fullId = props.ID_2; // ej: ESP.1.1
                const parts = fullId.split('.');
                
                if (parts.length >= 3) {
                  subdivisions.push({
                    fullId: fullId,                          // ESP.1.1
                    level2Id: `${parts[0]}.${parts[1]}`,     // ESP.1
                    level3Id: fullId,                        // ESP.1.1
                    level2Name: props.name_1 || props.NAME_1 || '',
                    level3Name: props.name_2 || props.NAME_2 || '',
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️  Error leyendo ${file}:`, error);
      }
    }
    
    if (subdivisions.length > 0) {
      // Obtener coordenadas aproximadas del país (centro)
      const avgLat = subdivisions.reduce((sum, s) => sum + (s.lat || 0), 0) / subdivisions.length || 0;
      const avgLng = subdivisions.reduce((sum, s) => sum + (s.lng || 0), 0) / subdivisions.length || 0;
      
      countriesData.set(countryIso, {
        iso: countryIso,
        name: countryIso,
        lat: avgLat || getDefaultCountryLat(countryIso),
        lng: avgLng || getDefaultCountryLng(countryIso),
        subdivisions
      });
      
      console.log(`✅ ${countryIso}: ${subdivisions.length} subdivisiones de nivel 3`);
      if (subdivisions.length > 0) {
        console.log(`   Ejemplos: ${subdivisions.slice(0, 3).map(s => s.fullId).join(', ')}`);
      }
    }
  }
  
  console.log(`\n📊 Total: ${countriesData.size} países con subdivisiones\n`);
  return countriesData;
}

/**
 * Coordenadas por defecto para países principales
 */
function getDefaultCountryLat(iso: string): number {
  const defaults: Record<string, number> = {
    'ESP': 40.4, 'FRA': 48.8, 'DEU': 52.5, 'ITA': 41.9, 'GBR': 51.5,
    'USA': 38.9, 'MEX': 19.4, 'ARG': -34.6, 'BRA': -15.8, 'JPN': 35.7
  };
  return defaults[iso] || 0;
}

function getDefaultCountryLng(iso: string): number {
  const defaults: Record<string, number> = {
    'ESP': -3.7, 'FRA': 2.3, 'DEU': 13.4, 'ITA': 12.5, 'GBR': -0.1,
    'USA': -77.0, 'MEX': -99.1, 'ARG': -58.4, 'BRA': -47.9, 'JPN': 139.7
  };
  return defaults[iso] || 0;
}

/**
 * Genera votos para una encuesta específica
 */
async function generateVotesForPoll(
  poll: any,
  countriesData: Map<string, CountryData>,
  users: any[]
) {
  console.log(`\n📊 Generando votos para: "${poll.title}"`);
  
  let totalVotes = 0;
  const votesToCreate: any[] = [];
  
  // Seleccionar países que tienen subdivisiones
  const availableCountries = Array.from(countriesData.values()).filter(c => c.subdivisions.length > 0);
  
  // Generar votos principalmente para España y algunos otros países
  for (const country of availableCountries) {
    // Más votos para ESP, menos para otros
    const baseVotes = country.iso === 'ESP' ? 150 : 
                     country.iso === 'ARG' ? 80 :
                     country.iso === 'MEX' ? 60 :
                     country.iso === 'BRA' ? 50 :
                     country.iso === 'USA' ? 70 :
                     Math.floor(Math.random() * 30) + 10;
    
    // Distribuir votos entre opciones
    for (const option of poll.options) {
      const votes = Math.floor(Math.random() * baseVotes / poll.options.length) + 5;
      
      for (let i = 0; i < votes; i++) {
        // Seleccionar una subdivisión aleatoria de nivel 3
        const subdivision = country.subdivisions[Math.floor(Math.random() * country.subdivisions.length)];
        
        // Generar coordenadas con pequeña variación
        const lat = country.lat + (Math.random() - 0.5) * 2;
        const lng = country.lng + (Math.random() - 0.5) * 2;
        
        votesToCreate.push({
          pollId: poll.id,
          optionId: option.id,
          userId: users[Math.floor(Math.random() * users.length)].id,
          latitude: lat,
          longitude: lng,
          countryIso3: country.iso,
          countryName: country.name,
          subdivisionId: subdivision.fullId,      // ✅ ESP.1.1 (formato completo de 3 niveles)
          subdivisionName: subdivision.level3Name, // ✅ "Almería"
          cityName: subdivision.level2Name,        // ✅ "Andalucía" 
          ipAddress: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          userAgent: 'Mozilla/5.0 (reset script)'
        });
        
        totalVotes++;
      }
    }
  }
  
  // Insertar votos en batch
  if (votesToCreate.length > 0) {
    await prisma.vote.createMany({
      data: votesToCreate
    });
    
    // Actualizar contadores de opciones
    for (const option of poll.options) {
      const count = votesToCreate.filter(v => v.optionId === option.id).length;
      await prisma.pollOption.update({
        where: { id: option.id },
        data: { voteCount: count }
      });
    }
    
    // Actualizar total de votos de la encuesta
    await prisma.poll.update({
      where: { id: poll.id },
      data: { totalVotes: votesToCreate.length }
    });
  }
  
  console.log(`   ✅ ${votesToCreate.length} votos creados`);
  return totalVotes;
}

async function main() {
  console.log('🗑️  REINICIANDO VOTOS CON IDs JERÁRQUICOS\n');
  console.log('=' .repeat(60));
  
  try {
    // PASO 1: Eliminar todos los votos existentes
    console.log('\n🗑️  PASO 1: Eliminando todos los votos...\n');
    const deletedVotes = await prisma.vote.deleteMany({});
    console.log(`✅ ${deletedVotes.count} votos eliminados\n`);
    
    // Reiniciar contadores de votos en opciones
    await prisma.pollOption.updateMany({
      data: { voteCount: 0 }
    });
    
    // Reiniciar contadores de votos en encuestas
    await prisma.poll.updateMany({
      data: { totalVotes: 0 }
    });
    
    console.log('✅ Contadores reiniciados\n');
    
    // PASO 2: Cargar estructuras de subdivisiones desde TopoJSON
    console.log('📂 PASO 2: Cargando estructuras TopoJSON...\n');
    const countriesData = await loadSubdivisionsFromTopoJSON();
    
    if (countriesData.size === 0) {
      throw new Error('❌ No se encontraron subdivisiones en los archivos TopoJSON');
    }
    
    // PASO 3: Obtener usuarios y encuestas
    console.log('👥 PASO 3: Obteniendo usuarios y encuestas...\n');
    
    const users = await prisma.user.findMany({
      take: 10
    });
    
    if (users.length === 0) {
      throw new Error('❌ No hay usuarios en la base de datos. Ejecuta primero un script de seed de usuarios.');
    }
    
    console.log(`✅ ${users.length} usuarios encontrados\n`);
    
    const polls = await prisma.poll.findMany({
      include: { options: true },
      where: { status: 'active' }
    });
    
    if (polls.length === 0) {
      throw new Error('❌ No hay encuestas activas en la base de datos. Ejecuta primero un script de seed de encuestas.');
    }
    
    console.log(`✅ ${polls.length} encuestas encontradas\n`);
    
    // PASO 4: Generar votos con IDs jerárquicos
    console.log('🎲 PASO 4: Generando votos con IDs jerárquicos...\n');
    console.log('=' .repeat(60));
    
    let totalVotesGenerated = 0;
    
    for (const poll of polls) {
      const votes = await generateVotesForPoll(poll, countriesData, users);
      totalVotesGenerated += votes;
    }
    
    // PASO 5: Verificación final
    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ RESUMEN FINAL\n');
    
    const finalVotes = await prisma.vote.findMany({
      select: { subdivisionId: true },
      take: 20
    });
    
    console.log('📋 Ejemplos de subdivisionId generados:');
    finalVotes.forEach((v, i) => {
      const levels = v.subdivisionId?.split('.').length || 0;
      const emoji = levels === 3 ? '✅' : '❌';
      console.log(`   ${emoji} ${i + 1}. ${v.subdivisionId}`);
    });
    
    // Contar por niveles
    const allVotes = await prisma.vote.findMany({
      select: { subdivisionId: true }
    });
    
    const level3 = allVotes.filter(v => v.subdivisionId?.split('.').length === 3).length;
    const level2 = allVotes.filter(v => v.subdivisionId?.split('.').length === 2).length;
    const other = allVotes.filter(v => {
      const len = v.subdivisionId?.split('.').length || 0;
      return len !== 3 && len !== 2;
    }).length;
    
    console.log('\n📊 Distribución por niveles:');
    console.log(`   ✅ Nivel 3 (ESP.1.1): ${level3} votos (${((level3/allVotes.length)*100).toFixed(1)}%)`);
    console.log(`   ⚠️  Nivel 2 (ESP.1): ${level2} votos (${((level2/allVotes.length)*100).toFixed(1)}%)`);
    console.log(`   ❌ Otros: ${other} votos (${((other/allVotes.length)*100).toFixed(1)}%)`);
    
    console.log(`\n🎉 Total de votos generados: ${totalVotesGenerated}`);
    console.log(`✅ Total de votos en DB: ${allVotes.length}\n`);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error en el script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
