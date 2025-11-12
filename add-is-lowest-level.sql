-- Agregar campo isLowestLevel a la tabla subdivisions
ALTER TABLE subdivisions 
ADD COLUMN IF NOT EXISTS is_lowest_level BOOLEAN DEFAULT FALSE;

-- Agregar índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_subdivisions_is_lowest_level 
ON subdivisions(is_lowest_level) 
WHERE is_lowest_level = true;

-- Comentario
COMMENT ON COLUMN subdivisions.is_lowest_level IS 'Indica si esta subdivisión es el último nivel disponible (no tiene subniveles)';
