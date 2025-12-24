
import { prisma } from '$lib/server/prisma';

export type NotificationType = 'FOLLOW' | 'VOTE' | 'LIKE' | 'COMMENT' | 'SYSTEM' | 'MENTION' | 'NEW_FOLLOWER' | 'FOLLOW_REQUEST' | 'MESSAGE';

interface CreateNotificationParams {
    userId: number;       // The recipient
    actorId: number;      // The doer (e.g., the follower, voter)
    type: NotificationType;
    message?: string;
    data?: Record<string, any>; // Extra data: { pollId: 123, pollTitle: "..." }
    client?: any; // Optional Prisma Client or Transaction Client
}

export async function createNotification({
    userId,
    actorId,
    type,
    message,
    data,
    client = prisma
}: CreateNotificationParams) {
    // Don't notify if the actor is the user themselves
    if (userId === actorId) return;

    try {
        await client.notification.create({
            data: {
                userId,
                actorId,
                type,
                message,
                data: data || {},
                read: false
            }
        });
    } catch (error) {
        console.error('[NotificationService] Error creating notification:', error);
        // Non-blocking: don't crash the main request if notification fails
    }
}
