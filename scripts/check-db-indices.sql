-- Script de verificación de índices
-- Ejecutar después de aplicar la migración para verificar que los índices se crearon correctamente

-- ========================================
-- VERIFICAR ÍNDICES CREADOS
-- ========================================

-- Listar todos los índices de la tabla votes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'votes'
ORDER BY indexname;

-- Listar todos los índices de la tabla subdivisions
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'subdivisions'
ORDER BY indexname;

-- Listar todos los índices de la tabla polls
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'polls'
ORDER BY indexname;

-- ========================================
-- ESTADÍSTICAS DE TAMAÑO
-- ========================================

-- Tamaño de tablas e índices
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE tablename IN ('votes', 'subdivisions', 'polls', 'poll_options', 'poll_interactions', 'user_followers')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ========================================
-- QUERIES DE PRUEBA CON EXPLAIN
-- ========================================

-- Test 1: Query de votos por encuesta y subdivisión
EXPLAIN ANALYZE
SELECT 
    v.option_id,
    COUNT(*) as vote_count
FROM votes v
WHERE v.poll_id = 1 
  AND v.subdivision_id = 'ESP.8'
GROUP BY v.option_id;

-- Test 2: Query de trending polls
EXPLAIN ANALYZE
SELECT 
    p.id,
    p.title,
    COUNT(v.id) as vote_count
FROM polls p
LEFT JOIN votes v ON p.id = v.poll_id
WHERE p.status = 'active'
  AND v.created_at > NOW() - INTERVAL '7 days'
GROUP BY p.id, p.title
ORDER BY vote_count DESC
LIMIT 20;

-- Test 3: Query de subdivisiones cercanas
EXPLAIN ANALYZE
SELECT 
    subdivision_id,
    name,
    level,
    ((latitude - 40.4168) * (latitude - 40.4168) + 
     (longitude - (-3.7038)) * (longitude - (-3.7038))) as distance
FROM subdivisions
WHERE level = 2
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL
ORDER BY distance
LIMIT 1;

-- Test 4: Query de votos de usuario
EXPLAIN ANALYZE
SELECT 
    v.id,
    v.poll_id,
    v.option_id,
    v.created_at
FROM votes v
WHERE v.user_id = 1
ORDER BY v.created_at DESC
LIMIT 50;

-- ========================================
-- ÍNDICES NO UTILIZADOS
-- ========================================

-- Detectar índices que nunca se usan (útil para cleanup futuro)
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND idx_scan = 0
  AND indexname NOT LIKE 'pk_%'
ORDER BY schemaname, tablename, indexname;

-- ========================================
-- BLOAT DE ÍNDICES
-- ========================================

-- Detectar índices con bloat (fragmentación)
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;
