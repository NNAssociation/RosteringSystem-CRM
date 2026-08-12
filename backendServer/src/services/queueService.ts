import { Queue, Worker, QueueEvents, Job } from "bullmq";
import { EventEmitter } from "events";

const redisOptions = process.env.REDIS_URL ? {
  connection: {
    url: process.env.REDIS_URL
  }
} : undefined;

// We use an in-memory fallback if Redis is not configured, primarily for development without Redis.
// In production, REDIS_URL should always be defined.

const DISPATCH_QUEUE_NAME = "dispatch-queue";

export const dispatchQueue = redisOptions
  ? new Queue(DISPATCH_QUEUE_NAME, redisOptions)
  : null;

if (!redisOptions) {
  console.warn("BullMQ: REDIS_URL not provided. Background jobs will not be processed!");
} else {
  console.log("BullMQ: Connected to Redis");
}

export const dispatchQueueEvents = redisOptions
  ? new QueueEvents(DISPATCH_QUEUE_NAME, redisOptions)
  : null;

// Registry of job processors
type JobProcessor = (job: Job) => Promise<any>;
const processors: Record<string, JobProcessor> = {};

export function registerJobProcessor(jobName: string, processor: JobProcessor) {
  processors[jobName] = processor;
}

// Global worker setup
export const dispatchWorker = redisOptions
  ? new Worker(
      DISPATCH_QUEUE_NAME,
      async (job: Job) => {
        const processor = processors[job.name];
        if (processor) {
          return await processor(job);
        } else {
          console.warn(`No processor found for job: ${job.name}`);
        }
      },
      redisOptions
    )
  : null;

if (dispatchWorker) {
  dispatchWorker.on("completed", (job: Job) => {
    console.log(`Job ${job.id} (${job.name}) has completed!`);
  });

  dispatchWorker.on("failed", (job: Job | undefined, err: Error) => {
    console.error(`Job ${job?.id} has failed with ${err.message}`);
  });
}

/**
 * Enqueue a job into the dispatch queue.
 * Safe to call even if Redis is disabled (it will just be ignored).
 */
export async function enqueueJob(name: string, data: any, opts?: any) {
  if (dispatchQueue) {
    return await dispatchQueue.add(name, data, opts);
  } else {
    console.warn(`Simulating job ${name} (Redis disabled)`);
  }
}

/**
 * Setup recurring jobs (like crons)
 */
export async function setupRecurringJobs() {
  if (!dispatchQueue) return;

  // Run SLA check every 5 minutes
  await dispatchQueue.add("sla-warning", { slaMinutes: 60 }, {
    repeat: {
      pattern: "*/5 * * * *"
    }
  });

  // Run Auto-Scheduling weekly on Mondays at midnight
  await dispatchQueue.add("auto-schedule", {}, {
    repeat: {
      pattern: "0 0 * * 1"
    }
  });
  
  console.log("Registered recurring jobs");
}
