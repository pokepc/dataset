import { z } from 'zod'
import reviewedExceptions from './exceptions.json'

const exceptionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    decision: z.enum(['general', 'include', 'exclude']),
    games: z.array(z.string().min(1)),
    url: z.string().url().startsWith('https://bulbapedia.bulbagarden.net/'),
    pageTitle: z.string().min(1),
    reason: z.string().min(1),
    canonicalId: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.decision === 'include' && !entry.games.length) {
      context.addIssue({
        code: 'custom',
        message: 'Included exceptions require positive game evidence',
      })
    }
    if (entry.decision !== 'include' && entry.canonicalId) {
      context.addIssue({
        code: 'custom',
        message: 'Only included locations may specify a corrected canonical ID',
      })
    }
  })

export const locationExceptions = z.array(exceptionSchema).parse(reviewedExceptions)
export const exceptionsById = new Map(locationExceptions.map((entry) => [entry.id, entry]))
if (exceptionsById.size !== locationExceptions.length)
  throw new Error('Duplicate location exception ID')
