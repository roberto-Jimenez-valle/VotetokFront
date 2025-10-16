import fs from 'fs';
import path from 'path';
import * as topojson from 'topojson-client';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

async function testMadridGeocode() {
  console.log('\n🧪 Probando point-in-polygon para Madrid...\n');
  
  // Coordenadas que devuelve IP API para Madrid
  const lat = 40.3908;
  const lon = -3.6598;
  
  console.log(`📍 Coordenadas: lat=${lat}, lon=${lon}`);
  
  // Cargar TopoJSON de España
  const topoPath = path.join(process.cwd(), 'static', 'geojson', 'ESP', 'ESP.topojson');
  
  if (!fs.existsSync(topoPath)) {
    console.log('❌ No se encontró ESP.topojson');
    return;
  }
  
  const topoData = JSON.parse(fs.readFileSync(topoPath, 'utf-8'));
  const geoJSON: any = topojson.feature(topoData, topoData.objects[Object.keys(topoData.objects)[0]]);
  
  console.log(`📂 TopoJSON cargado: ${geoJSON.features.length} comunidades autónomas\n`);
  
  const testPoint = point([lon, lat]);
  
  // Probar cada polígono
  console.log('🔍 Probando point-in-polygon...\n');
  
  for (const feature of geoJSON.features) {
    const props = feature.properties;
    const subdivisionId = props.ID_1 || props.id_1;
    const name = props.NAME_1 || props.name_1;
    
    const isInside = booleanPointInPolygon(testPoint, feature);
    
    if (isInside) {
      console.log(`✅ MATCH: ${name} (${subdivisionId})`);
      console.log(`   Propiedades:`, JSON.stringify(props, null, 2));
      return;
    }
  }
  
  console.log('❌ No se encontró ninguna coincidencia');
}

testMadridGeocode().catch(console.error);
