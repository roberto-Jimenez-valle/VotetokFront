-- Verificar encuestas en la base de datos

-- Ver todas las encuestas con sus detalles
SELECT 
  p.id,
  p.title,
  p.category,
  p.status,
  p.totalVotes as votos,
  p.createdAt as creada,
  p.closedAt as cierra,
  u.displayName as creador,
  COUNT(po.id) as num_opciones
FROM polls p
LEFT JOIN users u ON p.userId = u.id
LEFT JOIN poll_options po ON p.id = po.pollId
GROUP BY p.id
ORDER BY p.id DESC
LIMIT 10;

-- Ver la última encuesta creada con sus opciones
SELECT 
  'ENCUESTA' as tipo,
  p.id,
  p.title,
  p.description,
  p.category,
  p.type,
  p.status,
  p.totalVotes,
  datetime(p.createdAt, 'localtime') as creada,
  datetime(p.closedAt, 'localtime') as cierra,
  CAST((julianday(p.closedAt) - julianday('now')) * 24 AS INTEGER) as horas_restantes
FROM polls p
ORDER BY p.id DESC
LIMIT 1;

SELECT 
  'OPCIONES' as tipo,
  po.id,
  po.optionLabel,
  po.color,
  po.voteCount,
  po.displayOrder
FROM poll_options po
WHERE po.pollId = (SELECT MAX(id) FROM polls)
ORDER BY po.displayOrder;

-- Ver hashtags de la última encuesta
SELECT 
  'HASHTAGS' as tipo,
  h.tag,
  h.usageCount
FROM poll_hashtags ph
JOIN hashtags h ON ph.hashtagId = h.id
WHERE ph.pollId = (SELECT MAX(id) FROM polls);

-- Estadísticas generales
SELECT 
  'ESTADÍSTICAS' as info,
  COUNT(*) as total_encuestas,
  SUM(totalVotes) as total_votos,
  COUNT(CASE WHEN closedAt IS NOT NULL THEN 1 END) as con_tiempo_limite,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as activas
FROM polls;
