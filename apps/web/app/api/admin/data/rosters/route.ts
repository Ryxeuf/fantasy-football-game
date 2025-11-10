import { NextRequest, NextResponse } from 'next/server';

const SERVER_API_BASE = process.env.SERVER_API_BASE || 'http://server:8201';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');
    
    const response = await fetch(`${SERVER_API_BASE}/admin/data/rosters`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    });

    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Erreur proxy /admin/data/rosters:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');
    
    const body = await request.json();
    
    const response = await fetch(`${SERVER_API_BASE}/admin/data/rosters`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Erreur proxy POST /admin/data/rosters:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

