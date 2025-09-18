import { json, type RequestHandler } from '@sveltejs/kit';
import { pollData } from '$lib/poll-data';

export const GET: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  const poll = pollData.find((p) => p.id === id);

  if (!poll) {
    return json({ error: 'Poll not found' }, { status: 404 });
  }

  return json({ data: poll });
};
