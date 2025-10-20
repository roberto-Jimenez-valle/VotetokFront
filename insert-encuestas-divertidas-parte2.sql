-- Continuación: Encuestas 6-20

-- ===========================================
-- 6. ¿Mejor saga de películas?
-- ===========================================
INSERT INTO polls (user_id, title, description, category, type, status, created_at, updated_at) 
VALUES (1, '¿Mejor saga de películas?', 'La batalla de las franquicias épicas', 'Cine', 'poll', 'active', datetime('now', '-2 days'), datetime('now', '-2 days'));

INSERT INTO poll_options (poll_id, option_key, option_label, color, display_order) VALUES
((SELECT id FROM polls WHERE title = '¿Mejor saga de películas?'), 'starwars', 'Star Wars', '#3b82f6', 1),
((SELECT id FROM polls WHERE title = '¿Mejor saga de películas?'), 'lotr', 'El Señor de los Anillos', '#10b981', 2),
((SELECT id FROM polls WHERE title = '¿Mejor saga de películas?'), 'marvel', 'Marvel (MCU)', '#ef4444', 3),
((SELECT id FROM polls WHERE title = '¿Mejor saga de películas?'), 'hp', 'Harry Potter', '#8b5cf6', 4);

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Mejor saga de películas?'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Mejor saga de películas?') AND option_key = 'starwars'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 2) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2) c LIMIT 220;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Mejor saga de películas?'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Mejor saga de películas?') AND option_key = 'lotr'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 2) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3) c LIMIT 360;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Mejor saga de películas?'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Mejor saga de películas?') AND option_key = 'marvel'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 2) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3) c LIMIT 280;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Mejor saga de películas?'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Mejor saga de películas?') AND option_key = 'hp'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 2) || ' days')
FROM (SELECT 1 UNION SELECT 2) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2) c LIMIT 140;

-- ===========================================
-- 7. ¿Cómo te gusta el café?
-- ===========================================
INSERT INTO polls (user_id, title, description, category, type, status, created_at, updated_at) 
VALUES (1, '¿Cómo te gusta el café? ☕', 'La pregunta del millón cada mañana', 'Comida', 'poll', 'active', datetime('now', '-8 days'), datetime('now', '-8 days'));

INSERT INTO poll_options (poll_id, option_key, option_label, color, display_order) VALUES
((SELECT id FROM polls WHERE title = '¿Cómo te gusta el café? ☕'), 'solo', 'Solo (negro)', '#1f2937', 1),
((SELECT id FROM polls WHERE title = '¿Cómo te gusta el café? ☕'), 'leche', 'Con leche', '#a0522d', 2),
((SELECT id FROM polls WHERE title = '¿Cómo te gusta el café? ☕'), 'cortado', 'Cortado/Cappuccino', '#8b4513', 3),
((SELECT id FROM polls WHERE title = '¿Cómo te gusta el café? ☕'), 'no_cafe', 'No tomo café', '#6b7280', 4);

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Cómo te gusta el café? ☕'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Cómo te gusta el café? ☕') AND option_key = 'solo'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 8) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3) c LIMIT 280;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Cómo te gusta el café? ☕'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Cómo te gusta el café? ☕') AND option_key = 'leche'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 8) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) c LIMIT 380;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Cómo te gusta el café? ☕'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Cómo te gusta el café? ☕') AND option_key = 'cortado'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 8) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2) c LIMIT 250;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Cómo te gusta el café? ☕'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Cómo te gusta el café? ☕') AND option_key = 'no_cafe'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 8) || ' days')
FROM (SELECT 1 UNION SELECT 2) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) b LIMIT 90;

-- ===========================================
-- 8. ¿Mejor década para la música?
-- ===========================================
INSERT INTO polls (user_id, title, description, category, type, status, created_at, updated_at) 
VALUES (1, '¿Mejor década para la música? 🎵', '¿Cuándo sonaba mejor todo?', 'Música', 'poll', 'active', datetime('now', '-10 days'), datetime('now', '-10 days'));

INSERT INTO poll_options (poll_id, option_key, option_label, color, display_order) VALUES
((SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵'), '70s', 'Años 70 (Rock/Disco)', '#f59e0b', 1),
((SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵'), '80s', 'Años 80 (Pop/New Wave)', '#ec4899', 2),
((SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵'), '90s', 'Años 90 (Grunge/Hip Hop)', '#8b5cf6', 3),
((SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵'), '2000s', 'Años 2000-2010', '#3b82f6', 4),
((SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵'), 'actual', 'Música actual', '#10b981', 5);

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵') AND option_key = '70s'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 10) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) b LIMIT 150;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵') AND option_key = '80s'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 10) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2) c LIMIT 280;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵') AND option_key = '90s'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 10) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3) c LIMIT 340;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵') AND option_key = '2000s'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 10) || ' days')
FROM (SELECT 1 UNION SELECT 2) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b LIMIT 140;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Mejor década para la música? 🎵') AND option_key = 'actual'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 10) || ' days')
FROM (SELECT 1 UNION SELECT 2) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3) b LIMIT 90;

-- ===========================================
-- 9. ¿Trabajar desde casa o en oficina?
-- ===========================================
INSERT INTO polls (user_id, title, description, category, type, status, created_at, updated_at) 
VALUES (1, '¿Trabajar desde casa o en oficina? 💼', 'El debate post-pandemia', 'Trabajo', 'poll', 'active', datetime('now', '-1 day'), datetime('now', '-1 day'));

INSERT INTO poll_options (poll_id, option_key, option_label, color, display_order) VALUES
((SELECT id FROM polls WHERE title = '¿Trabajar desde casa o en oficina? 💼'), 'casa', '🏠 100% remoto', '#10b981', 1),
((SELECT id FROM polls WHERE title = '¿Trabajar desde casa o en oficina? 💼'), 'oficina', '🏢 100% oficina', '#3b82f6', 2),
((SELECT id FROM polls WHERE title = '¿Trabajar desde casa o en oficina? 💼'), 'hibrido', '⚖️ Híbrido', '#f59e0b', 3);

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Trabajar desde casa o en oficina? 💼'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Trabajar desde casa o en oficina? 💼') AND option_key = 'casa'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 24) || ' hours')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) c LIMIT 520;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Trabajar desde casa o en oficina? 💼'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Trabajar desde casa o en oficina? 💼') AND option_key = 'oficina'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 24) || ' hours')
FROM (SELECT 1 UNION SELECT 2) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) b LIMIT 120;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Trabajar desde casa o en oficina? 💼'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Trabajar desde casa o en oficina? 💼') AND option_key = 'hibrido'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 24) || ' hours')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3) c LIMIT 360;

-- ===========================================
-- 10. ¿Dónde te irías a vivir?
-- ===========================================
INSERT INTO polls (user_id, title, description, category, type, status, created_at, updated_at) 
VALUES (1, '¿Dónde te irías a vivir? 🌍', 'Si pudieras elegir cualquier lugar del mundo', 'Viajes', 'poll', 'active', datetime('now', '-9 days'), datetime('now', '-9 days'));

INSERT INTO poll_options (poll_id, option_key, option_label, color, display_order) VALUES
((SELECT id FROM polls WHERE title = '¿Dónde te irías a vivir? 🌍'), 'playa', '🏖️ Cerca de la playa', '#3b82f6', 1),
((SELECT id FROM polls WHERE title = '¿Dónde te irías a vivir? 🌍'), 'montana', '🏔️ En las montañas', '#10b981', 2),
((SELECT id FROM polls WHERE title = '¿Dónde te irías a vivir? 🌍'), 'ciudad', '🌆 Gran ciudad', '#f59e0b', 3),
((SELECT id FROM polls WHERE title = '¿Dónde te irías a vivir? 🌍'), 'pueblo', '🏡 Pueblo tranquilo', '#8b5cf6', 4);

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Dónde te irías a vivir? 🌍'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Dónde te irías a vivir? 🌍') AND option_key = 'playa'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 9) || ' days')
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) c LIMIT 450;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Dónde te irías a vivir? 🌍'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Dónde te irías a vivir? 🌍') AND option_key = 'montana'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 9) || ' days')
FROM (SELECT 1 UNION SELECT 2) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2) c LIMIT 180;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Dónde te irías a vivir? 🌍'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Dónde te irías a vivir? 🌍') AND option_key = 'ciudad'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 9) || ' days')
FROM (SELECT 1 UNION SELECT 2) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) b, (SELECT 1 UNION SELECT 2 UNION SELECT 3) c LIMIT 240;

INSERT INTO votes (poll_id, option_id, latitude, longitude, subdivision_id, created_at)
SELECT (SELECT id FROM polls WHERE title = '¿Dónde te irías a vivir? 🌍'),
    (SELECT id FROM poll_options WHERE poll_id = (SELECT id FROM polls WHERE title = '¿Dónde te irías a vivir? 🌍') AND option_key = 'pueblo'),
    40.4168 + (RANDOM() % 100) / 100.0, -3.7038 + (RANDOM() % 100) / 100.0, 65101, datetime('now', '-' || (RANDOM() % 9) || ' days')
FROM (SELECT 1 UNION SELECT 2) a, (SELECT 1 UNION SELECT 2 UNION SELECT 3) b LIMIT 130;

-- Continúo con las 10 restantes...
