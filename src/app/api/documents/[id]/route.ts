import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { deleteDocument } from '@/lib/azure-storage';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;

  try {
    const document = await prisma.document.findUnique({
      where: { id }
    });

    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Delete from Azure Storage
    await deleteDocument(document.fileUrl);

    // Delete from Postgres
    await prisma.document.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
