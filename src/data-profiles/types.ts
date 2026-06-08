export type DataProfileContext = {
  runId: string;
  caseId: string;
};

export type DataProfileLifecycleResult = {
  status: "passed" | "failed";
  notes: string[];
  createdMarkers: string[];
};

export type DataProfile = {
  name: string;
  safetyLevel: "readonly" | "controlled-write" | "dangerous-write";
  setup(context: DataProfileContext): Promise<DataProfileLifecycleResult>;
  cleanup(context: DataProfileContext): Promise<DataProfileLifecycleResult>;
};
