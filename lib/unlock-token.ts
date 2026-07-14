import { createHmac } from 'crypto'

/**
 * Tạo token HMAC dùng để xác nhận user đã unlock link thành công.
 * Token này được lưu trong cookie thay vì plaintext password.
 */
export function createUnlockToken(shortCode: string): string {
  const secret = process.env.NEXTAUTH_SECRET || ''
  return createHmac('sha256', secret).update(`unlock:${shortCode}`).digest('hex')
}
