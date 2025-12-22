// Initial posts data for the Voting Feed

import type { Post } from './types';
import { generateFriends, generateOptions } from './helpers';

export const INITIAL_POSTS: Post[] = [
  {
    id: 'p1',
    type: 'standard',
    author: 'El Grupito',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Party',
    time: '2h',
    question: '¿Qué hacemos este viernes noche? 🌙🍻',
    totalVotes: 842,
    comments: 24,
    reposts: 5,
    likes: 120,
    options: [
      {
        id: 'o1',
        title: 'Salir de Fiesta 🎉',
        votes: 520,
        friends: generateFriends('p1o1', 3),
        type: 'image',
        image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80',
        colorFrom: 'from-purple-600',
        colorTo: 'to-indigo-900',
        bgBar: 'bg-purple-500'
      },
      {
        id: 'o2',
        title: 'Peli, Manta y Chill 🍿',
        votes: 322,
        friends: generateFriends('p1o2', 1),
        type: 'image',
        image: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=600&q=80',
        colorFrom: 'from-blue-600',
        colorTo: 'to-slate-900',
        bgBar: 'bg-blue-500'
      }
    ]
  },
  {
    id: 'p5',
    type: 'tierlist',
    author: 'Foodie Madrid',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Foodie',
    time: '45m',
    question: 'Ranking definitivo de comida rápida. ¡Pelead! 🍔🍕',
    totalVotes: 1540,
    comments: 89,
    reposts: 45,
    likes: 850,
    options: [
      {
        id: 't1',
        title: 'Hamburguesa Doble',
        votes: 800,
        friends: generateFriends('t1', 2),
        type: 'image',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80',
        colorFrom: 'from-amber-600',
        colorTo: 'to-yellow-900',
        bgBar: 'bg-amber-500'
      },
      {
        id: 't2',
        title: 'Pizza Pepperoni',
        votes: 600,
        friends: generateFriends('t2', 1),
        type: 'image',
        image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&q=80',
        colorFrom: 'from-red-600',
        colorTo: 'to-red-950',
        bgBar: 'bg-red-600'
      },
      {
        id: 't3',
        title: 'Sushi Variado',
        votes: 450,
        friends: [],
        type: 'image',
        image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&q=80',
        colorFrom: 'from-emerald-600',
        colorTo: 'to-green-900',
        bgBar: 'bg-emerald-500'
      },
      {
        id: 't4',
        title: 'Tacos Al Pastor',
        votes: 200,
        friends: [],
        type: 'image',
        image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&q=80',
        colorFrom: 'from-orange-600',
        colorTo: 'to-red-900',
        bgBar: 'bg-orange-500'
      },
      {
        id: 't5',
        title: 'Kebab Mixto',
        votes: 350,
        friends: [],
        type: 'image',
        image: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=600&q=80',
        colorFrom: 'from-red-700',
        colorTo: 'to-red-950',
        bgBar: 'bg-red-700'
      },
      {
        id: 't6',
        title: 'Poke Bowl',
        votes: 150,
        friends: [],
        type: 'image',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
        colorFrom: 'from-green-500',
        colorTo: 'to-green-900',
        bgBar: 'bg-green-500'
      }
    ]
  },
  {
    id: 'p3',
    type: 'swipe',
    author: 'Viajeros Callejeros',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Travel',
    time: '1h',
    question: 'Destinos Top 2025: ¿Maleta o Casa?',
    totalVotes: 340,
    comments: 56,
    reposts: 12,
    likes: 230,
    options: [
      {
        id: 's1',
        title: 'Kyoto, Japón',
        votes: 220,
        friends: [],
        type: 'image',
        image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80',
        colorFrom: 'from-pink-600',
        colorTo: 'to-pink-900',
        bgBar: 'bg-pink-500'
      },
      {
        id: 's2',
        title: 'Santorini, Grecia',
        votes: 150,
        friends: [],
        type: 'image',
        image: 'https://images.unsplash.com/photo-1613395877344-13d4c2ce52d8?w=600&q=80',
        colorFrom: 'from-blue-600',
        colorTo: 'to-blue-900',
        bgBar: 'bg-blue-500'
      },
      {
        id: 's3',
        title: 'Nueva York, USA',
        votes: 180,
        friends: [],
        type: 'image',
        image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80',
        colorFrom: 'from-slate-600',
        colorTo: 'to-slate-900',
        bgBar: 'bg-slate-500'
      },
      {
        id: 's4',
        title: 'Bali, Indonesia',
        votes: 200,
        friends: [],
        type: 'image',
        image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80',
        colorFrom: 'from-emerald-600',
        colorTo: 'to-emerald-900',
        bgBar: 'bg-emerald-500'
      }
    ]
  },
  {
    id: 'p10',
    type: 'tierlist',
    author: 'Cinefilos Unidos',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Cinema',
    time: '10m',
    question: 'Top 10 Películas de la década (10 Opciones) 🎬',
    totalVotes: 3420,
    comments: 120,
    reposts: 45,
    likes: 890,
    options: generateOptions(10, 'p10', 'Película Épica', 'image')
  },
  {
    id: 'p20',
    type: 'standard',
    author: 'Gamer Zone',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Gamer',
    time: '30m',
    question: 'Vota por el GOTY: Batalla Real de 20 candidatos 🎮',
    totalVotes: 5100,
    comments: 340,
    reposts: 120,
    likes: 2100,
    options: generateOptions(20, 'p20', 'Juego Candidato', 'image')
  }
];
