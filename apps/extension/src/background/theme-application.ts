import { insertCss, removeCss, themeToCss } from "./css-injection";
import { getThemeForSite, Theme } from "./theme-storage";
import { getDomainFromUrl, isInScope, markDomainAsApplied } from "./utils";

let appliedDomains: string[] = [];
const activeInjectedCss = new Map<number, string>();
chrome.tabs.onRemoved.addListener(tabId => activeInjectedCss.delete(tabId));

export async function reapplyThemeIfEnabled(tab: chrome.tabs.Tab) {
    if (!tab.url) {
        return;
    }

    const domain = getDomainFromUrl(tab.url);
    if (!domain || !isInScope(domain, appliedDomains)) {
        return;
    }

    const theme = await getThemeForSite(domain);
    if (!theme) {
        return;
    }

    const css = themeToCss(theme);
    await insertCss(tab, css);
    activeInjectedCss.set(tab.id!, css);
}

export async function toggleThemeForTab(tab: chrome.tabs.Tab, domain: string) {
    const theme = await getThemeForSite(domain);
    if (!theme) {
        return;
    }

    const css = themeToCss(theme);
    if (!css) {
        return;
    }

    if (isInScope(domain, appliedDomains)) {
        await removeThemeFromTab(tab, domain);
        return;
    }

    await applyCssToTab(tab, domain, css);
}

export async function applyThemeToTab(tab: chrome.tabs.Tab, domain: string, theme: Theme, documentId?: string) {
    await applyCssToTab(tab, domain, themeToCss(theme), documentId);
}

export async function replaceThemeCssInTab(tab: chrome.tabs.Tab, domain: string, theme: Theme, documentId?: string) {
    await removeCurrentCssFromTab(tab, domain, documentId);

    await applyThemeToTab(tab, domain, theme, documentId);
}

async function applyCssToTab(tab: chrome.tabs.Tab, domain: string, css: string, documentId?: string) {
    if (!css) {
        return;
    }

    await insertCss(tab, css, documentId);
    activeInjectedCss.set(tab.id!, css);
    markDomainAsApplied(domain, appliedDomains);
}

async function removeThemeFromTab(tab: chrome.tabs.Tab, domain: string) {
    await removeCurrentCssFromTab(tab, domain);
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
