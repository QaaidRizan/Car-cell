import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { uploadDocument } from '@/lib/azure-storage';
import { FileType } from '@prisma/client';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: saleId } = await context.params;
  try {
    const documents = await prisma.document.findMany({
      where: { saleId },
      orderBy: { uploadedAt: 'desc' },
    });
    return NextResponse.json({ data: documents });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: saleId } = await context.params;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'File is required' }, { status: 400 });

    // Validate size (e.g. 20MB)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File exceeds 20MB limit' }, { status: 400 });
    }

    // Validate type
    const mimeType = file.type;
    let fileType: FileType;
    if (mimeType === 'application/pdf') {
      fileType = 'PDF';
    } else if (mimeType.startsWith('image/')) {
      fileType = 'IMAGE';
    } else {
      return NextResponse.json({ error: 'Only PDF and image files are supported' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileUrl = await uploadDocument(buffer, file.name, mimeType);

    const document = await prisma.document.create({
      data: {
        saleId,
        fileUrl,
        fileType,
        originalFileName: file.name,
      }
    });

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
