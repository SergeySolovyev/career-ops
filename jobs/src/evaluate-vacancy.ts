/**
 * Background job: AI-evaluate a single vacancy
 * Triggered when a new vacancy is discovered or user clicks "Evaluate"
 */

import { task } from '@trigger.dev/sdk/v3'
import { prisma } from '@careerpilot/db'
import { preScreen, aiEvaluate } from '@careerpilot/core'
import { canEvaluate } from '@careerpilot/config'

export const evaluateVacancyJob = task({
  id: 'evaluate-vacancy',
  run: async (payload: { profileId: string; vacancyId: string }) => {
    const [profile, vacancy, subscription] = await Promise.all([
      prisma.profile.findUniqueOrThrow({ where: { id: payload.profileId } }),
      prisma.vacancy.findUniqueOrThrow({ where: { id: payload.vacancyId } }),
      prisma.subscription.findUnique({ where: { profileId: payload.profileId } }),
    ])

    // Check subscription limits
    const plan = subscription?.plan ?? 'free'
    const used = subscription?.evaluationsUsed ?? 0
    if (!canEvaluate(plan as any, used)) {
      return { error: 'evaluation_limit_reached', plan, used }
    }

    // Stage 1: Pre-screen (free, keyword matching)
    const preResult = preScreen(
      vacancy.title,
      vacancy.description || '',
      vacancy.company || '',
      profile.positiveKeywords,
      profile.negativeKeywords
    )

    if (!preResult.passed) {
      // Save pre-screen result only
      await prisma.evaluation.create({
        data: {
          profileId: profile.id,
          vacancyId: vacancy.id,
          preScore: preResult.score,
          aiVerdict: 'skip',
          aiSummary: `Pre-screen failed: score ${preResult.score} < 2.0`,
        },
      })
      return { stage: 'pre-screen', verdict: 'skip', preScore: preResult.score }
    }

    // Stage 2: AI evaluation (costs ~$0.01)
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return { error: 'no_api_key' }
    }

    const aiResult = await aiEvaluate(
      vacancy.title,
      vacancy.company || '',
      vacancy.description || '',
      {
        apiKey,
        model: process.env.ANTHROPIC_MODEL,
        baseUrl: process.env.ANTHROPIC_BASE_URL,
        cvText: profile.cvText || '',
      }
    )

    // Save full evaluation
    await prisma.evaluation.create({
      data: {
        profileId: profile.id,
        vacancyId: vacancy.id,
        preScore: preResult.score,
        aiScore: aiResult.score,
        aiSummary: aiResult.summary,
        aiStrengths: aiResult.strengths,
        aiWeaknesses: aiResult.weaknesses,
        aiVerdict: aiResult.verdict,
        archetype: aiResult.archetype,
        reportMarkdown: aiResult.reportMarkdown,
      },
    })

    // Increment usage counter
    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { evaluationsUsed: { increment: 1 } },
      })
    }

    return {
      stage: 'ai',
      score: aiResult.score,
      verdict: aiResult.verdict,
      summary: aiResult.summary,
    }
  },
})
