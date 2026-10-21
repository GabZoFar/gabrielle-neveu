import { getActivity } from './activity.js';

const CACHE_SECONDS = 6 * 60 * 60;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/activity') return env.ASSETS.fetch(request);

    const cache = caches.default;
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = Response.json(await getActivity(env), {
      headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` },
    });
    ctx.waitUntil(cache.put(request, response.clone()));
    return response;
  },
};
