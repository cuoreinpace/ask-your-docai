import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const res = await axios.post(`${API_URL}/v1/auth/register`, body)
    return NextResponse.json(res.data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json(
      { message: err.response?.data?.message || 'Registration failed' },
      { status: err.response?.status || 500 }
    )
  }
}