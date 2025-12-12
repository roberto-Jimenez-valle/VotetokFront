import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/auth/validate
 * Valida si el token JWT es válido y el usuario existe
 */
export const GET: RequestHandler = async ({ locals }) => {
  try {
    // El middleware ya extrajo el usuario del token
    const user = locals.user;
    
    if (!user || !user.userId) {
      return json({ valid: false, error: 'No authenticated' }, { status: 401 });
    }
    
    // Verificar que el usuario existe en la base de datos
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, username: true, role: true }
    });
    
    if (!dbUser) {
      return json({ valid: false, error: 'User not found' }, { status: 401 });
    }
    
    return json({ 
      valid: true, 
      user: {
        id: dbUser.id,
        username: dbUser.username,
        role: dbUser.role
      }
    });
  } catch (err) {
    console.error('[Auth Validate] Error:', err);
    return json({ valid: false, error: 'Validation failed' }, { status: 500 });
  }
};
