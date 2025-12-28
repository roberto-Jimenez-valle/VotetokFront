/**
 * Telegram Notification Service
 * Envía notificaciones de reportes vía Telegram Bot
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Enviar mensaje a Telegram
 */
async function sendTelegramMessage(text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.log('[Telegram] ⚠️ No configurado (falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID)');
        return false;
    }

    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text,
                parse_mode: parseMode,
                disable_web_page_preview: true
            })
        });

        const data = await response.json();

        if (data.ok) {
            console.log('[Telegram] ✅ Mensaje enviado');
            return true;
        } else {
            console.error('[Telegram] ❌ Error:', data.description);
            return false;
        }
    } catch (error) {
        console.error('[Telegram] ❌ Error de conexión:', error);
        return false;
    }
}

/**
 * Enviar notificación de reporte
 */
export async function sendReportNotification(data: {
    pollId: number;
    pollTitle: string;
    pollAuthor: string;
    reporterUsername: string;
    reason: string;
    notes?: string;
    reportCount: number;
}) {
    const { pollId, pollTitle, pollAuthor, reporterUsername, reason, notes, reportCount } = data;

    const reasonLabels: Record<string, string> = {
        spam: '📢 Spam',
        inappropriate: '🔞 Contenido inapropiado',
        misleading: '⚠️ Info falsa',
        hate: '🗣️ Odio',
        harassment: '😤 Acoso',
        violence: '⚔️ Violencia',
        other: '❓ Otro'
    };

    const isUrgent = reportCount >= 5;
    const emoji = isUrgent ? '🚨🚨🚨' : '🚨';

    const message = `
${emoji} <b>NUEVO REPORTE</b> ${emoji}

📋 <b>Encuesta:</b> ${pollTitle}
🆔 <b>ID:</b> #${pollId}
👤 <b>Autor:</b> @${pollAuthor}
👮 <b>Reportado por:</b> @${reporterUsername}

📌 <b>Motivo:</b> ${reasonLabels[reason] || reason}
${notes ? `📝 <b>Notas:</b> ${notes}` : ''}

📊 <b>Total reportes:</b> ${reportCount}${isUrgent ? ' ⚠️ REQUIERE REVISIÓN' : ''}

🔗 <a href="https://voutop.com/admin/reports">Ver Panel de Reportes</a>
`.trim();

    return sendTelegramMessage(message);
}

/**
 * Enviar mensaje de prueba
 */
export async function sendTestNotification(): Promise<{ success: boolean; error?: string }> {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        return {
            success: false,
            error: `Falta configurar: ${!TELEGRAM_BOT_TOKEN ? 'TELEGRAM_BOT_TOKEN' : ''} ${!TELEGRAM_CHAT_ID ? 'TELEGRAM_CHAT_ID' : ''}`.trim()
        };
    }

    const success = await sendTelegramMessage(`
✅ <b>VoTok - Test de Notificaciones</b>

Las notificaciones de Telegram están funcionando correctamente.

🕐 ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
  `.trim());

    return { success };
}
