import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const agentUrl  = process.env.AGENT_URL
  const secret    = process.env.INITIATE_SECRET

  if (!agentUrl || !secret) {
    return NextResponse.json({ error: 'AGENT_URL or INITIATE_SECRET not configured' }, { status: 500 })
  }

  const body = await req.json()

  const res = await fetch(`${agentUrl}/api/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-initiate-secret': secret,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
