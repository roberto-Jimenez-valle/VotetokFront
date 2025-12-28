import { json, type RequestHandler } from '@sveltejs/kit';
import nodemailer from 'nodemailer';

/**
 * GET /api/admin/test-email
 * Endpoint de diagnóstico para probar el envío de emails
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
        envVars: {
            EMAIL_USER: process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 10)}...` : 'NO CONFIGURADO',
            EMAIL_PASS: process.env.EMAIL_PASS ? `Configurado (${process.env.EMAIL_PASS.length} chars)` : 'NO CONFIGURADO',
            NODE_ENV: process.env.NODE_ENV || 'no definido'
        }
    };

    // Si no hay credenciales, no intentar enviar
    if (!process.env.EMAIL_PASS) {
        diagnostics.result = 'ERROR: EMAIL_PASS no está configurado en las variables de entorno';
        return json(diagnostics);
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'voutop.oficial@gmail.com',
                pass: process.env.EMAIL_PASS
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000
        });

        diagnostics.transporterCreated = true;

        // Verificar conexión
        await transporter.verify();
        diagnostics.connectionVerified = true;

        // Enviar email de prueba
        const result = await transporter.sendMail({
            from: `"VoTok Test" <${process.env.EMAIL_USER || 'voutop.oficial@gmail.com'}>`,
            to: 'voutop.oficial@gmail.com',
            subject: `🧪 Test de Email - ${new Date().toLocaleString('es-ES')}`,
            html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #1e1e2e; color: white;">
          <h1 style="color: #8b5cf6;">✅ Email de Prueba Exitoso</h1>
          <p>Este email fue enviado desde el endpoint de diagnóstico.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Servidor:</strong> Railway</p>
        </div>
      `
        });

        diagnostics.emailSent = true;
        diagnostics.messageId = result.messageId;
        diagnostics.response = result.response;
        diagnostics.result = 'SUCCESS';

    } catch (error: any) {
        diagnostics.error = {
            message: error.message,
            code: error.code,
            command: error.command,
            responseCode: error.responseCode
        };
        diagnostics.result = 'ERROR';
    }

    return json(diagnostics);
};
