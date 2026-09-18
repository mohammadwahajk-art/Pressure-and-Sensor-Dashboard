import { put } from '@vercel/blob';

function verifyKey(request) {
  const expected = process.env.DASHBOARD_UPLOAD_KEY;
  if (!expected) throw new Error('DASHBOARD_UPLOAD_KEY is not configured in Vercel.');
  const supplied = request.headers.get('x-dashboard-key') || '';
  if (supplied !== expected) throw new Error('Invalid upload key.');
}

function validUploadId(value) {
  return /^[a-z0-9-]{10,100}$/i.test(value || '');
}

export default async function handler(request) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    verifyKey(request);
    const url = new URL(request.url);
    const uploadId = url.searchParams.get('uploadId') || '';
    const partNumber = Number(url.searchParams.get('partNumber') || 0);
    if (!validUploadId(uploadId)) throw new Error('Invalid upload id.');
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 5000) throw new Error('Invalid part number.');

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 3.25 * 1024 * 1024) throw new Error('Chunk is too large.');
    const body = await request.arrayBuffer();
    if (!body.byteLength) throw new Error('Empty upload chunk.');
    if (body.byteLength > 3.25 * 1024 * 1024) throw new Error('Chunk is too large.');

    const pathname = `dashboard/chunks/${uploadId}/part-${String(partNumber).padStart(5,'0')}.bin`;
    const blob = await put(pathname, body, {
      access: 'private',
      contentType: 'application/octet-stream',
      allowOverwrite: true,
      cacheControlMaxAge: 60
    });
    return Response.json({ ok: true, partNumber, size: body.byteLength, pathname: blob.pathname });
  } catch (error) {
    return Response.json({ error: error?.message || 'Chunk upload failed' }, { status: 400 });
  }
}
