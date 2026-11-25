import { insertCss, removeCss, themeToCss } from "./css-injection";
import { getThemeForSite, Theme } from "./theme-storage";
import { getDomainFromUrl, isInScope, markDomainAsApplied } from "./utils";

let appliedDomains: string[] = [];
const activeInjectedCss = new Map<number, string>();
chrome.tabs.onRemoved.addListener(tabId => activeInjectedCss.delete(tabId));

// A tab ID survives navigation. Resolve the top-level document and pin every CSS
// operation so asynchronous storage reads cannot redirect an operation to a shop
// page (or a different Moodle document) that later occupies the same tab.
async function pinDocument(tab: chrome.tabs.Tab, documentId?: string): Promise<string> {
    if (!tab.url || !getDomainFromUrl(tab.url)) throw new Error("Choose a supported Moodle target.");
    const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id!, ...(documentId ? { documentIds: [documentId] } : { frameIds: [0] }) },
        func: () => location.href,
    });
    if (result?.result !== tab.url || !result.documentId) throw new Error("Target navigated before applying.");
    return result.documentId;
}

export async function reapplyThemeIfEnabled(tab: chrome.tabs.Tab) {
    if (!tab.url) {
        return;
    }

    const domain = getDomainFromUrl(tab.url);
    if (!domain || !isInScope(domain, appliedDomains)) {
        return;
    }

    try {
        const documentId = await pinDocument(tab);
        const theme = await getThemeForSite(domain);
        if (theme) await applyCssToTab(tab, domain, themeToCss(theme), documentId);
    } catch {
        // A completed navigation can already be obsolete by the time this runs.
        // Never retry against the replacement document.
    }
}

export async function toggleThemeForTab(tab: chrome.tabs.Tab, domain: string) {
    if (!tab.url || !getDomainFromUrl(tab.url)) return;
    const documentId = await pinDocument(tab);
    const theme = await getThemeForSite(domain);
    if (!theme) {
        return;
    }

    const css = themeToCss(theme);
    if (!css) {
        return;
    }

    if (isInScope(domain, appliedDomains)) {
        await removeThemeFromTab(tab, domain, documentId);
        return;
    }

    await applyCssToTab(tab, domain, css, documentId);
}

export async function applyThemeToTab(tab: chrome.tabs.Tab, domain: string, theme: Theme, documentId?: string) {
    await applyCssToTab(tab, domain, themeToCss(theme), documentId);
}

export async function replaceThemeCssInTab(tab: chrome.tabs.Tab, domain: string, theme: Theme, documentId?: string) {
    documentId = await pinDocument(tab, documentId);
    await removeCurrentCssFromTab(tab, domain, documentId);

    await applyThemeToTab(tab, domain, theme, documentId);
}

async function applyCssToTab(tab: chrome.tabs.Tab, domain: string, css: string, documentId?: string) {
    if (!css || !tab.url || !getDomainFromUrl(tab.url)) {
        return;
    }

    documentId = await pinDocument(tab, documentId);
    await insertCss(tab, css, documentId);
    activeInjectedCss.set(tab.id!, css);
    markDomainAsApplied(domain, appliedDomains);
}

async function removeThemeFromTab(tab: chrome.tabs.Tab, domain: string, documentId: string) {
    await removeCurrentCssFromTab(tab, domain, documentId);
    appliedDomains = appliedDomains.filter((appliedDomain) => appliedDomain !== domain);
}

async function removeCurrentCssFromTab(tab: chrome.tabs.Tab, domain: string, documentId?: string) {
    const activeCss = activeInjectedCss.get(tab.id!);
    if (activeCss) {
        await removeCss(tab, activeCss, documentId);
        activeInjectedCss.delete(tab.id!);
        return;
    }

    const storedTheme = await getThemeForSite(domain);
    const storedCss = storedTheme ? themeToCss(storedTheme) : "";

    if (storedCss) {
        await removeCss(tab, storedCss, documentId);
    }
}
