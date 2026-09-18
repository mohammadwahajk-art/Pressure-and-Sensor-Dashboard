import { get } from '@vercel/blob';

const MANIFEST = 'dashboard/latest-manifest.json';

async function readManifest() {
  const r = await get(MANIFEST, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return await new Response(r.stream).json();
}

export default async function handler(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let manifest;
  try { manifest = await readManifest(); } catch { manifest = null; }
  if (!manifest?.parts?.length) {
    return new Response('No shared dataset uploaded yet.', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  const headers = {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'inline; filename="latest.xlsx"',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Source-Name': encodeURIComponent(manifest.sourceName || 'Shared latest.xlsx'),
    'X-Saved-At': String(Number(manifest.savedAt || 0)),
    'X-File-Size': String(Number(manifest.fileSize || 0))
  };
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

  const output = new ReadableStream({
    async start(controller) {
      try {
        for (const pathname of manifest.parts) {
          const result = await get(pathname, { access: 'private', useCache: false });
          if (!result || result.statusCode !== 200 || !result.stream) throw new Error(`Missing cloud chunk: ${pathname}`);
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
    }
  });

  return new Response(output, { status: 200, headers });
}
