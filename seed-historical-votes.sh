#!/bin/bash

echo "========================================"
echo "  SEED DE VOTOS HISTORICOS (Railway)"
echo "========================================"
echo ""
echo "Este script ejecutara el seed en Railway"
echo "Insertara votos distribuidos en el ultimo año"
echo ""
echo "Presiona Ctrl+C para cancelar..."
sleep 3

echo ""
echo "Compilando script TypeScript..."
npx tsc scripts/seed-historical-votes.ts --outDir scripts/dist --module commonjs --target es2020 --esModuleInterop --skipLibCheck

if [ $? -ne 0 ]; then
  echo "❌ Error al compilar TypeScript"
  exit 1
fi

echo ""
echo "Ejecutando seed en Railway..."
railway run node scripts/dist/seed-historical-votes.js

if [ $? -eq 0 ]; then
  echo ""
  echo "========================================"
  echo "  ✅ PROCESO COMPLETADO EXITOSAMENTE"
  echo "========================================"
else
  echo ""
  echo "========================================"
  echo "  ❌ ERROR EN EL PROCESO"
  echo "========================================"
  exit 1
fi
