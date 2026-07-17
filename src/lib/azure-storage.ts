import { BlobServiceClient } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'sales-documents';

let blobServiceClient: BlobServiceClient | null = null;
if (AZURE_STORAGE_CONNECTION_STRING) {
  blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
}

/**
 * Returns the base directory for local file uploads.
 * Uses UPLOAD_DIR env var (outside project) when set, otherwise falls back
 * to public/uploads inside the project (for local dev only).
 */
function getLocalUploadBase(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'public', 'uploads');
}

export async function uploadDocument(fileBuffer: Buffer, originalFileName: string, mimeType: string): Promise<string> {
  const fileName = `${uuidv4()}-${originalFileName}`;

  if (!blobServiceClient) {
    // Fallback: Save to external UPLOAD_DIR (or public/uploads in dev)
    const isExternal = !!process.env.UPLOAD_DIR;
    console.warn(
      `Azure Storage is not configured. Saving to ${isExternal ? 'external UPLOAD_DIR' : 'local public/uploads'}.`
    );

    const uploadDir = path.join(getLocalUploadBase(), CONTAINER_NAME);

    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, fileBuffer);

    // When using external storage, serve via API route; otherwise use static public path
    return isExternal
      ? `/api/uploads/${CONTAINER_NAME}/${fileName}`
      : `/uploads/${CONTAINER_NAME}/${fileName}`;
  }

  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  // Create container if it doesn't exist
  await containerClient.createIfNotExists({ access: 'blob' });

  const blockBlobClient = containerClient.getBlockBlobClient(fileName);

  await blockBlobClient.uploadData(fileBuffer, {
    blobHTTPHeaders: { blobContentType: mimeType },
  });

  return blockBlobClient.url;
}

export async function deleteDocument(fileUrl: string): Promise<void> {
  if (!blobServiceClient) {
    // Fallback: Delete from external UPLOAD_DIR or local public/uploads
    console.warn('Azure Storage is not configured. Deleting from local storage.');

    let relativePath: string | null = null;

    if (fileUrl.startsWith('/api/uploads/')) {
      // External path: strip /api/uploads/ prefix to get <container>/<filename>
      relativePath = fileUrl.replace('/api/uploads/', '');
    } else if (fileUrl.startsWith('/uploads/')) {
      // Legacy dev path: strip /uploads/ prefix
      relativePath = fileUrl.replace('/uploads/', '');
    }

    if (relativePath) {
      const filePath = path.join(getLocalUploadBase(), relativePath);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error('Failed to delete local file:', error);
      }
    }
    return;
  }

  try {
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    // Extract blob name from URL
    const urlParts = fileUrl.split('/');
    const blobName = urlParts[urlParts.length - 1];

    if (blobName) {
      const blockBlobClient = containerClient.getBlockBlobClient(decodeURIComponent(blobName));
      await blockBlobClient.deleteIfExists();
    }
  } catch (error) {
    console.error('Failed to delete blob from Azure Storage:', error);
    // Don't throw, just log so DB row can still be deleted if blob is already gone
  }
}
