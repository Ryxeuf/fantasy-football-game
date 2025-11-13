import { NextRequest, NextResponse } from 'next/server';

const SERVER_API_BASE = process.env.SERVER_API_BASE || 'http://server:8201';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const url = `${SERVER_API_BASE}/api/rosters/${params.slug}${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error(`Erreur proxy /api/rosters/${params.slug}:`, error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

