import type { Poll } from '$lib/types';

export const pollData: Poll[] = [
	{
		id: 1,
		user: { name: 'Mark C.', avatar: '/placeholder.svg?width=40&height=40' },
		title: 'Do you support renewable energy?',
		category: 'Politics',
		options: [
			{ title: 'Yes', percentage: 72 },
			{ title: 'No', percentage: 28 }
		],
		votedOptionIndex: null,
		likes: 432,
		comments: 10
	},
	{
		id: 5,
		user: { name: 'Community', avatar: '/placeholder.svg?width=40&height=40' },
		title: 'What is the most important feature for our next update?',
		category: 'Feedback',
		image: '/placeholder.svg?width=400&height=200',
		options: Array.from({ length: 20 }, (_, i) => ({
			title: `Feature Option #${i + 1}`,
			percentage: Math.floor(Math.random() * 100),
			image: `/placeholder.svg?width=100&height=100&query=abstract+icon+${i + 1}`
		})).sort((a, b) => b.percentage - a.percentage),
		votedOptionIndex: null,
		likes: 1500,
		comments: 250
	},
	{
		id: 2,
		user: { name: 'Ava H.', avatar: '/placeholder.svg?width=40&height=40' },
		title: "What's your favorite type of cuisine?",
		category: 'Food',
		options: [
			{
				title: 'Italian',
				percentage: 45,
				image: '/placeholder.svg?width=100&height=100'
			},
			{
				title: 'Mexican',
				percentage: 35,
				image: '/placeholder.svg?width=100&height=100'
			},
			{
				title: 'Japanese',
				percentage: 20,
				image: '/placeholder.svg?width=100&height=100'
			}
		],
		votedOptionIndex: null,
		likes: 1024,
		comments: 88
	},
	{
		id: 3,
		user: { name: 'John D.', avatar: '/placeholder.svg?width=40&height=40' },
		title: 'Should remote work be the standard?',
		category: 'Work',
		image: '/placeholder.svg?width=400&height=200',
		options: [
			{ title: 'Yes, full remote', percentage: 60 },
			{ title: 'Hybrid model', percentage: 40 }
		],
		votedOptionIndex: 1,
		likes: 512,
		comments: 34
	},
	{
		id: 4,
		user: { name: 'Sophia L.', avatar: '/placeholder.svg?width=40&height=40' },
		title: 'Is space exploration a good use of funds?',
		category: 'Science',
		options: [
			{ title: 'Absolutely', percentage: 68 },
			{ title: 'Not a priority', percentage: 32 }
		],
		votedOptionIndex: null,
		likes: 876,
		comments: 120
	},
  // Generated extra polls for feed/infinite scroll
  ...Array.from({ length: 60 }, (_, i) => {
    const id = 100 + i;
    const yes = Math.floor(Math.random() * 100);
    const no = Math.max(0, 100 - yes);
    return {
      id,
      user: { name: `User ${i + 1}` as string, avatar: '/placeholder.svg?width=40&height=40' },
      title: `¿Te gusta la encuesta #${i + 1}?`,
      category: 'General',
      options: [
        { title: 'Sí', percentage: yes },
        { title: 'No', percentage: no }
      ],
      votedOptionIndex: null,
      likes: Math.floor(Math.random() * 2000),
      comments: Math.floor(Math.random() * 300)
    } as Poll;
  })
];
