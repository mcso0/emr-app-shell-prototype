type ServerTimingMetric = "permission" | "rpc" | "session";

type ServerTimingDurations = Record<ServerTimingMetric | "total", number>;

type ServerTimingLogger = (
  message: string,
  details: {
    durations: ServerTimingDurations;
    method: string;
    route: string;
    status: number;
  },
) => void;

type ServerTimingRecorderOptions = {
  logger?: ServerTimingLogger;
  method: string;
  now?: () => number;
  route: string;
};

const orderedMetrics: ServerTimingMetric[] = ["session", "permission", "rpc"];
const responseMetrics: Array<keyof ServerTimingDurations> = [
  ...orderedMetrics,
  "total",
];

function roundDuration(value: number) {
  return Math.round(Math.max(0, value) * 10) / 10;
}

export function createServerTimingRecorder({
  logger = (message, details) => console.info(message, details),
  method,
  now = () => performance.now(),
  route,
}: ServerTimingRecorderOptions) {
  const startedAt = now();
  const durations: Record<ServerTimingMetric, number> = {
    session: 0,
    permission: 0,
    rpc: 0,
  };

  return {
    async measure<T>(metric: ServerTimingMetric, operation: () => Promise<T>) {
      const metricStartedAt = now();
      try {
        return await operation();
      } finally {
        durations[metric] += now() - metricStartedAt;
      }
    },
    respond(response: Response) {
      const completedDurations: ServerTimingDurations = {
        session: roundDuration(durations.session),
        permission: roundDuration(durations.permission),
        rpc: roundDuration(durations.rpc),
        total: roundDuration(now() - startedAt),
      };

      response.headers.set(
        "Server-Timing",
        responseMetrics
          .map((metric) => `${metric};dur=${completedDurations[metric].toFixed(1)}`)
          .join(", "),
      );
      logger("clair_request_timing", {
        durations: completedDurations,
        method,
        route,
        status: response.status,
      });
      return response;
    },
  };
}

export type ServerTimingRecorder = ReturnType<typeof createServerTimingRecorder>;
