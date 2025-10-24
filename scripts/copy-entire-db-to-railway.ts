/**
 * Copia TODA la base de datos local a Railway
 * Más rápido que hacer seed
 */

import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const prismaRailway = new PrismaClient();

async function copyEntireDatabase() {
  try {
    console.log('📊 Abriendo base de datos LOCAL (SQLite)...');
    const db = new Database('./prisma/dev.db', { readonly: true });
    
    // 1. USERS (crear uno por uno para obtener mapeo de IDs)
    console.log('\n👥 Copiando usuarios...');
    const users = db.prepare('SELECT * FROM users').all() as any[];
    await prismaRailway.user.deleteMany({});
    
    const userIdMap = new Map<number, number>(); // oldId -> newId
    
    if (users.length > 0) {
      for (const u of users) {
        const newUser = await prismaRailway.user.create({
          data: {
            username: u.username,
            email: u.email,
            displayName: u.display_name,
            avatarUrl: u.avatar_url,
            bio: u.bio,
            role: u.role || 'user',
            verified: u.verified === 1,
            countryIso3: u.country_iso3,
            subdivisionId: u.subdivision_id,
          }
        });
        userIdMap.set(u.id, newUser.id);
      }
      console.log(`✅ ${users.length} usuarios copiados`);
    }

    // 2. POLLS (crear uno por uno para mapear IDs)
    console.log('\n📊 Copiando encuestas...');
    const polls = db.prepare('SELECT * FROM polls').all() as any[];
    await prismaRailway.poll.deleteMany({});
    
    const pollIdMap = new Map<number, number>(); // oldId -> newId
    
    if (polls.length > 0) {
      for (const p of polls) {
        const newPoll = await prismaRailway.poll.create({
          data: {
            userId: userIdMap.get(p.user_id) || p.user_id,
            title: p.title,
            description: p.description,
            category: p.category,
            imageUrl: p.image_url,
            type: p.type || 'poll',
            status: p.status || 'active',
            isRell: p.is_rell === 1,
            originalPollId: null, // Skip para evitar foreign key circular
          }
        });
        pollIdMap.set(p.id, newPoll.id);
      }
      console.log(`✅ ${polls.length} encuestas copiadas`);
    }

    // 3. POLL OPTIONS (crear uno por uno para mapear IDs)
    console.log('\n🎯 Copiando opciones de encuestas...');
    const options = db.prepare('SELECT * FROM poll_options').all() as any[];
    await prismaRailway.pollOption.deleteMany({});
    
    const optionIdMap = new Map<number, number>(); // oldId -> newId
    
    if (options.length > 0) {
      for (const o of options) {
        const newOption = await prismaRailway.pollOption.create({
          data: {
            pollId: pollIdMap.get(o.poll_id) || o.poll_id,
            optionKey: o.option_key,
            optionLabel: o.option_label,
            color: o.color,
            displayOrder: o.display_order || 0,
            createdById: o.created_by_id ? userIdMap.get(o.created_by_id) : null,
          }
        });
        optionIdMap.set(o.id, newOption.id);
      }
      console.log(`✅ ${options.length} opciones copiadas`);
    }

    // 4. SUBDIVISIONS
    console.log('\n🗺️ Copiando subdivisiones...');
    const subdivisions = db.prepare('SELECT * FROM subdivisions').all() as any[];
    await prismaRailway.subdivision.deleteMany({});
    
    const BATCH_SIZE = 1000;
    for (let i = 0; i < subdivisions.length; i += BATCH_SIZE) {
      const batch = subdivisions.slice(i, i + BATCH_SIZE);
      await prismaRailway.subdivision.createMany({
        data: batch.map(s => ({
          subdivisionId: s.subdivision_id,
          level: s.level,
          level1Id: s.level1_id,
          level2Id: s.level2_id,
          level3Id: s.level3_id,
          name: s.name,
          nameLocal: s.name_local,
          nameVariant: s.name_variant,
          typeEnglish: s.type_english,
          hasc: s.hasc,
          iso: s.iso,
          countryCode: s.country_code,
          latitude: s.latitude,
          longitude: s.longitude,
        }))
      });
      console.log(`  ${i + batch.length}/${subdivisions.length} subdivisiones...`);
    }
    console.log(`✅ ${subdivisions.length} subdivisiones copiadas`);

    // Crear mapeo de subdivision_id para votos
    console.log('\n🗺️ Creando mapeo de subdivisiones...');
    const subdivisionMapping = new Map<number, number>();
    const railwaySubdivisions = await prismaRailway.subdivision.findMany({
      select: { id: true, subdivisionId: true }
    });
    
    // Mapear: old subdivision id -> nuevo subdivision id por subdivision_id
    for (const s of subdivisions) {
      const found = railwaySubdivisions.find(rs => rs.subdivisionId === s.subdivision_id);
      if (found) {
        subdivisionMapping.set(s.id, found.id);
      }
    }
    console.log(`✅ Mapeo de ${subdivisionMapping.size} subdivisiones creado`);

    // 5. VOTES (con IDs mapeados)
    console.log('\n🗳️ Copiando votos...');
    const votes = db.prepare('SELECT * FROM votes').all() as any[];
    await prismaRailway.vote.deleteMany({});
    if (votes.length > 0) {
      const VOTE_BATCH_SIZE = 500;
      for (let i = 0; i < votes.length; i += VOTE_BATCH_SIZE) {
        const batch = votes.slice(i, i + VOTE_BATCH_SIZE);
        await prismaRailway.vote.createMany({
          data: batch.map(v => ({
            pollId: pollIdMap.get(v.poll_id) || v.poll_id,
            optionId: optionIdMap.get(v.option_id) || v.option_id,
            userId: v.user_id ? userIdMap.get(v.user_id) : null,
            latitude: v.latitude,
            longitude: v.longitude,
            subdivisionId: v.subdivision_id ? subdivisionMapping.get(v.subdivision_id) : null,
            ipAddress: v.ip_address,
            userAgent: v.user_agent,
          }))
        });
        console.log(`  ${i + batch.length}/${votes.length} votos...`);
      }
      console.log(`✅ ${votes.length} votos copiados`);
    }

    // 6. VOTE HISTORY (con IDs mapeados)
    console.log('\n📈 Copiando historial de votos...');
    const voteHistory = db.prepare('SELECT * FROM vote_history').all() as any[];
    await prismaRailway.voteHistory.deleteMany({});
    if (voteHistory.length > 0) {
      const HISTORY_BATCH_SIZE = 1000;
      for (let i = 0; i < voteHistory.length; i += HISTORY_BATCH_SIZE) {
        const batch = voteHistory.slice(i, i + HISTORY_BATCH_SIZE);
        await prismaRailway.voteHistory.createMany({
          data: batch.map(h => ({
            pollId: pollIdMap.get(h.poll_id) || h.poll_id,
            optionId: optionIdMap.get(h.option_id) || h.option_id,
            voteCount: h.vote_count,
            percentage: h.percentage,
            recordedAt: new Date(h.recorded_at),
          }))
        });
        console.log(`  ${i + batch.length}/${voteHistory.length} registros...`);
      }
      console.log(`✅ ${voteHistory.length} registros de historial copiados`);
    }

    // 7. HASHTAGS (crear uno por uno para mapear IDs)
    console.log('\n🏷️ Copiando hashtags...');
    const hashtags = db.prepare('SELECT * FROM hashtags').all() as any[];
    await prismaRailway.hashtag.deleteMany({});
    
    const hashtagIdMap = new Map<number, number>();
    
    if (hashtags.length > 0) {
      for (const h of hashtags) {
        const newHashtag = await prismaRailway.hashtag.create({
          data: { tag: h.tag }
        });
        hashtagIdMap.set(h.id, newHashtag.id);
      }
      console.log(`✅ ${hashtags.length} hashtags copiados`);
    }

    // 8. POLL HASHTAGS (con IDs mapeados)
    console.log('\n🔗 Copiando relaciones poll-hashtag...');
    const pollHashtags = db.prepare('SELECT * FROM poll_hashtags').all() as any[];
    await prismaRailway.pollHashtag.deleteMany({});
    if (pollHashtags.length > 0) {
      await prismaRailway.pollHashtag.createMany({
        data: pollHashtags.map(ph => ({
          pollId: pollIdMap.get(ph.poll_id) || ph.poll_id,
          hashtagId: hashtagIdMap.get(ph.hashtag_id) || ph.hashtag_id,
        }))
      });
      console.log(`✅ ${pollHashtags.length} relaciones copiadas`);
    }

    // 9. FEATURED USERS (con IDs mapeados)
    console.log('\n⭐ Copiando usuarios destacados...');
    const featuredUsers = db.prepare('SELECT * FROM featured_users').all() as any[];
    await prismaRailway.featuredUser.deleteMany({});
    if (featuredUsers.length > 0) {
      await prismaRailway.featuredUser.createMany({
        data: featuredUsers.map(f => ({
          userId: userIdMap.get(f.user_id) || f.user_id,
          roleTitle: f.role_title,
          citationsCount: f.citations_count || 0,
          displaySize: f.display_size || 40,
          highlightColor: f.highlight_color,
          featuredOrder: f.featured_order || 0,
        }))
      });
      console.log(`✅ ${featuredUsers.length} usuarios destacados copiados`);
    }

    db.close();
    console.log('\n✅ Base de datos cerrada');

    // RESUMEN
    console.log('\n' + '='.repeat(50));
    console.log('✅ MIGRACIÓN COMPLETADA');
    console.log('='.repeat(50));
    console.log(`👥 Usuarios: ${users.length}`);
    console.log(`📊 Encuestas: ${polls.length}`);
    console.log(`🎯 Opciones: ${options.length}`);
    console.log(`🗺️ Subdivisiones: ${subdivisions.length}`);
    console.log(`🗳️ Votos: ${votes.length}`);
    console.log(`📈 Historial: ${voteHistory.length}`);
    console.log(`🏷️ Hashtags: ${hashtags.length}`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prismaRailway.$disconnect();
  }
}

copyEntireDatabase();
