/**
 * Email Service - Nodemailer with Gmail
 * Para enviar notificaciones de reportes y otras comunicaciones
 */

import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

/**
 * Obtener transporter configurado
 */
function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.EMAIL_USER || 'voutop.oficial@gmail.com',
      pass: env.EMAIL_PASS || '' // App password de Gmail
    }
  });
}

const ADMIN_EMAIL = 'voutop.oficial@gmail.com';

/**
 * Enviar email de notificación de reporte
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
    spam: 'Spam o publicidad',
    inappropriate: 'Contenido inapropiado',
    misleading: 'Información falsa/engañosa',
    hate: 'Discurso de odio',
    harassment: 'Acoso',
    violence: 'Violencia',
    other: 'Otro motivo'
  };

  const subject = reportCount >= 5
    ? `⚠️ URGENTE: Encuesta con ${reportCount} reportes requiere revisión`
    : `🚨 Nuevo reporte de encuesta - ${pollTitle}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">
          ${reportCount >= 5 ? '⚠️ Alerta de Reportes' : '🚨 Nuevo Reporte'}
        </h1>
      </div>
      
      <div style="background: #1e1e2e; padding: 24px; color: #e2e8f0;">
        <h2 style="color: #f472b6; margin-top: 0;">Detalles del Reporte</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 12px; background: #2d2d3d; border-radius: 8px 0 0 0; color: #94a3b8;">Encuesta:</td>
            <td style="padding: 12px; background: #2d2d3d; border-radius: 0 8px 0 0; color: white; font-weight: bold;">${pollTitle}</td>
          </tr>
          <tr>
            <td style="padding: 12px; background: #252535; color: #94a3b8;">ID:</td>
            <td style="padding: 12px; background: #252535; color: white;">#${pollId}</td>
          </tr>
          <tr>
            <td style="padding: 12px; background: #2d2d3d; color: #94a3b8;">Autor:</td>
            <td style="padding: 12px; background: #2d2d3d; color: white;">@${pollAuthor}</td>
          </tr>
          <tr>
            <td style="padding: 12px; background: #252535; color: #94a3b8;">Reportado por:</td>
            <td style="padding: 12px; background: #252535; color: white;">@${reporterUsername}</td>
          </tr>
          <tr>
            <td style="padding: 12px; background: #2d2d3d; color: #94a3b8;">Motivo:</td>
            <td style="padding: 12px; background: #2d2d3d; color: #f59e0b; font-weight: bold;">${reasonLabels[reason] || reason}</td>
          </tr>
          <tr>
            <td style="padding: 12px; background: #252535; border-radius: 0 0 0 8px; color: #94a3b8;">Total de reportes:</td>
            <td style="padding: 12px; background: #252535; border-radius: 0 0 8px 0; color: ${reportCount >= 5 ? '#ef4444' : '#10b981'}; font-weight: bold; font-size: 18px;">
              ${reportCount} ${reportCount >= 5 ? '⚠️' : ''}
            </td>
          </tr>
        </table>
        
        ${notes ? `
        <div style="background: #2d2d3d; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #8b5cf6;">
          <strong style="color: #a78bfa;">Notas del usuario:</strong>
          <p style="color: #e2e8f0; margin: 8px 0 0 0;">${notes}</p>
        </div>
        ` : ''}
        
        ${reportCount >= 5 ? `
        <div style="background: #7f1d1d; padding: 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #ef4444;">
          <strong style="color: #fca5a5;">⚠️ Acción requerida:</strong>
          <p style="color: #fecaca; margin: 8px 0 0 0;">Esta encuesta ha sido ocultada automáticamente debido a la cantidad de reportes. Revisa el contenido y decide si debe restaurarse o eliminarse.</p>
        </div>
        ` : ''}
        
        <div style="text-align: center; margin-top: 24px;">
          <a href="${env.PUBLIC_URL || 'http://localhost:5173'}/admin/reports" 
             style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Ver Panel de Reportes
          </a>
        </div>
      </div>
      
      <div style="background: #0f0f1a; padding: 16px; border-radius: 0 0 12px 12px; text-align: center;">
        <p style="color: #64748b; margin: 0; font-size: 12px;">
          VoTok - Sistema de Moderación<br>
          Este es un email automático, no respondas directamente.
        </p>
      </div>
    </div>
  `;

  try {
    // Si no hay credenciales de email configuradas, solo loguear
    if (!env.EMAIL_PASS) {
      console.log('[Email] ⚠️ EMAIL_PASS no configurado en .env. Email no enviado.');
      console.log('[Email] Detalles del reporte que no se pudo enviar:', { pollId, pollTitle, reason, reportCount });
      return { sent: false, reason: 'No email credentials configured' };
    }

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"VoTok Moderación" <${env.EMAIL_USER || 'voutop.oficial@gmail.com'}>`,
      to: ADMIN_EMAIL,
      subject,
      html
    });

    console.log(`[Email] ✅ Notificación de reporte enviada a ${ADMIN_EMAIL}`);
    return { sent: true };
  } catch (error) {
    console.error('[Email] Error enviando notificación:', error);
    return { sent: false, error };
  }
}

/**
 * Enviar email de confirmación al usuario que reportó
 */
export async function sendReportConfirmation(data: {
  userEmail: string;
  pollTitle: string;
}) {
  // Por ahora solo logueamos, implementar cuando se tenga el email del usuario
  console.log(`[Email] Confirmación de reporte para ${data.userEmail}: ${data.pollTitle}`);
}
