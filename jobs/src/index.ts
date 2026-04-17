// Trigger.dev job definitions for CareerPilot
// Each job runs as a serverless background task

export { scanVacanciesJob } from './scan-vacancies'
export { evaluateVacancyJob } from './evaluate-vacancy'
export { generateCVJob } from './generate-cv'
export { autoApplyJob } from './auto-apply'
export { sendFollowUpJob } from './send-follow-up'
