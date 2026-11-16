export type JobState = "uploading" | "queued" | "converting" | "done" | "error";
export type ModelFormat = "pointcloud" | "frag" | "glb";

export interface JobResult {
  format: ModelFormat;
  url: string;
}

export interface JobStatus {
  state: JobState;
  progress: number | null; // 0 a 1, ou null quando o conversor não informa
  message?: string;
  result?: JobResult;
}
