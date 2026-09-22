import { put } from '@vercel/blob';

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

export async function POST(request) {
  try {
    verifyKey(request);
    const token = requireBlobToken();
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

    const pathname = `dashboard/chunks/${uploadId}/part-${String(partNumber).padStart(5, '0')}.bin`;
    const blob = await put(pathname, body, {
      access: 'private',
      token,
      addRandomSuffix: false,
      contentType: 'application/octet-stream',
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });

    return Response.json({
      ok: true,
      partNumber,
      size: body.byteLength,
      pathname: blob.pathname,
    });
  } catch (error) {
    console.error('upload-part failed:', error);
    const message = error?.message || 'Chunk upload failed';
    const status = message === 'Invalid upload key.' ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
