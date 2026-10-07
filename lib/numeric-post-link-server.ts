import { randomInt } from 'node:crypto'
import { Prisma } from '@prisma/client'

type SlugLookup = {
  findUnique(args: { where: { slug: string }; select: { id: true } }): Promise<unknown>
}

export async function allocateNumericPostSlug(store: SlugLookup) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const slug = `p7-${randomInt(10000, 100000)}`
    if (await store.findUnique({ where: { slug }, select: { id: true } })) continue
    return slug
  }
  throw new NumericPostLinkExhaustedError()
}

export class NumericPostLinkExhaustedError extends Error {
  constructor() {
    super('Chưa cấp được mã link bài viết. Vui lòng thử lại.')
  }
}

export async function retryNumericPostCreation<T>(createTransaction: () => Promise<T>) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    try {
      return await createTransaction()
    } catch (error) {
      // A race rolls back the whole variant batch before a new transaction/code.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
    }
  }
  throw new NumericPostLinkExhaustedError()
}
