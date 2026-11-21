import { useCallback, useState } from "react";
import { getTheme } from "./api";
import { useRequest } from "./useRequest";

export function ThemeDetails({ id }: { id: string }) {
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(
    (signal: AbortSignal) => getTheme(id, signal),
    [id, attempt],
  );
  const state = useRequest(load);
  return (
    <main className="theme-details">
      <a href="/">Back to theme catalog</a>
      {state.status === "loading" && <p role="status">Loading theme...</p>}
      {state.status === "error" && (
        <div>
          <p role="alert">{state.message}</p>
          <button onClick={() => setAttempt((value) => value + 1)}>Try again</button>
        </div>
      )}
      {state.status === "success" && (
        <article>
          <h1>{state.data.name}</h1>
          <p>{state.data.description || "No description available."}</p>
          <dl>
            <dt>Author</dt><dd>{state.data.author}</dd>
            <dt>Version</dt><dd>{state.data.version}</dd>
            <dt>Supported hostname</dt><dd>{state.data.site}</dd>
          </dl>
        </article>
      )}
    </main>
  );
}
