import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function ejecutarSQL() {
  try {
    console.log('📂 Leyendo archivos SQL...');
    
    // Leer los archivos SQL
    const sql1 = fs.readFileSync(path.join(__dirname, 'insert-encuestas-divertidas.sql'), 'utf-8');
    const sql2 = fs.readFileSync(path.join(__dirname, 'insert-encuestas-divertidas-parte2.sql'), 'utf-8');
    
    console.log('✅ Archivos leídos correctamente');
    console.log('🔄 Ejecutando SQL parte 1...');
    
    // Ejecutar los comandos SQL
    // SQLite en Prisma requiere ejecutar cada statement por separado
    const statements1 = sql1.split(';').filter(s => s.trim().length > 0);
    const statements2 = sql2.split(';').filter(s => s.trim().length > 0);
    
    let count = 0;
    for (const statement of statements1) {
      if (statement.trim()) {
        await prisma.$executeRawUnsafe(statement);
        count++;
        if (count % 10 === 0) {
          console.log(`   Ejecutados ${count} comandos...`);
        }
      }
    }
    
    console.log('✅ SQL parte 1 completado');
    console.log('🔄 Ejecutando SQL parte 2...');
    
    for (const statement of statements2) {
      if (statement.trim()) {
        await prisma.$executeRawUnsafe(statement);
        count++;
        if (count % 10 === 0) {
          console.log(`   Ejecutados ${count} comandos...`);
        }
      }
    }
    
    console.log('✅ SQL parte 2 completado');
    console.log(`\n🎉 Total de comandos ejecutados: ${count}`);
    
    // Verificar encuestas insertadas
    const pollCount = await prisma.poll.count();
    const voteCount = await prisma.vote.count();
    
    console.log(`\n📊 Estadísticas:`);
    console.log(`   Total de encuestas: ${pollCount}`);
    console.log(`   Total de votos: ${voteCount}`);
    
  } catch (error) {
    console.error('❌ Error ejecutando SQL:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

ejecutarSQL();
