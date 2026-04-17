/**
 * Background job: Scan job boards for new vacancies
 * Runs every 4 hours per user (scheduled by Trigger.dev)
 */

import { task, schedules } from '@trigger.dev/sdk/v3'
import { prisma } from '@careerpilot/db'
import { scanHHRu } from '@careerpilot/core'

export const scanVacanciesJob = task({
  id: 'scan-vacancies',
  run: async (payload: { profileId: string }) => {
    const profile = await prisma.profile.findUnique({
      where: { id: payload.profileId },
      include: { connectedAccounts: true },
    })

    if (!profile) throw new Error(`Profile ${payload.profileId} not found`)

    // 1. Scan hh.ru
    const vacancies = await scanHHRu({
      positiveKeywords: profile.positiveKeywords,
      negativeKeywords: profile.negativeKeywords,
    })

    // 2. Upsert vacancies (deduplicate by URL)
    let newCount = 0
    for (const v of vacancies) {
      const existing = await prisma.vacancy.findUnique({
        where: { profileId_url: { profileId: profile.id, url: v.url } },
      })

      if (!existing) {
        await prisma.vacancy.create({
          data: {
            profileId: profile.id,
            externalId: v.externalId,
            source: v.source,
            url: v.url,
            title: v.title,
            company: v.company || undefined,
            companyUrl: v.companyUrl,
            salaryFrom: v.salaryFrom,
            salaryTo: v.salaryTo,
            salaryCurrency: v.salaryCurrency,
            location: v.location,
            experience: v.experience,
            description: v.description,
          },
        })
        newCount++
      }
    }

    return {
      totalScanned: vacancies.length,
      newVacancies: newCount,
      profileId: profile.id,
    }
  },
})
