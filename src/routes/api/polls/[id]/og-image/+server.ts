import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * Genera una imagen Open Graph SVG para una encuesta específica
 * Dimensiones: 1200x630px (recomendado por Facebook/WhatsApp)
 * Nota: WhatsApp solo funcionará cuando esté en un dominio público
 */
export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const pollId = Number(params.id);
    
    if (isNaN(pollId)) {
      throw error(400, 'ID de encuesta inválido');
    }

    const baseUrl = `${url.protocol}//${url.host}`;

    const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      user: {
        select: {
          displayName: true,
          username: true,
          verified: true,
          avatarUrl: true,
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
  
  // Obtener top 4 opciones más votadas con thumbnails
  const topOptions = poll.options
    .map(opt => ({
      text: opt.optionText || opt.optionLabel || 'Opción',
      votes: opt._count.votes,
      percentage: totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0,
      color: opt.color || '#6366f1',
      imageUrl: opt.imageUrl || null,
    }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 4);

  // Generar SVG
  const svg = generateSVG({
    title: poll.title,
    description: poll.description || '',
    author: poll.user?.displayName || poll.user?.username || 'Usuario',
    verified: poll.user?.verified || false,
    authorAvatar: poll.user?.avatarUrl || null,
    totalVotes,
    options: topOptions,
    baseUrl,
  });

  return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (e: any) {
    console.error('[OG Image] Error:', e);
    // Devolver JSON con el error para depuración
    return new Response(JSON.stringify({ 
      error: e.message || 'Error desconocido',
      stack: e.stack 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

interface OGImageData {
  title: string;
  description: string;
  author: string;
  verified: boolean;
  authorAvatar: string | null;
  totalVotes: number;
  options: Array<{
    text: string;
    votes: number;
    percentage: number;
    color: string;
    imageUrl: string | null;
  }>;
  baseUrl: string;
}

function generateSVG(data: OGImageData): string {
  const { title, author, verified, totalVotes, options, baseUrl } = data;

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  const escapeXml = (text: string) => {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  };

  const displayTitle = escapeXml(truncateText(title, 70));
  const displayAuthor = escapeXml(truncateText(author, 18));
  const cardColors = ['#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

  // Cards apiladas una encima de otra
  const stackedCards = options.slice(0, 4).reverse().map((opt, idx) => {
    const realIdx = options.length - 1 - idx;
    const offset = realIdx * 25;
    const x = 400 + offset;
    const y = 140 + offset;
    const color = opt.color || cardColors[realIdx % cardColors.length];
    const optText = escapeXml(truncateText(opt.text, 20));
    const isTop = realIdx === 0;
    
    return `
      <g opacity="${isTop ? 1 : 0.85}">
        <!-- Sombra -->
        <rect x="${x + 8}" y="${y + 8}" width="400" height="340" rx="20" fill="rgba(0,0,0,0.3)"/>
        
        <!-- Card -->
        <rect x="${x}" y="${y}" width="400" height="340" rx="20" fill="${color}"/>
        
        <!-- Comillas arriba -->
        <text x="${x + 40}" y="${y + 60}" font-family="Georgia, serif" font-size="60" fill="white" opacity="0.3">"</text>
        
        <!-- Comillas abajo -->
        <text x="${x + 320}" y="${y + 280}" font-family="Georgia, serif" font-size="60" fill="white" opacity="0.3">"</text>
        
        <!-- Texto centrado -->
        <text x="${x + 200}" y="${y + 180}" font-family="Segoe UI, Arial" font-size="28" font-weight="bold" fill="white" text-anchor="middle">${optText}</text>
        
        <!-- Línea separadora -->
        <line x1="${x + 40}" y1="${y + 280}" x2="${x + 360}" y2="${y + 280}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
        
        <!-- Porcentaje -->
        <text x="${x + 50}" y="${y + 320}" font-family="Segoe UI, Arial" font-size="32" font-weight="bold" fill="white">${opt.percentage}%</text>
        <text x="${x + 130}" y="${y + 320}" font-family="Segoe UI, Arial" font-size="12" fill="rgba(255,255,255,0.6)">DE LOS VOTOS</text>
      </g>
    `;
  }).join('');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c0c14"/>
      <stop offset="50%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="btn" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
    <linearGradient id="purple" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
    <radialGradient id="globeGrad" cx="30%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="40%" stop-color="#3730a3"/>
      <stop offset="70%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#0c0c14"/>
    </radialGradient>
    <radialGradient id="globeGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  
  <!-- Fondo -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Globo real de fondo (ladeado a la izquierda) -->
  <image href="${baseUrl}/globe-bg.png" x="-100" y="50" width="550" height="550" opacity="0.7" transform="rotate(-10, 200, 350)" preserveAspectRatio="xMidYMid slice"/>
  
  <!-- Logo -->
  <image href="${baseUrl}/logo.png" x="50" y="30" width="180" height="60" preserveAspectRatio="xMidYMid meet"/>
  
  <!-- Badge -->
  <rect x="980" y="40" width="120" height="32" rx="16" fill="url(#purple)"/>
  <text x="1040" y="62" font-family="Segoe UI, Arial" font-size="12" font-weight="bold" fill="white" text-anchor="middle">ENCUESTA</text>
  
  <!-- Título -->
  <text x="600" y="120" font-family="Segoe UI, Arial" font-size="${title.length > 50 ? 26 : title.length > 35 ? 32 : 38}" font-weight="bold" fill="white" text-anchor="middle">${displayTitle}</text>
  <text x="600" y="155" font-family="Segoe UI, Arial" font-size="16" fill="rgba(255,255,255,0.5)" text-anchor="middle">Elige tu opción favorita</text>
  
  <!-- Cards apiladas -->
  ${stackedCards}
  
  <!-- Footer -->
  <rect x="0" y="570" width="1200" height="60" fill="rgba(0,0,0,0.3)"/>
  
  <!-- Autor -->
  <circle cx="80" cy="600" r="20" fill="url(#purple)"/>
  <text x="80" y="607" font-family="Segoe UI, Arial" font-size="16" font-weight="bold" fill="white" text-anchor="middle">${displayAuthor.charAt(0).toUpperCase()}</text>
  <text x="115" y="598" font-family="Segoe UI, Arial" font-size="14" font-weight="600" fill="white">${displayAuthor}</text>
  <text x="115" y="615" font-family="Segoe UI, Arial" font-size="12" fill="rgba(255,255,255,0.5)">${verified ? '✓ Verificado' : ''}</text>
  
  <!-- Votos -->
  <text x="600" y="605" font-family="Segoe UI, Arial" font-size="16" fill="rgba(255,255,255,0.6)" text-anchor="middle">${totalVotes} ${totalVotes === 1 ? 'voto' : 'votos'}</text>
  
  <!-- Botón -->
  <rect x="950" y="580" width="200" height="42" rx="21" fill="url(#btn)"/>
  <text x="1050" y="607" font-family="Segoe UI, Arial" font-size="15" font-weight="bold" fill="white" text-anchor="middle">Votar ahora →</text>
</svg>`;
}
