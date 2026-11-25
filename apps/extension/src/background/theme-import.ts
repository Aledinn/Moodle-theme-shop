import schema from "../../../../contracts/theme/portable.schema.json";
import { isThemeTarget } from "../shared/config";
import { MAX_THEME_BYTES, validateThemeBytes } from "../shared/portable-theme";
import type { ImportTarget } from "../shared/messages";
import { replaceThemeCssInTab } from "./theme-application";
import { setActiveEditingTheme } from "./theme-editor";
import { upsertThemeForSite, type Theme } from "./theme-storage";

function hostname(url: string): string {
    const parsed = new URL(url);
    const site = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (!isThemeTarget(url) || site.length > schema.properties.site.maxLength
        || !new RegExp(schema.properties.site.pattern).test(site)) {
        throw new Error("Choose a supported HTTP(S) Moodle tab before importing.");
    }
    return site;
}

// Runs in the isolated world of the pinned top-level document. No site scripts
// or external messaging are used. Moodle exposes these markers in its HTML.
function inspectMoodle(rules: Theme["rules"] = []): boolean {
    const metadata = Array.from(document.querySelectorAll('meta[name="keywords"], meta[name="generator"]'));
    const moodle = metadata.some(meta => /\bmoodle\b/i.test(meta.getAttribute("content") ?? ""))
        || (document.body.id.startsWith("page-") && !!document.querySelector("#page #page-content"));
    if (!moodle) throw new Error("The target does not expose supported Moodle page markers.");
    for (const rule of rules) {
        document.querySelector(rule.selector);
        for (const [property, value] of Object.entries(rule.properties)) {
            if (!CSS.supports(property, value)) throw new Error("Browser rejected theme CSS.");
        }
    }
    return true;
}

export async function captureImportTarget(tabId: number, url: string): Promise<ImportTarget> {
    const site = hostname(url);
    const tab = await chrome.tabs.get(tabId);
    if (tab.url !== url || tab.pendingUrl) throw new Error("Target navigated. Reopen import from the Moodle tab.");
    const [result] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func: inspectMoodle });
    if (!result?.result || !result.documentId) throw new Error("Could not verify the Moodle target.");
    return { tabId, url, site, documentId: result.documentId };
}

export async function importTheme(target: ImportTarget, source: string): Promise<void> {
    // Revalidate in the worker, independently of the preview. The page reads a
    // bounded File first; this second boundary also bounds extension messages.
    if (typeof source !== "string" || source.length > MAX_THEME_BYTES) throw new Error("Theme exceeds 256 KiB.");
    const theme = validateThemeBytes(new TextEncoder().encode(source)) as Theme;
    if (hostname(target.url) !== target.site || theme.site !== target.site) {
        throw new Error("Theme hostname must exactly match the captured Moodle hostname.");
    }
    const tab = await chrome.tabs.get(target.tabId);
    if (tab.url !== target.url || tab.pendingUrl) throw new Error("Target navigated. Reopen import from the Moodle tab.");
    const [result] = await chrome.scripting.executeScript({
        target: { tabId: target.tabId, documentIds: [target.documentId] },
        func: inspectMoodle, args: [theme.rules],
    });
    if (!result?.result) throw new Error("Target closed, navigated, or is incompatible.");
    // Recheck after browser validation and pin both CSS operations to that same
    // document, so a navigation racing injection cannot style a new document.
    const current = await chrome.tabs.get(target.tabId);
    if (current.url !== target.url || current.pendingUrl) throw new Error("Target navigated before applying.");
    await replaceThemeCssInTab(current, target.site, theme, target.documentId);
    await upsertThemeForSite(theme);
    setActiveEditingTheme(theme);
}
