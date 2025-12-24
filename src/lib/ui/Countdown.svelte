<script lang="ts">
    import { onMount, onDestroy } from "svelte";

    interface Props {
        date: string | Date | undefined;
        fallback?: string;
        onExpire?: () => void;
    }

    let { date, fallback = "Expira pronto", onExpire }: Props = $props();

    let timeString = $state("");
    let interval: ReturnType<typeof setInterval>;
    let isExpired = $state(false);
    let hasNotifiedExpiry = false;

    function updateTime() {
        if (!date) {
            timeString = fallback;
            return;
        }

        const end = new Date(date).getTime();
        const now = new Date().getTime();
        const diff = end - now;

        if (diff <= 0) {
            timeString = "Cerrada";
            isExpired = true;

            // Only notify once when it expires
            if (!hasNotifiedExpiry && onExpire) {
                hasNotifiedExpiry = true;
                onExpire();
            }
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
            (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (days > 0) {
            timeString = `${days}d ${hours}h`;
        } else if (hours > 0) {
            timeString = `${hours}h ${minutes}m`;
        } else {
            // Show seconds if less than 1 hour for that "ticking" feel
            timeString = `${minutes}m ${seconds}s`;
        }
    }

    onMount(() => {
        updateTime();
        interval = setInterval(updateTime, 1000);
    });

    onDestroy(() => {
        if (interval) clearInterval(interval);
    });
</script>

<span class={isExpired ? "text-red-400" : ""}>{timeString}</span>
