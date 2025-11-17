import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * Genera una imagen Open Graph para una encuesta específica
 * Dimensiones: 1200x630px (recomendado por Facebook/WhatsApp)
 */
export const GET: RequestHandler = async ({ params }) => {
  const pollId = Number(params.id);
  
  if (isNaN(pollId)) {
    throw error(400, 'ID de encuesta inválido');
  }

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      user: {
        select: {
          displayName: true,
          username: true,
          verified: true,
        },
      },
      options: {
        include: {
          _count: {
            select: {
              votes: true
            }
          }
        },
        orderBy: { displayOrder: 'asc' },
      },
      _count: {
        select: {
          votes: true,
        },
      },
    },
  });

  if (!poll) {
    throw error(404, 'Encuesta no encontrada');
  }

  // Calcular total de votos
  const totalVotes = poll._count.votes;
  
  // Obtener top 4 opciones más votadas
  const topOptions = poll.options
    .map(opt => ({
      text: opt.optionText,
      votes: opt._count.votes,
      percentage: totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0,
      color: opt.color || '#6366f1'
    }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 4);

  // Generar SVG
  const svg = generateSVG({
    title: poll.title,
    description: poll.description || '',
    author: poll.user?.displayName || poll.user?.username || 'Usuario',
    verified: poll.user?.verified || false,
    totalVotes,
    options: topOptions,
  });

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600', // Cache por 1 hora
    },
  });
};

interface OGImageData {
  title: string;
  description: string;
  author: string;
  verified: boolean;
  totalVotes: number;
  options: Array<{
    text: string;
    votes: number;
    percentage: number;
    color: string;
  }>;
}

function generateSVG(data: OGImageData): string {
  const { title, description, author, verified, totalVotes, options } = data;

  // Truncar texto largo
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  const displayTitle = truncateText(title, 80);
  const displayDesc = description ? truncateText(description, 120) : '';

  // Generar barras de opciones
  const optionsHTML = options.map((opt, idx) => {
    const y = 300 + (idx * 70);
    const barWidth = (opt.percentage / 100) * 900;
    
    return `
      <!-- Opción ${idx + 1} -->
      <rect x="150" y="${y}" width="900" height="50" rx="8" fill="rgba(255,255,255,0.05)" />
      <rect x="150" y="${y}" width="${barWidth}" height="50" rx="8" fill="${opt.color}" opacity="0.8" />
      <text x="170" y="${y + 32}" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600" fill="white">
        ${truncateText(opt.text, 40)}
      </text>
      <text x="1020" y="${y + 32}" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="white" text-anchor="end">
        ${opt.percentage}%
      </text>
    `;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <!-- Fondo gradiente -->
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0f;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <rect width="1200" height="630" fill="url(#bgGradient)" />
  
  <!-- Logo y marca -->
  <text x="150" y="80" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="800" fill="white">
    VouTop
  </text>
  
  <!-- Título de la encuesta -->
  <text x="150" y="150" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="700" fill="white">
    ${displayTitle}
  </text>
  
  ${displayDesc ? `
  <!-- Descripción -->
  <text x="150" y="195" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="rgba(255,255,255,0.7)">
    ${displayDesc}
  </text>
  ` : ''}
  
  <!-- Autor y estadísticas -->
  <text x="150" y="240" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="rgba(255,255,255,0.6)">
    Por ${author}${verified ? ' ✓' : ''} • ${totalVotes.toLocaleString()} ${totalVotes === 1 ? 'voto' : 'votos'}
  </text>
  
  <!-- Opciones de voto -->
  ${optionsHTML}
  
  <!-- Footer -->
  <text x="150" y="590" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="rgba(255,255,255,0.5)">
    Vota ahora en VouTop
  </text>
</svg>`;
}
