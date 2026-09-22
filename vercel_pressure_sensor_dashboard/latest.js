import { get } from '@vercel/blob';

const MANIFEST = 'dashboard/latest-manifest.json';

function requireBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured in Vercel.');
  return token;
}

async function readManifest(token) {
  const r = await get(MANIFEST, { access: 'private', token, useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return await new Response(r.stream).json();
}

function headersFor(manifest) {
  return {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'inline; filename="latest.xlsx"',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Source-Name': encodeURIComponent(manifest.sourceName || 'Shared latest.xlsx'),
    'X-Saved-At': String(Number(manifest.savedAt || 0)),
    'X-File-Size': String(Number(manifest.fileSize || 0)),
  };
}

export async function HEAD() {
  try {
    const token = requireBlobToken();
    const manifest = await readManifest(token);
    if (!manifest?.parts?.length) {
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    return new Response(null, { status: 200, headers: headersFor(manifest) });
  } catch (error) {
    console.error('latest HEAD failed:', error);
    return new Response(null, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function GET() {
  try {
    const token = requireBlobToken();
    const manifest = await readManifest(token);
    if (!manifest?.parts?.length) {
      return new Response('No shared dataset uploaded yet.', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const partResults = [];
    for (const pathname of manifest.parts) {
      const result = await get(pathname, { access: 'private', token, useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) {
        throw new Error(`Missing cloud chunk: ${pathname}`);
      }
      partResults.push(result);
    }

    const output = new ReadableStream({
      async start(controller) {
        try {
          for (const result of partResults) {
            const reader = result.stream.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(output, { status: 200, headers: headersFor(manifest) });
  } catch (error) {
    console.error('latest GET failed:', error);
    return Response.json({ error: error?.message || 'Could not load shared dataset' }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
