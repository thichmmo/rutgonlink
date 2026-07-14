import { signOut } from 'next-auth/react'

export async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status === 401) {
    await signOut({ callbackUrl: '/login' })
  }
  return res
}
