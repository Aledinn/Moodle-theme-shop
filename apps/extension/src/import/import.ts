import { MAX_THEME_BYTES, validateThemeBytes } from "../shared/portable-theme";
import type { Theme } from "../background/theme-storage";
import type { ImportTarget } from "../shared/messages";

const picker = document.querySelector<HTMLInputElement>("#file")!;
const apply = document.querySelector<HTMLButtonElement>("#apply")!;
const preview = document.querySelector<HTMLDListElement>("#preview")!;
const status = document.querySelector<HTMLElement>("#status")!;
const targetLabel = document.querySelector<HTMLElement>("#target")!;
let target: ImportTarget | undefined;
let source: string | undefined;
let generation = 0;

async function request(message: unknown) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error ?? "Import failed. Reopen import from the Moodle tab.");
    return response;
}

async function initialize() {
    try {
        const params = new URLSearchParams(location.search);
        const tabId = Number(params.get("tab"));
        const url = params.get("url");
        if (!Number.isInteger(tabId) || tabId <= 0 || !url) throw new Error("Open import from the extension popup on a Moodle tab.");
        const response = await request({ type: "capture_import_target", tabId, url });
        target = response.target;
        targetLabel.textContent = `${target!.site} (tab ${target!.tabId})`;
        picker.disabled = false;
        status.textContent = "Choose a downloaded theme JSON file (maximum 256 KiB).";
    } catch (error) { status.textContent = String(error); }
}

picker.addEventListener("change", async () => {
    const selected = ++generation;
    source = undefined;
    apply.disabled = true;
    preview.replaceChildren();
    const file = picker.files?.[0];
    if (!file || !target) return;
    status.textContent = "Validating selected file…";
    try {
        // Check before any read, decode or parse. File.slice also caps allocation
        // if a caller supplies an unexpected File-like implementation.
        if (file.size > MAX_THEME_BYTES) throw new Error("Theme exceeds 256 KiB.");
        const bytes = new Uint8Array(await file.slice(0, MAX_THEME_BYTES + 1).arrayBuffer());
        const theme = validateThemeBytes(bytes, "portable", document) as Theme;
        if (selected !== generation) return;
        if (theme.site !== target.site) throw new Error(`This theme supports ${theme.site}; target is ${target.site}. Hostnames must match.`);
        for (const [label, value] of [
            ["Name", theme.name], ["Author", theme.author], ["Version", theme.version],
            ["Description", theme.description], ["Supported hostname", theme.site], ["Rules", String(theme.rules.length)],
        ]) {
            const term = document.createElement("dt");
            const detail = document.createElement("dd");
            term.textContent = label!;
            detail.textContent = value!;
            preview.append(term, detail);
        }
        source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        apply.disabled = false;
        status.textContent = "Review the theme, then confirm to replace the saved theme and apply it to the captured tab.";
    } catch (error) {
        if (selected === generation) status.textContent = String(error);
    }
});

apply.addEventListener("click", async () => {
    if (!target || source === undefined) return;
    apply.disabled = true;
    picker.disabled = true;
    status.textContent = "Checking target and applying theme…";
    try {
        await request({ type: "import_theme", target, source });
        source = undefined;
        status.textContent = `Imported and applied to ${target.site} in tab ${target.tabId}.`;
    } catch (error) {
        status.textContent = `${String(error)} Import was not completed. Reopen import from the intended Moodle tab to retry.`;
    }
});

void initialize();
