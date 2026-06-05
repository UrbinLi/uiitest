import type {
  DataProfile,
  DataProfileContext,
  DataProfileLifecycleResult,
} from "./types.js";

function passedResult(
  notes: string[] = [],
  createdMarkers: string[] = [],
): DataProfileLifecycleResult {
  return {
    status: "passed",
    notes,
    createdMarkers,
  };
}

function markerFor(context: DataProfileContext): string {
  return `qa_${context.runId}_${context.caseId}`;
}

const profiles: Record<string, DataProfile> = {
  "readonly-shared": {
    name: "readonly-shared",
    safetyLevel: "readonly",
    async setup() {
      return passedResult();
    },
    async cleanup() {
      return passedResult();
    },
  },
  "controlled-write-small": {
    name: "controlled-write-small",
    safetyLevel: "controlled-write",
    async setup(context) {
      const marker = markerFor(context);

      return passedResult([`Using marker ${marker}`], [marker]);
    },
    async cleanup(context) {
      const marker = markerFor(context);

      return passedResult([`Cleaned marker ${marker}`], [marker]);
    },
  },
};

export function getDataProfile(name: string): DataProfile {
  const profile = profiles[name];

  if (!profile) {
    throw new Error(`Unknown data profile: ${name}`);
  }

  return profile;
}
