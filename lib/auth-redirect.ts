export function getSafeAuthRedirect(value: string | null | undefined): string {
  // Chỉ nhận path cùng origin; chặn protocol-relative URL và backslash normalization.
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/dashboard'
  }

  const baseUrl = 'http://localhost'

  try {
    const redirectUrl = new URL(value, baseUrl)
    if (redirectUrl.origin !== baseUrl) return '/dashboard'
    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`
  } catch {
    return '/dashboard'
  }
}

export function getAuthErrorMessage(error: string | null): string {
  if (!error) return ''

  if (error === 'OAuthAccountNotLinked') {
    return 'Email này đã được đăng ký bằng phương thức khác.'
  }

  if (['OAuthSignin', 'OAuthCallback', 'OAuthCreateAccount'].includes(error)) {
    return 'Không thể đăng nhập bằng Google. Vui lòng thử lại.'
  }

  if (error === 'Configuration') {
    return 'Đăng nhập Google chưa được cấu hình trên máy chủ.'
  }

  return 'Đăng nhập không thành công. Vui lòng thử lại.'
}
