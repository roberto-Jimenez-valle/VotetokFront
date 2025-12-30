import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * POST /api/checklist/sync-ai
 * Añade los cambios del asistente SIN borrar los items existentes
 * Solo añade items que no existan ya (por label)
 */
export const POST: RequestHandler = async ({ locals }) => {
    try {
        const user = locals.user;

        // Solo el admin puede sincronizar
        if (!user || (user.email !== 'voutop.oficial@gmail.com' && user.role !== 'admin')) {
            return json({
                success: false,
                error: 'No autorizado para esta acción'
            }, { status: 403 });
        }

        // Nombre del grupo de cambios del asistente
        const AI_GROUP_TITLE = "✨ Cambios del Asistente (Pendiente Validación)";

        // Buscar o crear el grupo
        let aiGroup = await prisma.checklistGroup.findFirst({
            where: { title: { contains: "Cambios del Asistente" } }
        });

        if (!aiGroup) {
            // Obtener el orden más bajo para ponerlo primero
            const minOrder = await prisma.checklistGroup.aggregate({
                _min: { displayOrder: true }
            });

            aiGroup = await prisma.checklistGroup.create({
                data: {
                    title: AI_GROUP_TITLE,
                    icon: "Zap",
                    color: "text-amber-400",
                    displayOrder: (minOrder._min.displayOrder ?? 0) - 1
                }
            });
        }

        // Items a añadir - ACTUALIZAR ESTA LISTA CON CADA CAMBIO
        const aiItems = [
            {
                label: 'Botones "Seguir" en listas de Seguidores/Siguiendo',
                detail: 'Añadidos botones interactivos de "Seguir", "Siguiendo" y "Solicitado" en las pestañas de seguidores y siguiendo del perfil de usuario. Permite seguir/dejar de seguir directamente desde la lista.',
                note: 'Archivos: UserProfileModal.svelte, followers/+server.ts, following/+server.ts',
                status: 'partial',
                critical: true
            },
            {
                label: 'Botón "Seguir" en notificaciones de follow',
                detail: 'Añadido botón de "Seguir también" en las notificaciones de tipo "ha empezado a seguirte". Permite devolver el follow sin entrar al perfil.',
                note: 'Archivos: NotificationsModal.svelte, notifications/+server.ts',
                status: 'partial',
                critical: true
            },
            {
                label: 'Corrección nombre duplicado en notificaciones',
                detail: 'Solucionado el bug donde aparecía "Roberto Jiménez Valle robertojimenezvalle ha empezado a seguirte". Ahora el mensaje es limpio.',
                note: 'Archivo: follow/+server.ts',
                status: 'partial',
                critical: false
            },
            {
                label: 'Selector de tema conectado',
                detail: 'El interruptor de "Modo oscuro" en los ajustes del perfil ahora está conectado al estado global. Cambiarlo afecta a toda la app.',
                note: 'Archivo: UserProfileModal.svelte',
                status: 'partial',
                critical: false
            },
            {
                label: 'Búsqueda de hashtags mejorada',
                detail: 'La API de búsqueda ahora permite buscar por hashtags. Las encuestas se filtran por tags y hay una sección específica de hashtags en resultados.',
                note: 'Archivo: search/+server.ts',
                status: 'partial',
                critical: false
            }
        ];

        // Obtener items existentes en este grupo
        const existingItems = await prisma.checklistItem.findMany({
            where: { groupId: aiGroup.id },
            select: { label: true }
        });
        const existingLabels = new Set(existingItems.map(i => i.label));

        // Añadir solo los que no existen
        let addedCount = 0;
        let order = existingItems.length;

        for (const item of aiItems) {
            if (!existingLabels.has(item.label)) {
                await prisma.checklistItem.create({
                    data: {
                        groupId: aiGroup.id,
                        label: item.label,
                        detail: item.detail,
                        note: item.note,
                        status: item.status,
                        critical: item.critical,
                        displayOrder: order++
                    }
                });
                addedCount++;
            }
        }

        return json({
            success: true,
            message: addedCount > 0
                ? `✅ Añadidos ${addedCount} items nuevos del asistente`
                : '✅ No hay items nuevos para añadir (ya estaban todos)',
            groupId: aiGroup.id,
            addedCount,
            totalInGroup: existingItems.length + addedCount
        });
    } catch (error) {
        console.error('[API Checklist Sync AI] Error:', error);
        return json({ success: false, error: 'Error al sincronizar cambios' }, { status: 500 });
    }
};
