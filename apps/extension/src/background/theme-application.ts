import { insertCss, removeCss, themeToCss } from "./css-injection";
import { getThemeForSite, Theme } from "./theme-storage";
import { getDomainFromUrl, isInScope, markDomainAsApplied } from "./utils";

let appliedDomains: string[] = [];
let activeInjectedCss = "";

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
    activeInjectedCss = css;
    await insertCss(tab, css);
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

export async function applyThemeToTab(tab: chrome.tabs.Tab, domain: string, theme: Theme) {
    await applyCssToTab(tab, domain, themeToCss(theme));
}

export async function replaceThemeCssInTab(tab: chrome.tabs.Tab, domain: string, theme: Theme) {
    await removeCurrentCssFromTab(tab, domain);

    await applyThemeToTab(tab, domain, theme);
}

async function applyCssToTab(tab: chrome.tabs.Tab, domain: string, css: string) {
    if (!css) {
        return;
    }

    await insertCss(tab, css);
    activeInjectedCss = css;
    markDomainAsApplied(domain, appliedDomains);
}

async function removeThemeFromTab(tab: chrome.tabs.Tab, domain: string) {
    await removeCurrentCssFromTab(tab, domain);
    appliedDomains = appliedDomains.filter((appliedDomain) => appliedDomain !== domain);
}

async function removeCurrentCssFromTab(tab: chrome.tabs.Tab, domain: string) {
    if (activeInjectedCss) {
        await removeCss(tab, activeInjectedCss);
        activeInjectedCss = "";
        return;
    }

    const storedTheme = await getThemeForSite(domain);
    const storedCss = storedTheme ? themeToCss(storedTheme) : "";

    if (storedCss) {
        await removeCss(tab, storedCss);
    }
}
