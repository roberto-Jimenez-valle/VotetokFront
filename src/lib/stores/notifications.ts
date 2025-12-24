
import { writable } from 'svelte/store';

export const notificationCounts = writable({
    all: 0,
    mentions: 0,
    votes: 0,
    follows: 0,
    messages: 0
});

export const totalUnread = writable(0);

// Subscribe to counts to update totalUnread automatically
notificationCounts.subscribe(counts => {
    totalUnread.set(counts.all);
});
