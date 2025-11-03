-- Migration: Optimizar índices para queries críticas
-- Fecha: 2025-11-03
-- Descripción: Añade índices compuestos para mejorar performance de queries frecuentes

-- ========================================
-- TABLA: votes (CRÍTICA)
-- ========================================

-- Índice compuesto para queries de votos por encuesta y subdivisión
-- Usado en: /api/polls/[id]/votes-by-subdivisions
CREATE INDEX IF NOT EXISTS "idx_votes_poll_subdivision" ON "votes"("poll_id", "subdivision_id");

-- Índice compuesto para queries de votos por encuesta y país
-- Usado en: /api/polls/[id]/votes-by-country
CREATE INDEX IF NOT EXISTS "idx_votes_poll_country" ON "votes"("poll_id", "subdivision_id") 
WHERE "subdivision_id" IN (SELECT "subdivision_id" FROM "subdivisions" WHERE "level" = 1);

-- Índice para trending polls (ordenados por fecha)
-- Usado en: /api/polls/trending
CREATE INDEX IF NOT EXISTS "idx_votes_poll_created_desc" ON "votes"("poll_id", "created_at" DESC);

-- Índice compuesto para agregaciones de votos por opción y subdivisión
-- Usado en: computeSubdivisionColorsFromDatabase
CREATE INDEX IF NOT EXISTS "idx_votes_option_subdivision" ON "votes"("option_id", "subdivision_id");

-- Índice para búsqueda de votos por usuario y encuesta (evitar duplicados)
-- Usado en: validación de voto único
CREATE INDEX IF NOT EXISTS "idx_votes_user_poll_created" ON "votes"("user_id", "poll_id", "created_at" DESC) 
WHERE "user_id" IS NOT NULL;

-- Índice para búsqueda de votos por IP (encuestas sin login)
-- Usado en: validación de voto único por IP
CREATE INDEX IF NOT EXISTS "idx_votes_ip_poll_created" ON "votes"("ip_address", "poll_id", "created_at" DESC) 
WHERE "ip_address" IS NOT NULL;

-- ========================================
-- TABLA: subdivisions
-- ========================================

-- Índice para búsquedas jerárquicas (nivel 2 dentro de nivel 1)
-- Usado en: navegación geográfica
CREATE INDEX IF NOT EXISTS "idx_subdivisions_level1_id" ON "subdivisions"("level1_id") 
WHERE "level1_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_subdivisions_level2_id" ON "subdivisions"("level2_id") 
WHERE "level2_id" IS NOT NULL;

-- Índice compuesto para búsquedas por país y nivel
-- Usado en: loadCountryPolygons
CREATE INDEX IF NOT EXISTS "idx_subdivisions_country_level" ON "subdivisions"("subdivision_id", "level");

-- Índice espacial para búsquedas geográficas (preparación para PostGIS)
-- NOTA: Actualmente usa cálculo euclidiano, optimizar con PostGIS en futuro
CREATE INDEX IF NOT EXISTS "idx_subdivisions_level_lat_lon" ON "subdivisions"("level", "latitude", "longitude") 
WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;

-- ========================================
-- TABLA: polls
-- ========================================

-- Índice compuesto para búsqueda de encuestas activas por usuario
-- Usado en: /api/polls?userId=X
CREATE INDEX IF NOT EXISTS "idx_polls_user_status_created" ON "polls"("user_id", "status", "created_at" DESC);

-- Índice para encuestas activas por categoría
-- Usado en: /api/polls?category=X
CREATE INDEX IF NOT EXISTS "idx_polls_category_status_created" ON "polls"("category", "status", "created_at" DESC) 
WHERE "status" = 'active';

-- Índice para búsqueda de rells (tipo especial de encuesta)
CREATE INDEX IF NOT EXISTS "idx_polls_isrell_status" ON "polls"("is_rell", "status", "created_at" DESC);

-- ========================================
-- TABLA: poll_options
-- ========================================

-- Índice para carga eficiente de opciones con conteo de votos
-- Usado en: queries con JOIN a votes
CREATE INDEX IF NOT EXISTS "idx_poll_options_poll_display" ON "poll_options"("poll_id", "display_order");

-- ========================================
-- TABLA: poll_interactions
-- ========================================

-- Índice compuesto para búsqueda de interacciones por usuario y encuesta
-- Usado en: verificación de likes/shares
CREATE INDEX IF NOT EXISTS "idx_interactions_user_poll_type" ON "poll_interactions"("user_id", "poll_id", "interaction_type");

-- Índice para conteo de interacciones por encuesta
-- Usado en: estadísticas de encuestas
CREATE INDEX IF NOT EXISTS "idx_interactions_poll_type_created" ON "poll_interactions"("poll_id", "interaction_type", "created_at" DESC);

-- ========================================
-- TABLA: user_followers
-- ========================================

-- Índice para búsqueda eficiente de seguidores
CREATE INDEX IF NOT EXISTS "idx_followers_following_follower" ON "user_followers"("following_id", "follower_id");

-- Índice inverso para búsqueda de seguidos
CREATE INDEX IF NOT EXISTS "idx_followers_follower_following" ON "user_followers"("follower_id", "following_id");

-- ========================================
-- NOTAS PARA OPTIMIZACIONES FUTURAS
-- ========================================

-- TODO: Considerar implementar PostGIS para búsquedas geoespaciales
-- ALTER TABLE subdivisions ADD COLUMN geom geometry(Point, 4326);
-- CREATE INDEX idx_subdivisions_geom ON subdivisions USING GIST (geom);
-- UPDATE subdivisions SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);

-- TODO: Considerar particionado de tabla votes por fecha
-- CREATE TABLE votes_2024_11 PARTITION OF votes FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

-- TODO: Analizar queries con EXPLAIN ANALYZE después de aplicar índices
-- EXPLAIN ANALYZE SELECT * FROM votes WHERE poll_id = 1 AND subdivision_id = 'ESP.8';

-- ========================================
-- ESTADÍSTICAS
-- ========================================

-- Actualizar estadísticas de tablas para que el query planner use los nuevos índices
ANALYZE votes;
ANALYZE subdivisions;
ANALYZE polls;
ANALYZE poll_options;
ANALYZE poll_interactions;
ANALYZE user_followers;
