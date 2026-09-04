import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function POST(req: NextRequest) {
  const ctx = extractTenantContext(req);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'upload:upload')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
    }

    const mimeType = file.type || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const apiKey = process.env.IMGBB_API_KEY;

    if (apiKey && apiKey.trim().length > 0) {
      try {
        const imgbbFormData = new FormData();
        imgbbFormData.append('key', apiKey);
        imgbbFormData.append('image', base64Image);

        const response = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          body: imgbbFormData,
        });

        const data = await response.json();

        if (data.success && data.data?.url) {
          return NextResponse.json({ data: { url: data.data.url } });
        }
      } catch (imgbbErr) {
        console.warn('IMGBB Upload warning, falling back to data URL:', imgbbErr);
      }
    }

    return NextResponse.json({ data: { url: dataUrl } });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
