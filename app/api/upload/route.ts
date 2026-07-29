import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      console.error('IMGBB_API_KEY is not set');
      return NextResponse.json({ error: 'Image upload is not configured' }, { status: 500 });
    }

    // Convert file to base64
    const buffer = await file.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');

    const imgbbFormData = new FormData();
    imgbbFormData.append('key', apiKey);
    imgbbFormData.append('image', base64Image);

    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: imgbbFormData,
    });

    const data = await response.json();

    if (data.success) {
      return NextResponse.json({ url: data.data.url });
    } else {
      console.error('IMGBB Error:', data);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
