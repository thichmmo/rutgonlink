import { google } from 'googleapis'

function getFolderName(email: string) {
  return `Ghi Chú - ${email} - rutgonlink.site`
}
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const USERINFO_SCOPE = 'https://www.googleapis.com/auth/userinfo.email'

function getOAuth2Client(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  )
}

function buildRedirectUri(baseUrl: string) {
  return `${baseUrl}/api/drive/callback`
}

export function getDriveAuthUrl(baseUrl: string) {
  const oauth2 = getOAuth2Client(buildRedirectUri(baseUrl))
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [DRIVE_SCOPE, USERINFO_SCOPE],
  })
}

export async function exchangeCodeForTokens(code: string, baseUrl: string) {
  const oauth2 = getOAuth2Client(buildRedirectUri(baseUrl))
  const { tokens } = await oauth2.getToken(code)
  return tokens
}

export async function getDriveUserEmail(refreshToken: string): Promise<string | null> {
  try {
    const oauth2 = getOAuth2Client('')
    oauth2.setCredentials({ refresh_token: refreshToken })
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 })
    const info = await oauth2Api.userinfo.get()
    return info.data.email ?? null
  } catch {
    return null
  }
}

function getDriveClient(refreshToken: string) {
  const oauth2 = getOAuth2Client('')
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.drive({ version: 'v3', auth: oauth2 })
}

export async function getOrCreateDriveFolder(
  refreshToken: string,
  email: string,
  existingFolderId?: string | null,
): Promise<string> {
  const drive = getDriveClient(refreshToken)
  const folderName = getFolderName(email)

  // Try existing folder first
  if (existingFolderId) {
    try {
      const check = await drive.files.get({ fileId: existingFolderId, fields: 'id,trashed' })
      if (check.data.id && !check.data.trashed) return existingFolderId
    } catch {
      // folder may have been deleted, fall through to create
    }
  }

  // Search for existing folder by name
  const search = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  })
  if (search.data.files && search.data.files.length > 0) {
    return search.data.files[0].id!
  }

  // Create new folder
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  })
  return folder.data.id!
}

function buildFileContent(title: string, content: string): string {
  return `${title}\n${'='.repeat(title.length)}\n\n${content}`
}

function safeName(title: string): string {
  return (title.replace(/[/\\?%*:|"<>]/g, '-') || 'ghi-chu') + '.txt'
}

export async function createDriveFile(
  refreshToken: string,
  folderId: string,
  title: string,
  content: string,
): Promise<string> {
  const drive = getDriveClient(refreshToken)
  const file = await drive.files.create({
    requestBody: { name: safeName(title), parents: [folderId] },
    media: { mimeType: 'text/plain', body: buildFileContent(title, content) },
    fields: 'id',
  })
  return file.data.id!
}

export async function updateDriveFile(
  refreshToken: string,
  fileId: string,
  title: string,
  content: string,
): Promise<void> {
  const drive = getDriveClient(refreshToken)
  await drive.files.update({
    fileId,
    requestBody: { name: safeName(title) },
    media: { mimeType: 'text/plain', body: buildFileContent(title, content) },
  })
}

export async function getOrCreateSubFolder(
  refreshToken: string,
  parentFolderId: string,
  subFolderName: string,
): Promise<string> {
  const drive = getDriveClient(refreshToken)

  const search = await drive.files.list({
    q: `name='${subFolderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  })
  if (search.data.files && search.data.files.length > 0) {
    return search.data.files[0].id!
  }

  const folder = await drive.files.create({
    requestBody: {
      name: subFolderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
  })
  return folder.data.id!
}

// Di chuyển file sang một folder khác (lấy parent hiện tại tự động)
export async function moveFileBetweenFolders(
  refreshToken: string,
  fileId: string,
  toFolderId: string,
): Promise<void> {
  const drive = getDriveClient(refreshToken)
  const fileInfo = await drive.files.get({ fileId, fields: 'parents' })
  const currentParents = fileInfo.data.parents?.join(',') || ''
  await drive.files.update({
    fileId,
    addParents: toFolderId,
    removeParents: currentParents,
    fields: 'id',
  })
}

export async function moveFileToDeletedFolder(
  refreshToken: string,
  fileId: string,
  mainFolderId: string,
): Promise<void> {
  const deletedFolderId = await getOrCreateSubFolder(refreshToken, mainFolderId, 'Đã xóa')
  await moveFileBetweenFolders(refreshToken, fileId, deletedFolderId)
}
