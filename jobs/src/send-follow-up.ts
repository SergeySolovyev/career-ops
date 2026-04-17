/**
 * Background job: Send follow-up emails
 * Triggered 7-10 days after application with no reply
 */

import { task } from '@trigger.dev/sdk/v3'
import { prisma } from '@careerpilot/db'

export const sendFollowUpJob = task({
  id: 'send-follow-up',
  run: async (payload: { applicationId: string }) => {
    const application = await prisma.application.findUniqueOrThrow({
      where: { id: payload.applicationId },
      include: {
        profile: true,
        vacancy: true,
      },
    })

    // Only follow up on sent/delivered applications without replies
    if (!['sent', 'delivered'].includes(application.status)) {
      return { skipped: true, reason: `Status is ${application.status}` }
    }

    if (application.repliedAt) {
      return { skipped: true, reason: 'Already replied' }
    }

    if (application.followUpCount >= 2) {
      return { skipped: true, reason: 'Max follow-ups reached' }
    }

    // TODO: Implement email send via Resend API or SMTP
    // 1. Generate follow-up text
    // 2. Send email
    // 3. Update application record

    await prisma.application.update({
      where: { id: application.id },
      data: {
        followUpCount: { increment: 1 },
        followUpLastAt: new Date(),
      },
    })

    return {
      applicationId: application.id,
      followUpCount: application.followUpCount + 1,
      status: 'stub',
      message: 'Follow-up tracking updated. Email send will be implemented with Resend API.',
    }
  },
})
