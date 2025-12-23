<script lang="ts">
    import { onMount, onDestroy } from "svelte";

    export let date: string | Date | undefined;
    export let fallback: string = "Expira pronto";

    let timeString = "";
    let interval: ReturnType<typeof setInterval>;
    let isExpired = false;

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

<span>{timeString}</span>
