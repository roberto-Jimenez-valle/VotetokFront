-- ===============================================
-- OPTIMIZACIÓN DE ÍNDICES PARA POSTGRESQL
-- VouTop Database Performance Optimization
-- ===============================================

-- ===============================================
-- 1. ÍNDICES GEOGRÁFICOS CRÍTICOS
-- ===============================================

-- Índice GiST para búsquedas geográficas en subdivisiones
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subdivisions_location 
ON subdivisions USING GIST (point(longitude, latitude))
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Índice para queries jerárquicas de subdivisiones
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subdivisions_hierarchy 
ON subdivisions (level, parent_id, country_iso)
WHERE parent_id IS NOT NULL;

-- Índice compuesto para navegación geográfica
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subdivisions_nav
ON subdivisions (country_iso, level, subdivision_id);

-- ===============================================
-- 2. OPTIMIZACIÓN DE QUERIES DE VOTACIÓN
-- ===============================================

-- Índice compuesto para agregaciones de votos por región
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_geo_aggregation
ON votes (poll_id, subdivision_id)
INCLUDE (option_id)
WHERE subdivision_id IS NOT NULL;

-- Índice para votaciones recientes (últimos 7 días)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_recent
ON votes (created_at DESC, poll_id)
WHERE created_at > CURRENT_DATE - INTERVAL '7 days';

-- Índice parcial para votos de usuarios registrados
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_registered_users
ON votes (user_id, poll_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- ===============================================
-- 3. OPTIMIZACIÓN DE ENCUESTAS TRENDING
-- ===============================================

-- Índice para queries de trending con filtros
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_polls_trending
ON polls (status, created_at DESC, total_votes DESC)
WHERE status = 'active';

-- Índice para encuestas por categoría activas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_polls_category_active
ON polls (category, status, created_at DESC)
WHERE status = 'active' AND category IS NOT NULL;

-- Índice para encuestas de usuario específico
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_polls_user_recent
ON polls (user_id, status, created_at DESC);

-- ===============================================
-- 4. OPTIMIZACIÓN DE SISTEMA DE NOTIFICACIONES
-- ===============================================

-- Índice para notificaciones no leídas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread
ON notifications (user_id, read, created_at DESC)
WHERE read = false;

-- Índice para limpieza de notificaciones antiguas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_cleanup
ON notifications (created_at)
WHERE created_at < CURRENT_DATE - INTERVAL '30 days';

-- ===============================================
-- 5. OPTIMIZACIÓN DE FOLLOWERS
-- ===============================================

-- Índice para queries de followers/following
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_followers_bidirectional
ON user_followers (follower_id, following_id);

-- Índice inverso para queries de "quién me sigue"
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_followers_reverse
ON user_followers (following_id, follower_id);

-- ===============================================
-- 6. ÍNDICES DE BÚSQUEDA FULL-TEXT
-- ===============================================

-- Índice GIN para búsqueda en títulos de encuestas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_polls_title_search
ON polls USING GIN (to_tsvector('spanish', title));

-- Índice GIN para búsqueda en nombres de usuario
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_search
ON users USING GIN (to_tsvector('simple', username || ' ' || display_name));

-- ===============================================
-- 7. ÍNDICES DE ESTADÍSTICAS Y AGREGACIONES
-- ===============================================

-- Índice para conteo rápido de votos por opción
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_option_count
ON votes (option_id, poll_id);

-- Índice para historial de votación
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vote_history_lookup
ON vote_history (poll_id, recorded_at DESC);

-- ===============================================
-- 8. LIMPIEZA DE ÍNDICES REDUNDANTES
-- ===============================================

-- Identificar índices duplicados (ejecutar manualmente)
SELECT 
    idx.schemaname,
    idx.tablename,
    idx.indexname,
    idx.indexdef,
    pg_size_pretty(pg_relation_size(idx.indexname::regclass)) as size
FROM pg_indexes idx
WHERE idx.schemaname = 'public'
ORDER BY idx.tablename, idx.indexname;

-- Identificar índices no utilizados (ejecutar después de período de uso)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND idx_scan = 0
    AND indexname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- ===============================================
-- 9. MATERIALIZED VIEWS PARA AGREGACIONES
-- ===============================================

-- Vista materializada para estadísticas de países
CREATE MATERIALIZED VIEW IF NOT EXISTS country_vote_stats AS
SELECT 
    v.poll_id,
    s.country_iso,
    v.option_id,
    COUNT(*) as vote_count,
    COUNT(DISTINCT v.user_id) as unique_voters
FROM votes v
JOIN subdivisions s ON v.subdivision_id = s.subdivision_id
WHERE v.created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY v.poll_id, s.country_iso, v.option_id
WITH DATA;

-- Índice en la vista materializada
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_country_vote_stats_lookup
ON country_vote_stats (poll_id, country_iso);

-- Refresh policy (ejecutar con pg_cron o similar)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY country_vote_stats;

-- Vista materializada para trending polls
CREATE MATERIALIZED VIEW IF NOT EXISTS trending_polls_cache AS
SELECT 
    p.*,
    COUNT(DISTINCT v.user_id) as unique_voters,
    COUNT(v.id) as total_votes_calc,
    MAX(v.created_at) as last_vote_time
FROM polls p
LEFT JOIN votes v ON p.id = v.poll_id
WHERE p.status = 'active'
    AND p.created_at > CURRENT_DATE - INTERVAL '7 days'
GROUP BY p.id
ORDER BY total_votes_calc DESC, p.created_at DESC
LIMIT 100
WITH DATA;

-- Índice para búsqueda rápida
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trending_polls_cache
ON trending_polls_cache (id);

-- ===============================================
-- 10. CONFIGURACIÓN DE AUTOVACUUM
-- ===============================================

-- Configurar autovacuum más agresivo para tablas de alta escritura
ALTER TABLE votes SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.05,
    autovacuum_vacuum_cost_delay = 10
);

ALTER TABLE polls SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE notifications SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.1
);

-- ===============================================
-- 11. PARTICIONAMIENTO PARA TABLAS GRANDES
-- ===============================================

-- Ejemplo de particionamiento para votes por fecha (opcional)
/*
-- Crear tabla particionada
CREATE TABLE votes_partitioned (
    LIKE votes INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Crear particiones mensuales
CREATE TABLE votes_2024_01 PARTITION OF votes_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE votes_2024_02 PARTITION OF votes_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Migrar datos existentes
INSERT INTO votes_partitioned SELECT * FROM votes;

-- Renombrar tablas
ALTER TABLE votes RENAME TO votes_old;
ALTER TABLE votes_partitioned RENAME TO votes;
*/

-- ===============================================
-- 12. FUNCIONES DE UTILIDAD
-- ===============================================

-- Función para obtener estadísticas de índices
CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE(
    table_name text,
    index_name text,
    index_size text,
    index_scans bigint,
    rows_read_per_scan numeric,
    efficiency_score numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname || '.' || tablename as table_name,
        indexname as index_name,
        pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size,
        idx_scan as index_scans,
        CASE 
            WHEN idx_scan > 0 THEN round((idx_tup_read::numeric / idx_scan), 2)
            ELSE 0
        END as rows_read_per_scan,
        CASE
            WHEN idx_scan > 0 THEN round((idx_tup_fetch::numeric / idx_tup_read) * 100, 2)
            ELSE 0
        END as efficiency_score
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    ORDER BY idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener queries lentas
CREATE OR REPLACE FUNCTION get_slow_queries(duration_ms integer DEFAULT 100)
RETURNS TABLE(
    query_text text,
    calls bigint,
    total_time numeric,
    mean_time numeric,
    max_time numeric
) AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
        RETURN QUERY
        SELECT 
            substr(query, 1, 100) as query_text,
            calls,
            round(total_time::numeric, 2) as total_time,
            round(mean_time::numeric, 2) as mean_time,
            round(max_time::numeric, 2) as max_time
        FROM pg_stat_statements
        WHERE mean_time > duration_ms
        ORDER BY mean_time DESC
        LIMIT 20;
    ELSE
        RAISE NOTICE 'pg_stat_statements extension not installed';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- 13. MONITOREO Y MANTENIMIENTO
-- ===============================================

-- Vista para monitoreo de salud de la BD
CREATE OR REPLACE VIEW database_health AS
SELECT 
    'Total Size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value
UNION ALL
SELECT 
    'Tables Count',
    COUNT(*)::text
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 
    'Indexes Count',
    COUNT(*)::text
FROM pg_indexes
WHERE schemaname = 'public'
UNION ALL
SELECT 
    'Active Connections',
    COUNT(*)::text
FROM pg_stat_activity
WHERE state = 'active'
UNION ALL
SELECT 
    'Cache Hit Ratio',
    ROUND(
        SUM(heap_blks_hit)::numeric / 
        (SUM(heap_blks_hit) + SUM(heap_blks_read)) * 100, 2
    )::text || '%'
FROM pg_statio_user_tables;

-- ===============================================
-- INSTRUCCIONES DE EJECUCIÓN
-- ===============================================

-- 1. Ejecutar este script en la base de datos de producción:
--    psql -U usuario -d voutop_db -f indexes-optimization.sql

-- 2. Monitorear el progreso:
--    SELECT * FROM pg_stat_progress_create_index;

-- 3. Verificar índices creados:
--    SELECT * FROM get_index_usage_stats();

-- 4. Actualizar estadísticas:
--    ANALYZE;

-- 5. Programar refresh de vistas materializadas (cron):
--    0 */4 * * * psql -U usuario -d voutop_db -c "REFRESH MATERIALIZED VIEW CONCURRENTLY country_vote_stats;"
--    */10 * * * * psql -U usuario -d voutop_db -c "REFRESH MATERIALIZED VIEW CONCURRENTLY trending_polls_cache;"

-- ===============================================
-- FIN DEL SCRIPT DE OPTIMIZACIÓN
-- ===============================================
