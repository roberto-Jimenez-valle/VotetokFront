#!/usr/bin/env python3
"""
Script para poblar subdivisiones desde archivos TopoJSON/GeoJSON

Lee la estructura de archivos en static/geojson/ y puebla la tabla subdivisions
con datos de nivel 1, 2 y 3.

Estructura esperada:
- static/geojson/{COUNTRY}/{COUNTRY}.topojson          → Nivel 1
- static/geojson/{COUNTRY}/{COUNTRY}.{N}.topojson      → Nivel 2 y 3

Uso:
    python scripts/populate_subdivisions.py
"""

import json
import sqlite3
import os
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import math

# Configuración
BASE_DIR = Path(__file__).parent.parent
GEOJSON_DIR = BASE_DIR / "static" / "geojson"
DB_PATH = BASE_DIR / "prisma" / "dev.db"

def calculate_centroid(geometry) -> Tuple[float, float]:
    """
    Calcula el centroide de una geometría TopoJSON
    Retorna (latitude, longitude)
    """
    # Si la geometría está vacía o es TopoJSON comprimido, retornar 0,0
    if not geometry or 'arcs' in geometry or 'type' not in geometry:
        return (0.0, 0.0)
    
    coords = []
    
    def extract_coords(geom):
        geom_type = geom.get('type')
        if not geom_type:
            return
            
        if geom_type == 'Polygon':
            # Tomar el primer anillo (exterior)
            if 'coordinates' in geom and geom['coordinates']:
                coords.extend(geom['coordinates'][0])
        elif geom_type == 'MultiPolygon':
            # Tomar el primer polígono, primer anillo
            if 'coordinates' in geom and geom['coordinates']:
                coords.extend(geom['coordinates'][0][0])
        elif geom_type == 'Point':
            if 'coordinates' in geom:
                coords.append(geom['coordinates'])
    
    extract_coords(geometry)
    
    if not coords:
        return (0.0, 0.0)
    
    # Calcular promedio
    avg_lon = sum(c[0] for c in coords) / len(coords)
    avg_lat = sum(c[1] for c in coords) / len(coords)
    
    return (avg_lat, avg_lon)

def get_db_connection():
    """Conecta a la base de datos SQLite"""
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Base de datos no encontrada en {DB_PATH}")
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Asegurar que SQLite use UTF-8
    conn.execute("PRAGMA encoding = 'UTF-8'")
    return conn

def clear_subdivisions(conn, country_iso: str):
    """Elimina todas las subdivisiones de un país para repoblar"""
    print(f"   🗑️  Limpiando subdivisiones existentes...")
    # Eliminar país y todas sus subdivisiones
    conn.execute("DELETE FROM subdivisions WHERE subdivision_id = ? OR subdivision_id LIKE ?", 
                 (country_iso, f"{country_iso}.%"))
    conn.commit()

def create_country_level(conn, country_iso: str, topojson_path: Path) -> int:
    """
    Crea el registro de nivel 1 para el país (ej: ESP)
    Retorna: db_id del país
    """
    print(f"\n   📁 Creando nivel 1 (país): {country_iso}")
    
    with open(topojson_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Obtener nombre del país desde el primer registro
    objects = data.get('objects', {})
    if objects:
        main_object = objects[list(objects.keys())[0]]
        geometries = main_object.get('geometries', [])
        if geometries:
            props = geometries[0].get('properties', {})
            country_name = props.get('country', props.get('CountryNew', country_iso))
        else:
            country_name = country_iso
    else:
        country_name = country_iso
    
    # Insertar país como nivel 1
    cursor = conn.execute("""
        INSERT INTO subdivisions (
            subdivision_id, level,
            level1_id, level2_id, level3_id,
            name, name_local, name_variant,
            type_english,
            hasc, iso, country_code,
            latitude, longitude
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        country_iso, 1,  # Nivel 1 = país
        None, None, None,
        country_name, None, None,
        'Country',
        None, country_iso, None,
        0.0, 0.0  # Coordenadas se pueden calcular después
    ))
    
    country_db_id = cursor.lastrowid
    print(f"   ✅ {country_iso}: {country_name} (nivel 1)")
    conn.commit()
    return country_db_id

def process_level2(conn, country_iso: str, topojson_path: Path) -> Dict[str, int]:
    """
    Procesa nivel 2 desde {COUNTRY}.topojson (comunidades/estados)
    Retorna: dict de subdivision_id -> db_id
    """
    print(f"\n   📁 Procesando nivel 2 (comunidades): {topojson_path.name}")
    
    with open(topojson_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Obtener el objeto principal (usualmente el primer objeto)
    objects = data.get('objects', {})
    if not objects:
        print(f"   ⚠️  No hay objetos en el TopoJSON")
        return {}
    
    main_object = objects[list(objects.keys())[0]]
    geometries = main_object.get('geometries', [])
    
    print(f"   📊 Encontradas {len(geometries)} subdivisiones nivel 2")
    
    subdivision_ids = {}
    
    for geom in geometries:
        props = geom.get('properties', {})
        
        # Extraer información
        id_1_full = props.get('ID_1')  # Viene como "ESP.1", "ESP.2", etc.
        
        if not id_1_full:
            print(f"   ⚠️  Geometría sin ID_1, saltando")
            continue
        
        # El ID_1 ya viene en formato completo (ESP.1), usarlo directamente
        subdivision_id = id_1_full
        
        # Mapear campos del schema
        name = props.get('name_1', props.get('NAME_1', subdivision_id))
        name_local = props.get('nl_name_1', props.get('NL_NAME_1'))
        name_variant = props.get('varname_1', props.get('VARNAME_1'))
        type_english = props.get('engtype_1', props.get('ENGTYPE_1'))
        hasc = props.get('hasc_1', props.get('HASC_1'))
        iso = props.get('iso_1', props.get('ISO_1'))
        country_code = props.get('cc_1', props.get('CC_1'))
        
        # Extraer IDs numéricos (ESP.1 -> level1Id="1")
        id_parts = id_1_full.split('.')
        level1_id = id_parts[1] if len(id_parts) > 1 else id_parts[0]  # Extraer "1" de "ESP.1"
        level2_id = None
        level3_id = None
        
        # Calcular centroide (simplificado, usar coordenadas de propiedades si están)
        lat = float(props.get('latitude', 0)) if props.get('latitude') else 0.0
        lon = float(props.get('longitude', 0)) if props.get('longitude') else 0.0
        
        # Si no hay coordenadas en propiedades, intentar calcular
        if lat == 0 and lon == 0:
            lat, lon = calculate_centroid(geom.get('geometry', {}))
        
        # Insertar en BD como nivel 2
        cursor = conn.execute("""
            INSERT INTO subdivisions (
                subdivision_id, level,
                level1_id, level2_id, level3_id,
                name, name_local, name_variant,
                type_english,
                hasc, iso, country_code,
                latitude, longitude
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            subdivision_id, 2,  # NIVEL 2 (comunidades/estados)
            level1_id, level2_id, level3_id,
            name, name_local, name_variant,
            type_english,
            hasc, iso, country_code,
            lat, lon
        ))
        
        db_id = cursor.lastrowid
        subdivision_ids[subdivision_id] = db_id
        
        print(f"   ✅ {subdivision_id}: {name}")
    
    conn.commit()
    return subdivision_ids

def process_level3(conn, country_iso: str, level2_ids: Dict[str, int], geojson_dir: Path):
    """
    Procesa nivel 3 desde archivos {COUNTRY}.{N}.topojson (provincias)
    """
    print(f"\n   📁 Buscando archivos de nivel 3 (provincias)...")
    
    # Buscar archivos tipo ESP.1.topojson, ESP.2.topojson, etc.
    pattern = f"{country_iso}.*.topojson"
    level2_files = list(geojson_dir.glob(pattern))
    
    # Filtrar solo archivos con un número después del país
    level2_files = [f for f in level2_files if f.stem != country_iso]
    
    print(f"   📊 Encontrados {len(level2_files)} archivos de nivel 3")
    
    for topojson_path in sorted(level2_files):
        # Extraer el nivel 1 del nombre del archivo (ej: ESP.1 -> 1)
        parts = topojson_path.stem.split('.')
        if len(parts) < 2:
            continue
        
        level1_num = parts[1]
        subdivision_l2_id = f"{country_iso}.{level1_num}"
        
        parent_id = level2_ids.get(subdivision_l2_id)
        if not parent_id:
            print(f"   ⚠️  No se encontró padre para {subdivision_l2_id}, saltando {topojson_path.name}")
            continue
        
        print(f"\n   📄 Procesando: {topojson_path.name}")
        
        with open(topojson_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        objects = data.get('objects', {})
        if not objects:
            continue
        
        main_object = objects[list(objects.keys())[0]]
        geometries = main_object.get('geometries', [])
        
        print(f"      📊 Encontradas {len(geometries)} geometrías")
        
        level3_count = 0
        
        for geom in geometries:
            props = geom.get('properties', {})
            
            # Extraer IDs (vienen completos: ESP.1.1, ESP.1.2, etc.)
            id_2_full = props.get('ID_2')  # Formato: ESP.1.1, ESP.11.1, etc.
            
            # Todos estos son nivel 3 ahora
            if id_2_full:
                # Es nivel 3 (provincia)
                level = 3
                subdivision_id = id_2_full
                # Mapear campos del schema
                name = props.get('name_2', props.get('NAME_2', subdivision_id))
                name_local = props.get('nl_name_2', props.get('NL_NAME_2'))
                name_variant = props.get('varname_2', props.get('VARNAME_2'))
                type_english = props.get('engtype_2', props.get('ENGTYPE_2'))
                hasc = props.get('hasc_2', props.get('HASC_2'))
                iso = None
                country_code = props.get('cc_2', props.get('CC_2'))
                
                # Extraer IDs numéricos de ESP.1.2 -> level1Id="1", level2Id="2"
                parts = id_2_full.split('.')
                level1_id = parts[1] if len(parts) > 1 else None
                level2_id = parts[2] if len(parts) > 2 else None
                level3_id = None
                
                level3_count += 1
            else:
                # No tiene ID suficiente
                continue
            
            # Calcular centroide
            lat = float(props.get('latitude', 0)) if props.get('latitude') else 0.0
            lon = float(props.get('longitude', 0)) if props.get('longitude') else 0.0
            
            if lat == 0 and lon == 0:
                lat, lon = calculate_centroid(geom.get('geometry', {}))
            
            # Insertar en BD
            try:
                conn.execute("""
                    INSERT INTO subdivisions (
                        subdivision_id, level,
                        level1_id, level2_id, level3_id,
                        name, name_local, name_variant,
                        type_english,
                        hasc, iso, country_code,
                        latitude, longitude
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    subdivision_id, level,
                    level1_id, level2_id, level3_id,
                    name, name_local, name_variant,
                    type_english,
                    hasc, iso, country_code,
                    lat, lon
                ))
            except sqlite3.IntegrityError as e:
                print(f"      ⚠️  Ya existe: {subdivision_id}")
                continue
        
        conn.commit()
        print(f"      ✅ Nivel 3: {level3_count}")

def process_country(conn, country_iso: str):
    """Procesa un país completo"""
    print(f"\n{'='*60}")
    print(f"🌍 Procesando: {country_iso}")
    print('='*60)
    
    # Directorio del país
    country_dir = GEOJSON_DIR / country_iso
    if not country_dir.exists():
        print(f"❌ Directorio no encontrado: {country_dir}")
        return
    
    # Archivo principal del país
    main_file = country_dir / f"{country_iso}.topojson"
    if not main_file.exists():
        print(f"❌ Archivo principal no encontrado: {main_file}")
        return
    
    # Limpiar subdivisiones existentes
    clear_subdivisions(conn, country_iso)
    
    # Crear nivel 1 (país)
    country_id = create_country_level(conn, country_iso, main_file)
    
    # Procesar nivel 2 (comunidades/estados)
    level2_ids = process_level2(conn, country_iso, main_file)
    
    if not level2_ids:
        print(f"⚠️  No se procesaron subdivisiones nivel 2")
        return
    
    # Procesar nivel 3 (provincias)
    process_level3(conn, country_iso, level2_ids, country_dir)
    
    # Mostrar resumen
    cursor = conn.execute("""
        SELECT level, COUNT(*) as count 
        FROM subdivisions 
        WHERE subdivision_id = ? OR subdivision_id LIKE ? 
        GROUP BY level
    """, (country_iso, f"{country_iso}.%"))
    
    print(f"\n📊 Resumen para {country_iso}:")
    for row in cursor:
        print(f"   Nivel {row['level']}: {row['count']} subdivisiones")

def main():
    """Función principal"""
    print("\n🚀 SCRIPT DE POBLACIÓN DE SUBDIVISIONES")
    print("="*60)
    print(f"📂 Directorio GeoJSON: {GEOJSON_DIR}")
    print(f"💾 Base de datos: {DB_PATH}")
    print("="*60)
    
    # Validar que existen los directorios
    if not GEOJSON_DIR.exists():
        print(f"\n❌ ERROR: Directorio GeoJSON no encontrado: {GEOJSON_DIR}")
        return
    
    if not DB_PATH.exists():
        print(f"\n❌ ERROR: Base de datos no encontrada: {DB_PATH}")
        print("   Ejecuta primero: npm run db:migrate")
        return
    
    # Conectar a BD
    conn = get_db_connection()
    
    try:
        # Procesar España por defecto (puedes añadir más países)
        countries_to_process = ['ESP']
        
        # Preguntar al usuario qué países procesar
        print("\n¿Qué países quieres procesar?")
        print("1. Solo España (ESP)")
        print("2. Todos los países")
        print("3. Lista personalizada")
        
        choice = input("\nOpción (1/2/3) [1]: ").strip() or "1"
        
        if choice == "2":
            # Obtener todos los países de los directorios
            countries_to_process = [d.name for d in GEOJSON_DIR.iterdir() if d.is_dir()]
            countries_to_process.sort()
            print(f"\n📋 Se procesarán {len(countries_to_process)} países")
        elif choice == "3":
            custom = input("Introduce códigos ISO3 separados por coma (ej: ESP,FRA,USA): ").strip()
            countries_to_process = [c.strip().upper() for c in custom.split(',')]
        
        # Procesar cada país
        for country_iso in countries_to_process:
            try:
                process_country(conn, country_iso)
            except Exception as e:
                print(f"\n❌ Error procesando {country_iso}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        # Resumen final
        print("\n" + "="*60)
        print("✅ PROCESO COMPLETADO")
        print("="*60)
        
        # Obtener resumen por país procesado
        summary_data = []
        for country_iso in countries_to_process:
            cursor = conn.execute("""
                SELECT 
                    COUNT(CASE WHEN level = 1 THEN 1 END) as level1,
                    COUNT(CASE WHEN level = 2 THEN 1 END) as level2,
                    COUNT(CASE WHEN level = 3 THEN 1 END) as level3
                FROM subdivisions
                WHERE subdivision_id = ? OR subdivision_id LIKE ?
            """, (country_iso, f"{country_iso}.%"))
            row = cursor.fetchone()
            if row:
                summary_data.append({
                    'iso3': country_iso,
                    'level1': row['level1'],
                    'level2': row['level2'],
                    'level3': row['level3']
                })
        
        print("\n📊 Resumen por país:")
        print(f"{'País':<20} {'Nivel 1':<10} {'Nivel 2':<10} {'Nivel 3':<10}")
        print("-"*60)
        for row in summary_data:
            print(f"{row['iso3']:<20} {row['level1']:<10} {row['level2']:<10} {row['level3']:<10}")
        
        print("\n💡 Siguiente paso:")
        print("   Ejecuta: npm run db:debug-geocode")
        print("   Para verificar que el geocoding funciona correctamente\n")
        
    finally:
        conn.close()

if __name__ == "__main__":
    main()
