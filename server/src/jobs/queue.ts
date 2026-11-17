import type { Job } from "./jobStore.ts";

// Uma conversão por vez, em ordem de chegada: duas conversões de 4 GB juntas derrubam a máquina.
// `convert` não deve lançar: o estado de erro fica no próprio job
export function createQueue(convert: (job: Job, signal: AbortSignal) => Promise<void>) {
  const waiting: Job[] = [];
  let running: { jobId: string; controller: AbortController } | null = null;

  async function runNext(): Promise<void> {
    if (running) return;
    const job = waiting.shift();
    if (!job) return;
    running = { jobId: job.id, controller: new AbortController() };
    try {
      await convert(job, running.controller.signal);
    } finally {
      running = null;
      void runNext();
    }
  }

  function enqueue(job: Job): void {
    waiting.push(job);
    void runNext();
  }

  // Tira da fila ou aborta a conversão em andamento
  function cancel(jobId: string): void {
    const index = waiting.findIndex((job) => job.id === jobId);
    if (index >= 0) waiting.splice(index, 1);
    if (running?.jobId === jobId) running.controller.abort();
  }

  return { enqueue, cancel };
}

export type Queue = ReturnType<typeof createQueue>;
