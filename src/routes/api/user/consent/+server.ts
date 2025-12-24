import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Versiones actuales de los documentos legales
const CURRENT_TERMS_VERSION = '1.0.0';
const CURRENT_PRIVACY_VERSION = '1.0.0';

interface ConsentPayload {
    isOver16?: boolean;
    termsAccepted?: boolean;
    termsVersion?: string;
    privacyAccepted?: boolean;
    privacyVersion?: string;
    cookiesEssential?: boolean;
    cookiesAnalytics?: boolean;
    cookiesAdvertising?: boolean;
}

// Obtener user ID del token
function getUserIdFromToken(authHeader: string | null): number | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
        return decoded.userId;
    } catch {
        return null;
    }
}

// GET - Obtener consentimiento del usuario
export const GET: RequestHandler = async ({ request }) => {
    const userId = getUserIdFromToken(request.headers.get('authorization'));

    if (!userId) {
        throw error(401, 'No autorizado');
    }

    try {
        const consent = await prisma.userConsent.findUnique({
            where: { userId }
        });

        if (!consent) {
            return json({
                hasConsent: false,
                isOver16: false,
                termsAccepted: false,
                privacyAccepted: false,
                cookiesEssential: true,
                cookiesAnalytics: false,
                cookiesAdvertising: false,
                needsUpdate: true // Necesita dar consentimiento
            });
        }

        // Verificar si necesita actualizar (nuevas versiones de términos)
        const needsUpdate =
            consent.termsVersion !== CURRENT_TERMS_VERSION ||
            consent.privacyVersion !== CURRENT_PRIVACY_VERSION;

        return json({
            hasConsent: true,
            isOver16: consent.isOver16,
            termsAccepted: consent.termsAccepted,
            termsVersion: consent.termsVersion,
            privacyAccepted: consent.privacyAccepted,
            privacyVersion: consent.privacyVersion,
            cookiesEssential: consent.cookiesEssential,
            cookiesAnalytics: consent.cookiesAnalytics,
            cookiesAdvertising: consent.cookiesAdvertising,
            needsUpdate,
            consentedAt: consent.createdAt,
            updatedAt: consent.updatedAt
        });

    } catch (err) {
        console.error('[API Consent] Error obteniendo consentimiento:', err);
        throw error(500, 'Error interno del servidor');
    }
};

// POST - Guardar/actualizar consentimiento
export const POST: RequestHandler = async ({ request }) => {
    const userId = getUserIdFromToken(request.headers.get('authorization'));

    if (!userId) {
        throw error(401, 'No autorizado');
    }

    try {
        const body: ConsentPayload = await request.json();

        // Obtener información del request
        const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
            request.headers.get('x-real-ip') ||
            'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        // Construir objeto de datos
        const now = new Date();
        const updateData: any = {
            ipAddress,
            userAgent,
            updatedAt: now
        };

        // Solo actualizar campos que vienen en el request
        if (typeof body.isOver16 === 'boolean') {
            updateData.isOver16 = body.isOver16;
            if (body.isOver16) {
                updateData.ageVerifiedAt = now;
            }
        }

        if (typeof body.termsAccepted === 'boolean') {
            updateData.termsAccepted = body.termsAccepted;
            if (body.termsAccepted) {
                updateData.termsAcceptedAt = now;
                updateData.termsVersion = body.termsVersion || CURRENT_TERMS_VERSION;
            }
        }

        if (typeof body.privacyAccepted === 'boolean') {
            updateData.privacyAccepted = body.privacyAccepted;
            if (body.privacyAccepted) {
                updateData.privacyAcceptedAt = now;
                updateData.privacyVersion = body.privacyVersion || CURRENT_PRIVACY_VERSION;
            }
        }

        if (typeof body.cookiesEssential === 'boolean') {
            updateData.cookiesEssential = body.cookiesEssential;
            updateData.cookiesConsentAt = now;
        }

        if (typeof body.cookiesAnalytics === 'boolean') {
            updateData.cookiesAnalytics = body.cookiesAnalytics;
            updateData.cookiesConsentAt = now;
        }

        if (typeof body.cookiesAdvertising === 'boolean') {
            updateData.cookiesAdvertising = body.cookiesAdvertising;
            updateData.cookiesConsentAt = now;
        }

        // Upsert: crear si no existe, actualizar si existe
        const consent = await prisma.userConsent.upsert({
            where: { userId },
            update: updateData,
            create: {
                userId,
                isOver16: body.isOver16 ?? false,
                ageVerifiedAt: body.isOver16 ? now : null,
                termsAccepted: body.termsAccepted ?? false,
                termsAcceptedAt: body.termsAccepted ? now : null,
                termsVersion: body.termsAccepted ? (body.termsVersion || CURRENT_TERMS_VERSION) : null,
                privacyAccepted: body.privacyAccepted ?? false,
                privacyAcceptedAt: body.privacyAccepted ? now : null,
                privacyVersion: body.privacyAccepted ? (body.privacyVersion || CURRENT_PRIVACY_VERSION) : null,
                cookiesEssential: body.cookiesEssential ?? true,
                cookiesAnalytics: body.cookiesAnalytics ?? false,
                cookiesAdvertising: body.cookiesAdvertising ?? false,
                cookiesConsentAt: now,
                ipAddress,
                userAgent
            }
        });

        console.log(`[API Consent] Consentimiento guardado para usuario ${userId}`);

        return json({
            success: true,
            consent: {
                isOver16: consent.isOver16,
                termsAccepted: consent.termsAccepted,
                privacyAccepted: consent.privacyAccepted,
                cookiesAnalytics: consent.cookiesAnalytics,
                cookiesAdvertising: consent.cookiesAdvertising
            }
        });

    } catch (err) {
        console.error('[API Consent] Error guardando consentimiento:', err);
        throw error(500, 'Error interno del servidor');
    }
};
