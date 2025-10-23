-- Script para que TODOS los usuarios voten por "teletransporte" en la encuesta de superpoderes
-- ¿Cuál es tu superpoder ideal?

-- Primero verificamos que existe la encuesta y la opción
SELECT 
    p.id as poll_id,
    p.title,
    po.id as option_id,
    po.option_label
FROM polls p
JOIN poll_options po ON po.poll_id = p.id
WHERE p.title = '¿Cuál es tu superpoder ideal?'
  AND po.option_key = 'teletransporte';

-- Crear votos para TODOS los usuarios hacia "teletransporte"
-- Nota: Esto elimina votos previos del mismo usuario en esta encuesta para evitar duplicados
DELETE FROM votes 
WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?')
  AND user_id IN (SELECT id FROM users);

-- Insertar votos de todos los usuarios
INSERT INTO votes (poll_id, option_id, user_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?') AND option_key = 'teletransporte'),
    u.id,
    40.4168 + (RANDOM() % 10) / 10.0,  -- Madrid con variación pequeña
    -3.7038 + (RANDOM() % 10) / 10.0,
    65101,  -- Comunidad de Madrid
    datetime('now')
FROM users u;

-- Verificar los votos creados
SELECT 
    u.username,
    u.display_name,
    po.option_label,
    v.created_at
FROM votes v
JOIN users u ON v.user_id = u.id
JOIN poll_options po ON v.option_id = po.id
WHERE v.poll_id = (SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?')
ORDER BY v.created_at DESC;
