/**
 * Background job: Automatically apply to a vacancy
 * Supports: hh.ru API, email fallback
 */

import { task } from '@trigger.dev/sdk/v3'
import { prisma } from '@careerpilot/db'
import { generateCoverLetter } from '@careerpilot/core'

export const autoApplyJob = task({
  id: 'auto-apply',
  run: async (payload: {
    profileId: string
    vacancyId: string
    evaluationId: string
    cvPdfUrl?: string
  }) => {
    const [profile, vacancy, evaluation] = await Promise.all([
      prisma.profile.findUniqueOrThrow({
        where: { id: payload.profileId },
        include: { connectedAccounts: true },
      }),
      prisma.vacancy.findUniqueOrThrow({ where: { id: payload.vacancyId } }),
      prisma.evaluation.findUniqueOrThrow({ where: { id: payload.evaluationId } }),
    ])

    // 1. Generate cover letter
    const coverLetter = await generateCoverLetter(
      {
        jdText: vacancy.description || '',
        company: vacancy.company || '',
        role: vacancy.title,
        cvText: profile.cvText || '',
        strengths: evaluation.aiStrengths,
        keywords: profile.positiveKeywords,
        lang: 'ru',
      },
      process.env.ANTHROPIC_API_KEY
        ? {
            apiKey: process.env.ANTHROPIC_API_KEY,
            model: process.env.ANTHROPIC_MODEL,
            baseUrl: process.env.ANTHROPIC_BASE_URL,
          }
        : undefined
    )

    // 2. Create application record
    const application = await prisma.application.create({
      data: {
        profileId: profile.id,
        vacancyId: vacancy.id,
        evaluationId: evaluation.id,
        status: 'draft',
        coverLetterText: coverLetter.text,
        cvPdfUrl: payload.cvPdfUrl,
      },
    })

    // 3. Apply via appropriate channel
    // TODO: Implement hh.ru API apply and email fallback
    // For now, mark as draft for user review

    return {
      applicationId: application.id,
      coverLetterProvider: coverLetter.provider,
      status: 'draft',
      message: 'Application created. Auto-apply channels (hh.ru API, email) will be implemented in Phase C.',
    }
  },
})
