-- Script para insertar 20 encuestas divertidas con votos realistas
-- Cada encuesta tendrá aproximadamente 1000 votos distribuidos

-- ===========================================
-- 1. ¿Cuál es tu superpoder ideal?
-- ===========================================
INSERT INTO polls (user_id, title, description, category, type, status, created_at, updated_at) 
VALUES (1, '¿Cuál es tu superpoder ideal?', 'Si pudieras elegir un superpoder, ¿cuál sería?', 'Entretenimiento', 'poll', 'active', datetime('now', '-5 days'), datetime('now', '-5 days'));

INSERT INTO poll_options (poll_id, option_key, option_label, color, display_order) VALUES
((SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?'), 'volar', 'Volar', '#3b82f6', 1),
((SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?'), 'invisible', 'Invisibilidad', '#8b5cf6', 2),
((SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?'), 'teletransporte', 'Teletransportación', '#ec4899', 3),
((SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?'), 'leer_mentes', 'Leer mentes', '#f59e0b', 4);

-- Distribuir ~1000 votos
INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?') AND option_key = 'volar'),
    40.4168 + (RANDOM() % 100) / 100.0,
    -3.7038 + (RANDOM() % 100) / 100.0,
    65101,
    datetime('now', '-' || (RANDOM() % 5) || ' days', '-' || (RANDOM() % 24) || ' hours')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a,
     (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b,
     (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) c
LIMIT 320;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?') AND option_key = 'teletransporte'),
    40.4168 + (RANDOM() % 100) / 100.0,
    -3.7038 + (RANDOM() % 100) / 100.0,
    65101,
    datetime('now', '-' || (RANDOM() % 5) || ' days', '-' || (RANDOM() % 24) || ' hours')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a,
     (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b,
     (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) c
LIMIT 380;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?') AND option_key = 'invisible'),
    40.4168 + (RANDOM() % 100) / 100.0,
    -3.7038 + (RANDOM() % 100) / 100.0,
    65101,
    datetime('now', '-' || (RANDOM() % 5) || ' days', '-' || (RANDOM() % 24) || ' hours')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a,
     (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b,
     (SELECT 1 UNION SELECT 2) c
LIMIT 200;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Cuál es tu superpoder ideal?') AND option_key = 'leer_mentes'),
    40.4168 + (RANDOM() % 100) / 100.0,
    -3.7038 + (RANDOM() % 100) / 100.0,
    65101,
    datetime('now', '-' || (RANDOM() % 5) || ' days', '-' || (RANDOM() % 24) || ' hours')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a,
     (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) b
LIMIT 100;

-- ===========================================
-- 2. ¿Qué harías primero si ganaras la lotería?
-- ===========================================
INSERT INTO polls (user_id, title, description, category, type, status, created_at, updated_at) 
VALUES (1, '¿Qué harías primero si ganaras la lotería?', 'Imagina que ganas 10 millones de euros...', 'Lifestyle', 'poll', 'active', datetime('now', '-4 days'), datetime('now', '-4 days'));

INSERT INTO poll_options (poll_id, option_key, option_label, color, display_order) VALUES
((SELECT id FROM polls WHERE title = '¿Qué harías primero si ganaras la lotería?'), 'viajar', 'Viajar por el mundo', '#10b981', 1),
((SELECT id FROM polls WHERE title = '¿Qué harías primero si ganaras la lotería?'), 'casa', 'Comprar casa de ensueño', '#3b82f6', 2),
((SELECT id FROM polls WHERE title = '¿Qué harías primero si ganaras la lotería?'), 'ayudar', 'Ayudar a familia/amigos', '#f59e0b', 3),
((SELECT id FROM polls WHERE title = '¿Qué harías primero si ganaras la lotería?'), 'invertir', 'Invertir sabiamente', '#8b5cf6', 4);

-- Votos distribuidos (~1050)
INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Qué harías primero si ganaras la lotería?'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Qué harías primero si ganaras la lotería?') AND option_key = 'viajar'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 4) || ' days', '-' || (RANDOM() % 24) || ' hours')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) c
LIMIT 420;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Qué harías primero si ganaras la lotería?'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Qué harías primero si ganaras la lotería?') AND option_key = 'casa'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 4) || ' days', '-' || (RANDOM() % 24) || ' hours')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3) c
LIMIT 280;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Qué harías primero si ganaras la lotería?'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Qué harías primero si ganaras la lotería?') AND option_key = 'ayudar'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 4) || ' days', '-' || (RANDOM() % 24) || ' hours')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2) c
LIMIT 220;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Qué harías primero si ganaras la lotería?'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Qué harías primero si ganaras la lotería?') AND option_key = 'invertir'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 4) || ' days', '-' || (RANDOM() % 24) || ' hours')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) b
LIMIT 130;

-- ===========================================
-- 3. ¿Piña en la pizza?
-- ===========================================
INSERT INTO polls (user_id, title, description, category, type, status, created_at, updated_at) 
VALUES (1, '¿Piña en la pizza? 🍕🍍', 'El debate eterno que divide a la humanidad', 'Comida', 'poll', 'active', datetime('now', '-3 days'), datetime('now', '-3 days'));

INSERT INTO poll_options (poll_id, option_key, option_label, color, display_order) VALUES
((SELECT id FROM polls WHERE title = '¿Piña en la pizza? 🍕🍍'), 'si', '¡Sí! Es deliciosa', '#10b981', 1),
((SELECT id FROM polls WHERE title = '¿Piña en la pizza? 🍕🍍'), 'no', 'No, es un crimen', '#ef4444', 2),
((SELECT id FROM polls WHERE title = '¿Piña en la pizza? 🍕🍍'), 'depende', 'Depende del día', '#f59e0b', 3);

-- Votos muy polarizados
INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Piña en la pizza? 🍕🍍'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Piña en la pizza? 🍕🍍') AND option_key = 'si'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 3) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3) c
LIMIT 350;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Piña en la pizza? 🍕🍍'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Piña en la pizza? 🍕🍍') AND option_key = 'no'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 3) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) c
LIMIT 580;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Piña en la pizza? 🍕🍍'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Piña en la pizza? 🍕🍍') AND option_key = 'depende'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 3) || ' days')
FROM (SELECT 1 UNION SELECT 2) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) b
LIMIT 70;

-- ===========================================
-- 4. ¿Mejor forma de comer Oreo?
-- ===========================================
INSERT INTO polls (user_id, title, description, category, type, status, created_at, updated_at) 
VALUES (1, '¿Mejor forma de comer Oreo? 🍪', '¿Cómo disfrutas tu galleta favorita?', 'Comida', 'poll', 'active', datetime('now', '-6 days'), datetime('now', '-6 days'));

INSERT INTO poll_options (poll_id, option_key, option_label, color, display_order) VALUES
((SELECT id FROM polls WHERE title = '¿Mejor forma de comer Oreo? 🍪'), 'entera', 'Entera de un bocado', '#8b5cf6', 1),
((SELECT id FROM polls WHERE title = '¿Mejor forma de comer Oreo? 🍪'), 'separar', 'Separar y lamer crema', '#ec4899', 2),
((SELECT id FROM polls WHERE title = '¿Mejor forma de comer Oreo? 🍪'), 'leche', 'Mojar en leche', '#3b82f6', 3),
((SELECT id FROM polls WHERE title = '¿Mejor forma de comer Oreo? 🍪'), 'postre', 'En postres/batidos', '#f59e0b', 4);

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Mejor forma de comer Oreo? 🍪'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Mejor forma de comer Oreo? 🍪') AND option_key = 'entera'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 6) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2) c
LIMIT 180;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Mejor forma de comer Oreo? 🍪'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Mejor forma de comer Oreo? 🍪') AND option_key = 'separar'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 6) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3) c
LIMIT 290;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Mejor forma de comer Oreo? 🍪'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Mejor forma de comer Oreo? 🍪') AND option_key = 'leche'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 6) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) c
LIMIT 440;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Mejor forma de comer Oreo? 🍪'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Mejor forma de comer Oreo? 🍪') AND option_key = 'postre'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 6) || ' days')
FROM (SELECT 1 UNION SELECT 2) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) b
LIMIT 90;

-- ===========================================
-- 5. ¿Perro o gato?
-- ===========================================
INSERT INTO polls (user_id, title, description, category, type, status, created_at, updated_at) 
VALUES (1, '¿Perro o gato? 🐶🐱', 'El eterno debate de las mascotas', 'Mascotas', 'poll', 'active', datetime('now', '-7 days'), datetime('now', '-7 days'));

INSERT INTO poll_options (poll_id, option_key, option_label, color, display_order) VALUES
((SELECT id FROM polls WHERE title = '¿Perro o gato? 🐶🐱'), 'perro', '🐶 Team Perros', '#f59e0b', 1),
((SELECT id FROM polls WHERE title = '¿Perro o gato? 🐶🐱'), 'gato', '🐱 Team Gatos', '#8b5cf6', 2),
((SELECT id FROM polls WHERE title = '¿Perro o gato? 🐶🐱'), 'ambos', 'Ambos son geniales', '#10b981', 3),
((SELECT id FROM polls WHERE title = '¿Perro o gato? 🐶🐱'), 'ninguno', 'Prefiero otras mascotas', '#6b7280', 4);

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Perro o gato? 🐶🐱'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Perro o gato? 🐶🐱') AND option_key = 'perro'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 7) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) c
LIMIT 480;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Perro o gato? 🐶🐱'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Perro o gato? 🐶🐱') AND option_key = 'gato'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 7) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3) c
LIMIT 380;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Perro o gato? 🐶🐱'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Perro o gato? 🐶🐱') AND option_key = 'ambos'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 7) || ' days')
FROM (SELECT 1 UNION SELECT 2) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) b
LIMIT 120;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT 
    (SELECT id FROM polls WHERE title = '¿Perro o gato? 🐶🐱'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Perro o gato? 🐶🐱') AND option_key = 'ninguno'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101,
    datetime('now', '-' || (RANDOM() % 7) || ' days')
FROM (SELECT 1 UNION SELECT 2) a, (SELECT 1 UNION SELECT 2) b
LIMIT 20;

-- Continúo con más encuestas en siguientes comentarios...
