import { json, type RequestHandler } from '@sveltejs/kit';
import { pollData } from '$lib/poll-data';

function applyFilters(data: typeof pollData, params: URLSearchParams) {
  let result = data;

  const category = params.get('category');
  if (category) {
    result = result.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }

  const search = params.get('search');
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (p) => p.title.toLowerCase().includes(q) || p.user.name.toLowerCase().includes(q)
    );
  }

  return result;
}

export const GET: RequestHandler = async ({ url }) => {
  const params = url.searchParams;

  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(params.get('limit') ?? '20')));

  const filtered = applyFilters(pollData, params);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const end = start + limit;
  const items = filtered.slice(start, end);

  return json({
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  });
};
