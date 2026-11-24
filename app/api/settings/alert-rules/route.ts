import { NextRequest, NextResponse } from 'next/server';
import { validateAlertRules } from '@/lib/alerts/rules';
import { getAlertRules, saveAlertRules } from '@/lib/data/alert-rules';

export async function GET() {
  return NextResponse.json(await getAlertRules());
}

export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'The request body must be JSON.' }, { status: 400 });
  }

  const result = validateAlertRules(body);
  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  await saveAlertRules(result.rules);
  return NextResponse.json(result.rules);
}
