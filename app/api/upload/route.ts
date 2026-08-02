import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Security Hardening: Validate file size (max 5MB) and type
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
    
    // If ImgBB API key is provided, upload to ImgBB cloud storage
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
          return NextResponse.json({ url: data.data.url });
        }
      } catch (imgbbErr) {
        console.warn('IMGBB Upload warning, falling back to data URL:', imgbbErr);
      }
    }

    // Graceful fallback: return data URL so product image upload always works smoothly
    return NextResponse.json({ url: dataUrl });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
