
import { PrismaClient } from '@prisma/client';
import { decodePollId } from '../src/lib/server/hashids';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking votes in database...');
  
  // 1. Count total votes
  const totalVotes = await prisma.vote.count();
  console.log(`Total votes in DB: ${totalVotes}`);

  // 2. Count votes with subdivision
  const votesWithSubdivision = await prisma.vote.count({
    where: {
      subdivisionId: { not: null }
    }
  });
  console.log(`Votes with subdivisionId: ${votesWithSubdivision}`);

  // 3. Get recent votes to see sample
  const recentVotes = await prisma.vote.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      subdivision: true,
      poll: true
    }
  });

  console.log('\n📝 5 Most recent votes:');
  recentVotes.forEach(v => {
    console.log(`- Vote ID: ${v.id}, Poll ID: ${v.pollId}, Poll Title: ${v.poll.title}, Subdiv: ${v.subdivisionId} (${v.subdivision?.subdivisionId || 'null'}), Created: ${v.createdAt}`);
  });

  // 4. Check specific poll if hashId provided
  // The user mentioned QeEjDpx2
  const hashId = 'QeEjDpx2';
  const pollId = decodePollId(hashId);
  
  if (pollId) {
    console.log(`\n🔍 Checking specific poll ${hashId} (ID: ${pollId})...`);
    
    const pollVotes = await prisma.vote.count({
      where: { pollId }
    });
    
    const pollVotesWithSubdiv = await prisma.vote.count({
      where: { 
        pollId,
        subdivisionId: { not: null }
      }
    });

    console.log(`Poll ${hashId}: Total Votes: ${pollVotes}, With Subdivision: ${pollVotesWithSubdiv}`);
    
    if (pollVotes > 0 && pollVotesWithSubdiv === 0) {
      console.log('⚠️ PROBLEM FOUND: Poll has votes but none have subdivision linked!');
      
      const votesWithoutSubdiv = await prisma.vote.findMany({
        where: { 
            pollId,
            subdivisionId: null
        },
        take: 5
      });
      
      console.log('Sample votes without subdivision:');
      votesWithoutSubdiv.forEach(v => {
          console.log(`- ID: ${v.id}, Lat: ${v.latitude}, Lon: ${v.longitude}, IP: ${v.ipAddress}`);
      });

    } else if (pollVotes === 0) {
      console.log('⚠️ PROBLEM FOUND: Poll has no votes!');
    } else {
        console.log('✅ Poll has votes with subdivisions.');
        // Check date filter
        const last720h = new Date(Date.now() - 720 * 60 * 60 * 1000);
        const votesIn720h = await prisma.vote.count({
            where: {
                pollId,
                subdivisionId: { not: null },
                createdAt: { gte: last720h }
            }
        });
        console.log(`Poll ${hashId}: Votes in last 720h: ${votesIn720h}`);
    }
  } else {
    console.log(`\n❌ Could not decode hashId ${hashId}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
