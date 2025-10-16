#!/usr/bin/env python3
"""
Script para debugear archivos TopoJSON
Ve qué estructura tienen y qué propiedades contienen
"""

import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
GEOJSON_DIR = BASE_DIR / "static" / "geojson"

def analyze_topojson(file_path: Path):
    """Analiza un archivo TopoJSON"""
    print(f"\n{'='*60}")
    print(f"📄 Archivo: {file_path.name}")
    print('='*60)
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"\n🔑 Claves principales: {list(data.keys())}")
    
    if 'objects' in data:
        objects = data['objects']
        print(f"\n📦 Objects: {list(objects.keys())}")
        
        for obj_name, obj_data in objects.items():
            print(f"\n   📌 {obj_name}:")
            print(f"      type: {obj_data.get('type')}")
            
            geometries = obj_data.get('geometries', [])
            print(f"      geometries: {len(geometries)} features")
            
            if geometries:
                # Mostrar primeras 3 geometrías
                print(f"\n      🔍 Primeras geometrías:")
                for i, geom in enumerate(geometries[:3]):
                    props = geom.get('properties', {})
                    print(f"\n      Geometría {i+1}:")
                    print(f"         type: {geom.get('type')}")
                    print(f"         properties keys: {list(props.keys())}")
                    
                    # Mostrar propiedades ID_* y NAME_*
                    id_props = {k: v for k, v in props.items() if k.startswith('ID_')}
                    name_props = {k: v for k, v in props.items() if k.startswith('NAME_')}
                    
                    if id_props:
                        print(f"         IDs: {id_props}")
                    if name_props:
                        print(f"         NAMEs: {name_props}")
                    
                    # Mostrar todas las propiedades si son pocas
                    if len(props) <= 15:
                        print(f"         Todas las propiedades:")
                        for k, v in props.items():
                            print(f"            {k}: {v}")

def main():
    print("\n🔍 DEBUG DE ARCHIVOS TOPOJSON")
    print("="*60)
    
    # Analizar ESP.topojson (nivel 1)
    esp_main = GEOJSON_DIR / "ESP" / "ESP.topojson"
    if esp_main.exists():
        analyze_topojson(esp_main)
    else:
        print(f"\n❌ No se encontró: {esp_main}")
    
    # Analizar ESP.1.topojson (nivel 2 de Andalucía)
    esp_1 = GEOJSON_DIR / "ESP" / "ESP.1.topojson"
    if esp_1.exists():
        analyze_topojson(esp_1)
    else:
        print(f"\n❌ No se encontró: {esp_1}")
    
    # Analizar ESP.11.topojson (nivel 2 de Madrid)
    esp_11 = GEOJSON_DIR / "ESP" / "ESP.11.topojson"
    if esp_11.exists():
        analyze_topojson(esp_11)
    else:
        print(f"\n❌ No se encontró: {esp_11}")
    
    print("\n" + "="*60)
    print("✅ Análisis completado")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
