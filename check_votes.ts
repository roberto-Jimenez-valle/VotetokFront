
import { PrismaClient } from '@prisma/client';
import Hashids from 'hashids';

const prisma = new PrismaClient();
const SALT = process.env.HASHIDS_SALT || 'VouTop-S3cr3t-S4lt-2024!';
const pollHashids = new Hashids(`${SALT}-polls`, 8, 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789');

async function checkVotes(hashId: string) {
    const decoded = pollHashids.decode(hashId);
    if (decoded.length === 0) {
        console.error('Invalid Hash ID');
        return;
    }
    const pollId = decoded[0] as number;
    console.log('Numeric Poll ID:', pollId);

    const totalVotes = await prisma.vote.count({ where: { pollId } });
    const votesWithSub = await prisma.vote.count({
        where: {
            pollId,
            subdivisionId: { not: null }
        }
    });

    const sampleVotes = await prisma.vote.findMany({
        where: { pollId },
        take: 5,
        select: {
            id: true,
            subdivisionId: true,
            latitude: true,
            longitude: true
        }
    });

    console.log('Results:', {
        totalVotes,
        votesWithSub,
        sampleVotes
    });
}

checkVotes('QeEjDpx2')
    .catch(console.error)
    .finally(() => prisma.$disconnect());
