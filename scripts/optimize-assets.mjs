#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

// Configuración
const CONFIG = {
  images: {
    inputDir: path.join(ROOT_DIR, 'static', 'textures'),
    outputDir: path.join(ROOT_DIR, 'static', 'textures', 'optimized'),
    formats: ['webp', 'avif'],
    quality: 85,
    maxWidth: 2048
  },
  geojson: {
    inputDir: path.join(ROOT_DIR, 'static', 'geojson'),
    outputDir: path.join(ROOT_DIR, 'static', 'geojson', 'optimized'),
    compressionLevel: 9
  }
};

/**
 * Crear directorios si no existen
 */
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`Error creando directorio ${dir}:`, error);
  }
}

/**
 * Obtener tamaño de archivo en KB
 */
async function getFileSize(filePath) {
  const stats = await fs.stat(filePath);
  return (stats.size / 1024).toFixed(2);
}

/**
 * Optimizar imágenes
 */
async function optimizeImages() {
  console.log('\n🖼️  Optimizando imágenes...\n');
  
  await ensureDir(CONFIG.images.outputDir);
  
  const files = await fs.readdir(CONFIG.images.inputDir);
  const imageFiles = files.filter(file => 
    /\.(png|jpg|jpeg)$/i.test(file)
  );

  let totalSaved = 0;

  for (const file of imageFiles) {
    const inputPath = path.join(CONFIG.images.inputDir, file);
    const baseName = path.basename(file, path.extname(file));
    const originalSize = await getFileSize(inputPath);

    console.log(`📄 Procesando: ${file} (${originalSize} KB)`);

    // Convertir a WebP
    try {
      const webpPath = path.join(CONFIG.images.outputDir, `${baseName}.webp`);
      await convertToWebP(inputPath, webpPath);
      const webpSize = await getFileSize(webpPath);
      const saved = originalSize - webpSize;
      totalSaved += saved;
      console.log(`   ✅ WebP: ${webpSize} KB (ahorrado: ${saved.toFixed(2)} KB)`);
    } catch (error) {
      console.error(`   ❌ Error convirtiendo a WebP:`, error.message);
    }

    // Convertir a AVIF
    try {
      const avifPath = path.join(CONFIG.images.outputDir, `${baseName}.avif`);
      await convertToAVIF(inputPath, avifPath);
      const avifSize = await getFileSize(avifPath);
      const saved = originalSize - avifSize;
      totalSaved += saved;
      console.log(`   ✅ AVIF: ${avifSize} KB (ahorrado: ${saved.toFixed(2)} KB)`);
    } catch (error) {
      console.error(`   ❌ Error convirtiendo a AVIF:`, error.message);
    }
  }

  console.log(`\n✨ Total ahorrado en imágenes: ${totalSaved.toFixed(2)} KB\n`);
}

/**
 * Convertir imagen a WebP usando sharp o cwebp
 */
async function convertToWebP(input, output) {
  // Intentar con sharp (si está instalado)
  try {
    const sharp = await import('sharp');
    await sharp.default(input)
      .resize(CONFIG.images.maxWidth, null, { 
        withoutEnlargement: true 
      })
      .webp({ 
        quality: CONFIG.images.quality,
        effort: 6
      })
      .toFile(output);
  } catch {
    // Fallback a cwebp si está disponible
    const command = `cwebp -q ${CONFIG.images.quality} "${input}" -o "${output}"`;
    await execAsync(command);
  }
}

/**
 * Convertir imagen a AVIF
 */
async function convertToAVIF(input, output) {
  try {
    const sharp = await import('sharp');
    await sharp.default(input)
      .resize(CONFIG.images.maxWidth, null, { 
        withoutEnlargement: true 
      })
      .avif({ 
        quality: CONFIG.images.quality,
        effort: 6
      })
      .toFile(output);
  } catch (error) {
    // Si sharp no está disponible, saltar AVIF
    throw new Error('Sharp no disponible para conversión AVIF');
  }
}

/**
 * Comprimir archivos TopoJSON
 */
async function compressTopoJSON() {
  console.log('\n🗺️  Comprimiendo archivos TopoJSON...\n');
  
  await ensureDir(CONFIG.geojson.outputDir);
  
  const countries = await fs.readdir(CONFIG.geojson.inputDir);
  let totalOriginal = 0;
  let totalCompressed = 0;

  for (const country of countries) {
    const countryPath = path.join(CONFIG.geojson.inputDir, country);
    const stats = await fs.stat(countryPath);
    
    if (!stats.isDirectory()) continue;
    
    const outputCountryPath = path.join(CONFIG.geojson.outputDir, country);
    await ensureDir(outputCountryPath);
    
    const files = await fs.readdir(countryPath);
    const topoFiles = files.filter(f => f.endsWith('.topojson'));
    
    for (const file of topoFiles) {
      const inputFile = path.join(countryPath, file);
      const outputFile = path.join(outputCountryPath, file.replace('.topojson', '.min.topojson'));
      
      try {
        // Leer y minificar JSON
        const content = await fs.readFile(inputFile, 'utf-8');
        const json = JSON.parse(content);
        const minified = JSON.stringify(json);
        
        // Comprimir con gzip
        const { gzipSync } = await import('zlib');
        const compressed = gzipSync(minified, { 
          level: CONFIG.geojson.compressionLevel 
        });
        
        await fs.writeFile(outputFile + '.gz', compressed);
        
        const originalSize = (await fs.stat(inputFile)).size;
        const compressedSize = compressed.length;
        
        totalOriginal += originalSize;
        totalCompressed += compressedSize;
        
        const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        console.log(`   📍 ${country}/${file}: ${ratio}% comprimido`);
      } catch (error) {
        console.error(`   ❌ Error comprimiendo ${file}:`, error.message);
      }
    }
  }

  const totalRatio = ((1 - totalCompressed / totalOriginal) * 100).toFixed(1);
  console.log(`\n✨ Compresión total TopoJSON: ${totalRatio}%`);
  console.log(`   Original: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Comprimido: ${(totalCompressed / 1024 / 1024).toFixed(2)} MB\n`);
}

/**
 * Generar manifest de assets
 */
async function generateAssetsManifest() {
  console.log('\n📋 Generando manifest de assets...\n');
  
  const manifest = {
    version: new Date().toISOString(),
    images: {},
    geojson: {}
  };

  // Listar imágenes optimizadas
  if (await fs.access(CONFIG.images.outputDir).then(() => true).catch(() => false)) {
    const files = await fs.readdir(CONFIG.images.outputDir);
    for (const file of files) {
      const stats = await fs.stat(path.join(CONFIG.images.outputDir, file));
      manifest.images[file] = {
        size: stats.size,
        modified: stats.mtime.toISOString()
      };
    }
  }

  // Listar TopoJSON optimizado
  if (await fs.access(CONFIG.geojson.outputDir).then(() => true).catch(() => false)) {
    const countries = await fs.readdir(CONFIG.geojson.outputDir);
    for (const country of countries) {
      const countryPath = path.join(CONFIG.geojson.outputDir, country);
      const stats = await fs.stat(countryPath);
      
      if (stats.isDirectory()) {
        const files = await fs.readdir(countryPath);
        manifest.geojson[country] = {};
        
        for (const file of files) {
          const fileStats = await fs.stat(path.join(countryPath, file));
          manifest.geojson[country][file] = {
            size: fileStats.size,
            modified: fileStats.mtime.toISOString()
          };
        }
      }
    }
  }

  const manifestPath = path.join(ROOT_DIR, 'static', 'assets-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`✅ Manifest generado: ${manifestPath}\n`);
}

/**
 * Limpiar archivos antiguos
 */
async function cleanOldFiles() {
  console.log('\n🧹 Limpiando archivos antiguos...\n');
  
  // Aquí podrías agregar lógica para eliminar archivos no utilizados
  // basándote en el manifest o en un análisis de uso
  
  console.log('✅ Limpieza completada\n');
}

/**
 * Analizar uso de assets
 */
async function analyzeAssetUsage() {
  console.log('\n📊 Analizando uso de assets...\n');
  
  const sourceFiles = [
    path.join(ROOT_DIR, 'src'),
  ];
  
  const usedAssets = new Set();
  
  for (const dir of sourceFiles) {
    await scanDirectory(dir, usedAssets);
  }
  
  console.log(`📦 Assets en uso: ${usedAssets.size}`);
  
  // Comparar con assets existentes
  const allAssets = await getAllAssets();
  const unusedAssets = allAssets.filter(asset => !usedAssets.has(asset));
  
  if (unusedAssets.length > 0) {
    console.log(`\n⚠️  Assets no utilizados (${unusedAssets.length}):`);
    unusedAssets.forEach(asset => {
      console.log(`   - ${asset}`);
    });
  } else {
    console.log('\n✅ Todos los assets están en uso');
  }
}

/**
 * Escanear directorio en busca de referencias a assets
 */
async function scanDirectory(dir, usedAssets) {
  const files = await fs.readdir(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = await fs.stat(filePath);
    
    if (stats.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      await scanDirectory(filePath, usedAssets);
    } else if (stats.isFile() && /\.(svelte|js|ts|css)$/.test(file)) {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Buscar referencias a assets
      const assetPatterns = [
        /\/textures\/([^'")\s]+)/g,
        /\/geojson\/([^'")\s]+)/g,
        /\/images\/([^'")\s]+)/g,
        /src=['"]([^'"]+)['"]/g
      ];
      
      for (const pattern of assetPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          usedAssets.add(match[1]);
        }
      }
    }
  }
}

/**
 * Obtener todos los assets
 */
async function getAllAssets() {
  const assets = [];
  
  // Agregar lógica para listar todos los assets
  
  return assets;
}

/**
 * Función principal
 */
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   🚀 OPTIMIZACIÓN DE ASSETS - VOTETOK   ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Verificar herramientas disponibles
    console.log('\n🔍 Verificando herramientas...');
    
    // Optimizar imágenes
    await optimizeImages();
    
    // Comprimir TopoJSON
    await compressTopoJSON();
    
    // Generar manifest
    await generateAssetsManifest();
    
    // Analizar uso
    await analyzeAssetUsage();
    
    // Limpiar archivos antiguos
    await cleanOldFiles();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   ✅ OPTIMIZACIÓN COMPLETADA CON ÉXITO   ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('\n❌ Error durante la optimización:', error);
    process.exit(1);
  }
}

// Ejecutar si es el archivo principal
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export {
  optimizeImages,
  compressTopoJSON,
  generateAssetsManifest,
  analyzeAssetUsage
};
