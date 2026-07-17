import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

/** Simple MIME type lookup based on file extension (no extra deps needed). */
function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const types: Record<string, string> = {
    '.pdf':  'application/pdf',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
    '.svg':  'image/svg+xml',
    '.doc':  'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls':  'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt':  'text/plain',
    '.csv':  'text/csv',
    '.zip':  'application/zip',
  };
  return types[ext] ?? 'application/octet-stream';
}


/**
 * Serves uploaded files from the external UPLOAD_DIR.
 * URL pattern: /api/uploads/<container>/<filename>
 *
 * This route is only used when UPLOAD_DIR env var is set (i.e. not Azure Blob Storage
 * and not the local dev public/uploads fallback). Files live outside the project folder
 * so they survive redeployments.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;

  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const uploadBase = process.env.UPLOAD_DIR;
  if (!uploadBase) {
    // UPLOAD_DIR not set — files are in public/uploads and served statically
    return NextResponse.json(
      { error: 'External upload storage is not configured.' },
      { status: 501 }
    );
  }

  // Prevent path traversal: ensure all segments are safe
  const sanitizedSegments = segments.map((s) => path.basename(s));
  const filePath = path.join(uploadBase, ...sanitizedSegments);

  // Double-check the resolved path is still inside uploadBase
  const resolvedBase = path.resolve(uploadBase);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.startsWith(resolvedBase + path.sep) && resolvedFile !== resolvedBase) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const fileBuffer = await fs.readFile(resolvedFile);
    const fileName = sanitizedSegments[sanitizedSegments.length - 1];
    const mimeType = getMimeType(fileName) || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.byteLength.toString(),
        // Allow browsers to cache for 1 day (files are UUID-named so safe to cache)
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: unknown) {
    const isNotFound =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT';

    if (isNotFound) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    console.error('Failed to serve uploaded file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
