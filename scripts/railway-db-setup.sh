#!/bin/bash
# Script para configurar la base de datos en Railway (ejecutar UNA SOLA VEZ)

echo "🔧 Configurando base de datos en Railway..."

# Generar cliente de Prisma
echo "📦 Generando Prisma Client..."
npx prisma generate

# Aplicar migraciones O push del schema (si no hay migraciones)
echo "🗄️ Aplicando schema de base de datos..."
if [ -d "prisma/migrations" ]; then
  npx prisma migrate deploy
else
  npx prisma db push --skip-generate
fi

# Ejecutar seed
echo "🌱 Poblando base de datos inicial..."
npx tsx prisma/seed.ts

echo "✅ Base de datos configurada correctamente"
