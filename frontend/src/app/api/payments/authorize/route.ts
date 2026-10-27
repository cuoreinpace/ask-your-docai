import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ message: 'Missing token' }, { status: 401 })
    }
    const caseId = request.nextUrl.searchParams.get('caseId')
    const res = await axios.post(
      `${API_URL}/v1/payments/authorization`,
      { amountCents: 3900, currency: 'EUR' },
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { caseId },
      }
    )
    return NextResponse.json(res.data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json(
      { message: err.response?.data?.message || 'Payment authorization failed' },
      { status: err.response?.status || 500 }
    )
  }
}