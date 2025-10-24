@echo off
echo ==========================================
echo Verificando Datos en Railway
echo ==========================================
echo.

set DATABASE_URL=postgresql://postgres:ajlnBQueMwvXXqyIsJHUSSZbDbwvLzSn@metro.proxy.rlwy.net:54076/railway

echo Consultando base de datos Railway...
echo.

npx tsx -e "import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); const polls = await prisma.poll.findMany({ include: { options: true }, orderBy: { id: 'asc' }, take: 5 }); console.log('=== ENCUESTAS EN RAILWAY ==='); polls.forEach(p => console.log(`ID: ${p.id} - ${p.title} (${p.options.length} opciones)`)); const voteCount = await prisma.vote.count(); console.log(`\nTotal votos: ${voteCount}`); await prisma.$disconnect();"

echo.
pause
