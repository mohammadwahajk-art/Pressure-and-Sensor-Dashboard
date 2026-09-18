import { get } from '@vercel/blob';

const MANIFEST = 'dashboard/latest-manifest.json';

export default async function handler(request) {
  if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  try {
    const r = await get(MANIFEST, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) throw new Error('No shared dataset');
    const m = await new Response(r.stream).json();
    return Response.json({
      exists: true,
      savedAt: Number(m.savedAt || 0),
      sourceName: m.sourceName || 'Shared latest.xlsx',
      fileSize: Number(m.fileSize || 0),
      totalParts: Number(m.totalParts || 0)
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ exists: false, savedAt: 0 }, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}
