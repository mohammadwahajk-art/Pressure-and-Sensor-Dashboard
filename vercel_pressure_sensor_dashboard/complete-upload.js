import { put, get } from '@vercel/blob';

const MANIFEST = 'dashboard/latest-manifest.json';

function requireBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured in Vercel.');
  return token;
}

function verifyKey(request) {
  const expected = process.env.DASHBOARD_UPLOAD_KEY;
  if (!expected) throw new Error('DASHBOARD_UPLOAD_KEY is not configured in Vercel.');
  const supplied = request.headers.get('x-dashboard-key') || '';
  if (supplied !== expected) throw new Error('Invalid upload key.');
}

function validUploadId(value) {
  return /^[a-z0-9-]{10,100}$/i.test(value || '');
}

async function readManifest(token) {
  try {
    const r = await get(MANIFEST, { access: 'private', token, useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return await new Response(r.stream).json();
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    verifyKey(request);
    const token = requireBlobToken();
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
      `dashboard/chunks/${uploadId}/part-${String(i + 1).padStart(5, '0')}.bin`,
    );

    // Validate that every uploaded chunk is readable before publishing the new manifest.
    for (const pathname of parts) {
      const result = await get(pathname, { access: 'private', token, useCache: false });
      if (!result || result.statusCode !== 200) throw new Error(`Missing uploaded chunk: ${pathname}`);
      try { await result.stream?.cancel(); } catch {}
    }

    const previous = await readManifest(token);
    const manifest = {
      version: 2,
      uploadId,
      totalParts,
      parts,
      sourceName,
      savedAt,
      fileSize,
      previousUploadId: previous?.uploadId || null,
    };

    await put(MANIFEST, JSON.stringify(manifest), {
      access: 'private',
      token,
      addRandomSuffix: false,
      contentType: 'application/json',
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });

    return Response.json({ ok: true, savedAt, sourceName, totalParts });
  } catch (error) {
    console.error('complete-upload failed:', error);
    const message = error?.message || 'Could not finalize upload';
    const status = message === 'Invalid upload key.' ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
