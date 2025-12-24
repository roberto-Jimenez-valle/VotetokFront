/**
 * Sistema Honeypot Anti-Bot
 * 
 * Campos ocultos que los bots rellenan pero los humanos no.
 * Si vienen rellenos = bot = descartar silenciosamente.
 */

export interface HoneypotFields {
    company?: string;      // Campo típico de honeypot
    website?: string;      // Otro campo típico
    phone_number?: string; // Otro más
    fax?: string;          // Nadie usa fax
}

/**
 * Lista de campos honeypot a verificar
 */
export const HONEYPOT_FIELDS = ['company', 'website', 'phone_number', 'fax', 'address2', 'middle_name'];

/**
 * Verifica si el request contiene campos honeypot rellenos
 * 
 * @returns true si es bot (campos rellenos), false si es humano
 */
export function detectHoneypotBot(body: Record<string, unknown>): boolean {
    for (const field of HONEYPOT_FIELDS) {
        const value = body[field];
        if (value && typeof value === 'string' && value.trim().length > 0) {
            console.log(`[Honeypot] Bot detectado: campo "${field}" relleno`);
            return true;
        }
    }
    return false;
}

/**
 * Genera campos honeypot para incluir en formularios frontend
 * 
 * Uso en Svelte:
 * ```svelte
 * <input type="text" name="company" style="display:none" tabindex="-1" autocomplete="off" />
 * ```
 */
export function getHoneypotFieldsHTML(): string {
    return HONEYPOT_FIELDS.map(field =>
        `<input type="text" name="${field}" style="position:absolute;left:-9999px;top:-9999px;opacity:0;height:0;width:0;" tabindex="-1" autocomplete="off" aria-hidden="true" />`
    ).join('\n');
}

/**
 * Middleware para verificar honeypot en requests POST
 * 
 * Uso en endpoint:
 * ```ts
 * const body = await request.json();
 * if (isHoneypotTriggered(body)) {
 *     // Silenciosamente fingir éxito
 *     return json({ success: true });
 * }
 * ```
 */
export function isHoneypotTriggered(body: Record<string, unknown>): boolean {
    return detectHoneypotBot(body);
}
