import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getTheme } from "./api";
import { fetchThemeDownload, saveThemeDownload } from "./download";
import { useRequest } from "./useRequest";

export function ThemeDetails({ id }: { id: string }) {
  const [attempt, setAttempt] = useState(0);
  const [download, setDownload] = useState<"idle" | "loading" | "handed-off">("idle");
  const [downloadError, setDownloadError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        return await getTheme(id, signal);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          throw new Error("Theme not found. It may have been removed. Return to the catalog to choose another.");
        }
        throw error;
      }
    },
    [id, attempt],
  );
  const state = useRequest(load);
  async function startDownload() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setDownload("loading");
    setDownloadError("");
    try {
      const file = await fetchThemeDownload(id, controller.signal);
      if (controller.signal.aborted) return;
      saveThemeDownload(file.blob, file.filename);
      setDownload("handed-off");
    } catch (error) {
      if (!controller.signal.aborted) {
        setDownload("idle");
        setDownloadError(error instanceof ApiError && error.status === 404
          ? error.message
          : "Download failed. No file was handed to your browser. Please try downloading again. If this continues, reload the details or choose another theme.");
      }
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }
  return (
    <main className="theme-details">
      <a href="/">Back to theme catalog</a>
      {state.status === "loading" && <p role="status">Loading theme...</p>}
      {state.status === "error" && (
        <section aria-labelledby="details-error">
          <h1 id="details-error">Theme unavailable</h1>
          <p role="alert">{state.message}</p>
          <button className="download-button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
        </section>
      )}
      {state.status === "success" && (
        <>
          <article>
            <p className="details-eyebrow">COMMUNITY THEME</p>
            <h1>{state.data.name}</h1>
            <p className="details-description">{state.data.description || "No description available."}</p>
            <dl>
              <dt>Author (unverified)</dt><dd>{state.data.author}</dd>
              <dt>Version</dt><dd>{state.data.version}</dd>
              <dt>Supported hostname</dt><dd>{state.data.site}</dd>
            </dl>
            <button className="download-button" disabled={download === "loading"} onClick={() => void startDownload()}>
              {download === "loading" ? "Downloading…" : "Download theme JSON"}
            </button>
            <p>No account or extension is needed to download this file.</p>
            <div role="status">
              {download === "loading" && "Receiving theme file…"}
              {download === "handed-off" && "Download handed to your browser. Check your browser’s downloads to confirm the file was saved."}
            </div>
            {downloadError && <p role="alert">{downloadError}</p>}
          </article>
          <section className="installation-guide" aria-labelledby="installation-heading">
            <h2 id="installation-heading">Use this theme in your browser</h2>
            <p>The extension applies themes locally in your browser. It does not change the Moodle site for other visitors.</p>
            <p>After saving the JSON file, return to the intended Moodle tab and open the extension popup. Choose <strong>Import downloaded JSON</strong>, review the target and theme, then confirm import and apply.</p>
            <ol>
              <li><strong>Load the extension.</strong> Follow the <a href="https://github.com/Aledinn/Moodle-theme-shop#installation">extension setup instructions</a> to build it. In Chrome, open <code>chrome://extensions</code>, turn on Developer mode, choose <strong>Load unpacked</strong>, and select the built <code>apps/extension/dist</code> folder.</li>
              <li><strong>Open a compatible Moodle tab.</strong> Its hostname must exactly match <strong>{state.data.site}</strong>. A different subdomain is a different target.</li>
              <li><strong>Import the downloaded JSON.</strong> Open the popup from that Moodle tab, choose <strong>Import downloaded JSON</strong>, and select the downloaded <code>.json</code> file. Review its name, version and supported hostname before continuing.</li>
              <li><strong>Confirm the captured target.</strong> Check the displayed Moodle tab, then confirm import and apply. Keep that tab on the same page; navigation or reload requires reopening import. Do not target this marketplace or the extension page.</li>
              <li><strong>Check the Moodle tab.</strong> Confirm the theme appears there. If import or application fails, check the file, hostname and extension permissions before retrying.</li>
            </ol>
            <h3>Don’t have the extension?</h3>
            <p>You can still browse and download. Follow the setup instructions when you are ready to use themes. This website does not check whether the extension is installed and cannot apply a theme for you.</p>
          </section>
        </>
      )}
    </main>
  );
}
