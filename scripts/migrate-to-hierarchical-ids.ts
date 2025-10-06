import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script de migración para convertir todos los IDs de subdivisión a formato jerárquico
 * 
 * ANTES:
 * - subdivisionId: "1" (solo número)
 * - subdivisionId: null para nivel 3
 * 
 * DESPUÉS:
 * - subdivisionId: "ESP.1" (nivel 1 - Andalucía)
 * - subdivisionId: "ESP.1.1" (nivel 2 - Sevilla)
 * - subdivisionId: "ESP.1.2" (nivel 2 - Jaén)
 */

async function migrateToHierarchicalIds() {
  
  try {
    // PASO 1: Obtener todos los votos que necesitan migración
    const votes = await prisma.vote.findMany({
      where: {
        subdivisionId: { not: null }
      },
      select: {
        id: true,
        countryIso3: true,
        subdivisionId: true,
        subdivisionName: true,
        cityName: true
      }
    });

    
    let migratedCount = 0;
    let alreadyMigratedCount = 0;
    let errorCount = 0;

    for (const vote of votes) {
      try {
        const currentId = vote.subdivisionId;
        if (!currentId) continue;

        // Si ya está en formato jerárquico (contiene punto), verificar si es completo
        if (currentId.includes('.')) {
          const parts = currentId.split('.');
          
          // Si ya tiene formato completo (ESP.1 o ESP.1.1), saltar
          if (parts.length >= 2 && parts[0].length === 3) {
            alreadyMigratedCount++;
            continue;
          }
        }

        // Construir el nuevo ID jerárquico
        let newId: string;
        
        // Si es solo un número (ej: "1"), convertir a formato jerárquico
        if (/^\d+$/.test(currentId)) {
          newId = `${vote.countryIso3}.${currentId}`;
        } else {
          // Si tiene otro formato, intentar normalizar
          newId = currentId;
        }

        // Actualizar el voto
        await prisma.vote.update({
          where: { id: vote.id },
          data: {
            subdivisionId: newId
          }
        });

        migratedCount++;
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error en voto ${vote.id}:`, error);
      }
    }

                
    // PASO 2: Mostrar estadísticas por país
        const byCountry = await prisma.vote.groupBy({
      by: ['countryIso3'],
      where: {
        subdivisionId: { not: null }
      },
      _count: true
    });

    byCountry.forEach(item => {
          });

    // PASO 3: Mostrar ejemplos de IDs jerárquicos
        const examples = await prisma.vote.findMany({
      where: {
        subdivisionId: { not: null }
      },
      select: {
        subdivisionId: true,
        subdivisionName: true,
        cityName: true
      },
      distinct: ['subdivisionId'],
      take: 10
    });

    examples.forEach(ex => {
      const level = ex.subdivisionId?.split('.').length || 0;
      const levelName = level === 2 ? 'Nivel 1' : level === 3 ? 'Nivel 2' : 'Otro';
          });

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
migrateToHierarchicalIds();
