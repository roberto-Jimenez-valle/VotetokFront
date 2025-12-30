import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * DELETE /api/checklist/clear
 * Elimina todos los datos del checklist para permitir reinicialización
 * Solo accesible para el admin
 */
export const DELETE: RequestHandler = async ({ locals }) => {
    try {
        const user = locals.user;

        // Solo el admin puede limpiar
        if (!user || (user.email !== 'voutop.oficial@gmail.com' && user.role !== 'admin')) {
            return json({
                success: false,
                error: 'No autorizado para esta acción'
            }, { status: 403 });
        }

        // Eliminar todos los items primero (por la relación)
        await prisma.checklistItem.deleteMany({});

        // Luego eliminar los grupos
        await prisma.checklistGroup.deleteMany({});

        return json({
            success: true,
            message: 'Checklist limpiado correctamente'
        });
    } catch (error) {
        console.error('[API Checklist Clear] Error:', error);
        return json({ success: false, error: 'Error al limpiar checklist' }, { status: 500 });
    }
};
