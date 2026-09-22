import { get } from '@vercel/blob';

const MANIFEST = 'dashboard/latest-manifest.json';

function requireBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured in Vercel.');
  return token;
}

export async function GET() {
  try {
    const token = requireBlobToken();
    const r = await get(MANIFEST, { access: 'private', token, useCache: false });
    if (!r || r.statusCode !== 200) {
      return Response.json({ exists: false, savedAt: 0 }, {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    const m = await new Response(r.stream).json();
    return Response.json({
      exists: true,
      savedAt: Number(m.savedAt || 0),
      sourceName: m.sourceName || 'Shared latest.xlsx',
      fileSize: Number(m.fileSize || 0),
      totalParts: Number(m.totalParts || 0),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('status failed:', error);
    return Response.json({ exists: false, savedAt: 0, error: error?.message || 'Status failed' }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
