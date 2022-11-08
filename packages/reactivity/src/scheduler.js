export let jobQueue = new Set()
let isFlushing = false
const p = Promise.resolve()

export function flushJob(job) {
  jobQueue.add(job)
  if (isFlushing) return
  isFlushing = true
  p.then(() => {
    jobQueue.forEach(job => job())
  }).finally(() => {
    isFlushing = false
  })
}