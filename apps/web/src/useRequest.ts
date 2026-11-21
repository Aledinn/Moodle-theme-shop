import { useEffect, useState } from "react";

export type RequestState<T> =
  | { status: "loading"; data?: T }
  | { status: "success"; data: T }
  | { status: "error"; message: string; data?: T };

// The caller memoizes load. Changing it cancels and supersedes the previous request.
export function useRequest<T>(
  load: (signal: AbortSignal) => Promise<T>,
  retainPrevious = false,
): RequestState<T> {
  const [state, setState] = useState<RequestState<T>>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({
      status: "loading",
      data: retainPrevious ? previous.data : undefined,
    }));
    void load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: "success", data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState((previous) => ({
            status: "error",
            data: retainPrevious ? previous.data : undefined,
            message:
              error instanceof Error
                ? error.message
                : "Something went wrong. Please try again.",
          }));
        }
      },
    );
    return () => controller.abort();
  }, [load, retainPrevious]);
  return state;
}
