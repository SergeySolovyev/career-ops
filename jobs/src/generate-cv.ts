/**
 * Background job: Generate tailored CV PDF
 * Triggered when user clicks "Apply" for a vacancy with score >= 4.0
 */

import { task } from '@trigger.dev/sdk/v3'
import { prisma } from '@careerpilot/db'

export const generateCVJob = task({
  id: 'generate-cv',
  run: async (payload: {
    profileId: string
    vacancyId: string
    evaluationId: string
  }) => {
    const [profile, vacancy, evaluation] = await Promise.all([
      prisma.profile.findUniqueOrThrow({ where: { id: payload.profileId } }),
      prisma.vacancy.findUniqueOrThrow({ where: { id: payload.vacancyId } }),
      prisma.evaluation.findUniqueOrThrow({ where: { id: payload.evaluationId } }),
    ])

    // TODO: Port cv-engine from career-ops
    // 1. Call Anthropic API to tailor CV for this specific JD
    // 2. Fill cv-template.html with tailored content
    // 3. Use Playwright to generate PDF
    // 4. Upload to Vercel Blob Storage
    // 5. Run cv-keyword-score for ATS optimization
    // 6. If ATS < 75%, iterate (max 2 attempts)

    return {
      status: 'stub',
      message: 'CV generation will be ported from career-ops generate-pdf.mjs + auto-evaluate.mjs tailorCV()',
      profileId: profile.id,
      vacancyId: vacancy.id,
    }
  },
})
