import { put, get, del } from '@vercel/blob';

function verifyKey(request) {
  const expected = process.env.DASHBOARD_UPLOAD_KEY;
  if (!expected) throw new Error('DASHBOARD_UPLOAD_KEY is not configured in Vercel.');
  const supplied = request.headers.get('x-dashboard-key') || '';
  if (supplied !== expected) throw new Error('Invalid upload key.');
}

function validUploadId(value) {
  return /^[a-z0-9-]{10,100}$/i.test(value || '');
}

const MANIFEST = 'dashboard/latest-manifest.json';

async function readManifest() {
  try {
    const r = await get(MANIFEST, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return await new Response(r.stream).json();
  } catch { return null; }
}

export default async function handler(request) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    verifyKey(request);
    const body = await request.json();
    const uploadId = String(body.uploadId || '');
    const totalParts = Number(body.totalParts || 0);
    const sourceName = String(body.sourceName || 'latest.xlsx').slice(0, 180);
    const savedAt = Number(body.savedAt || Date.now());
    const fileSize = Number(body.fileSize || 0);

    if (!validUploadId(uploadId)) throw new Error('Invalid upload id.');
    if (!Number.isInteger(totalParts) || totalParts < 1 || totalParts > 5000) throw new Error('Invalid part count.');
    if (!/\.xlsx$/i.test(sourceName)) throw new Error('Only .xlsx files are supported.');

    const parts = Array.from({ length: totalParts }, (_, i) =>
      `dashboard/chunks/${uploadId}/part-${String(i+1).padStart(5,'0')}.bin`
    );

    const old = await readManifest();
    const manifest = { version: 1, uploadId, totalParts, parts, sourceName, savedAt, fileSize };
    await put(MANIFEST, JSON.stringify(manifest), {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
      cacheControlMaxAge: 60
    });

    if (old?.parts?.length && old.uploadId !== uploadId) {
      try { await del(old.parts); } catch (e) { console.warn('Old chunk cleanup failed:', e); }
    }

    return Response.json({ ok: true, savedAt, sourceName, totalParts });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not finalize upload' }, { status: 400 });
  }
}
