import { NextRequest, NextResponse } from 'next/server';
import { getAIResponse } from '@/lib/services/support.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question } = body;

    if (!question) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 });
    }

    const response = await getAIResponse(question);
    return NextResponse.json({ data: response });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
