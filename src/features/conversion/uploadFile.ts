import { putChunk } from "./api";

const PARALLEL_CHUNKS = 3;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Uma queda de rede derruba só o pedaço em andamento: ele é refeito, os outros seguem
async function withRetries(send: () => Promise<void>, signal: AbortSignal): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await send();
    } catch (error) {
      if (signal.aborted || attempt >= MAX_ATTEMPTS) throw error;
      await wait(RETRY_DELAY_MS * attempt);
    }
  }
}

// Envia o arquivo em pedaços, 3 ao mesmo tempo. File.slice só lê do disco o pedaço da vez:
// o arquivo inteiro (até 3 GB) nunca entra na memória do navegador
export async function uploadFile(
  file: File,
  jobId: string,
  chunkSize: number,
  onProgress: (bytesSent: number) => void,
  signal: AbortSignal,
): Promise<void> {
  const chunkCount = Math.ceil(file.size / chunkSize);
  let nextIndex = 0;
  let bytesSent = 0;

  async function sendChunk(index: number): Promise<void> {
    const chunk = file.slice(index * chunkSize, (index + 1) * chunkSize);
    await withRetries(() => putChunk(jobId, index, chunk, signal), signal);
    bytesSent += chunk.size;
    onProgress(bytesSent);
  }

  // Cada trilha pega o próximo pedaço livre até acabarem
  async function lane(): Promise<void> {
    while (nextIndex < chunkCount) await sendChunk(nextIndex++);
  }

  await Promise.all(Array.from({ length: Math.min(PARALLEL_CHUNKS, chunkCount) }, lane));
}
