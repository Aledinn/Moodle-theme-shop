import { useEffect, useState } from "react";

export type RequestState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };

// The caller memoizes load. Changing it cancels and supersedes the previous request.
export function useRequest<T>(
  load: (signal: AbortSignal) => Promise<T>,
): RequestState<T> {
  const [state, setState] = useState<RequestState<T>>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: "success", data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Something went wrong. Please try again.",
          });
        }
      },
    );
    return () => controller.abort();
  }, [load]);
  return state;
}
