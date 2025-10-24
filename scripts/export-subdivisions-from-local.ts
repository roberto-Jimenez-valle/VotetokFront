/**
 * Paso 1: Exportar subdivisiones de LOCAL a JSON
 * Este script lee de la DB local SQLite usando better-sqlite3
 */

import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';

function exportSubdivisions() {
  try {
    console.log('📊 Abriendo base de datos LOCAL (SQLite)...');
    const db = new Database('./prisma/dev.db', { readonly: true });
    
    console.log('📊 Leyendo subdivisiones...');
    const subdivisions = db.prepare('SELECT * FROM subdivisions ORDER BY id ASC').all();
    
    console.log(`✅ ${subdivisions.length} subdivisiones encontradas`);
    
    // Guardar a JSON
    const jsonPath = 'subdivisions-export.json';
    writeFileSync(jsonPath, JSON.stringify(subdivisions, null, 2));
    
    console.log(`\n✅ Subdivisiones exportadas a: ${jsonPath}`);
    console.log(`\n📊 Estadísticas:`);
    
    // Agrupar por nivel
    const byLevel: Record<number, number> = {};
    for (const sub of subdivisions as any[]) {
      byLevel[sub.level] = (byLevel[sub.level] || 0) + 1;
    }
    
    console.log('Subdivisiones por nivel:');
    for (const [level, count] of Object.entries(byLevel)) {
      console.log(`  Nivel ${level}: ${count}`);
    }
    
    // Muestra de España
    const spain = (subdivisions as any[]).filter(s => s.subdivision_id.startsWith('ESP.'));
    console.log(`\n🇪🇸 España: ${spain.length} subdivisiones`);
    console.log('Muestra:');
    spain.slice(0, 5).forEach(s => {
      console.log(`  ${s.name} (${s.subdivision_id}) - Nivel ${s.level}`);
    });
    
    db.close();
    console.log('\n✅ Base de datos cerrada');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

exportSubdivisions();
