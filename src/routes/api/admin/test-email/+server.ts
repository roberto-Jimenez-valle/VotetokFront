import { json, type RequestHandler } from '@sveltejs/kit';
import { sendTestNotification } from '$lib/server/telegram';

/**
 * GET /api/admin/test-email
 * Endpoint de diagnóstico para probar las notificaciones de Telegram
 * Solo accesible para admins
 */
export const GET: RequestHandler = async ({ locals }) => {
    // Verificar que es admin
    const userEmail = locals.user?.email;
    if (userEmail !== 'voutop.oficial@gmail.com') {
        return json({ error: 'No autorizado' }, { status: 403 });
    }

    const diagnostics: Record<string, any> = {
        timestamp: new Date().toISOString(),
        service: 'Telegram',
        envVars: {
            TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'Configurado' : 'NO CONFIGURADO',
            TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ? `Configurado (${process.env.TELEGRAM_CHAT_ID})` : 'NO CONFIGURADO'
        }
    };

    // Si no hay credenciales, no intentar enviar
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
        diagnostics.result = 'ERROR: Faltan variables de entorno';
        diagnostics.instructions = 'Configura TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en Railway';
        return json(diagnostics);
    }

    const result = await sendTestNotification();
    diagnostics.result = result.success ? 'SUCCESS' : 'ERROR';
    if (result.error) {
        diagnostics.error = result.error;
    }

    return json(diagnostics);
};
