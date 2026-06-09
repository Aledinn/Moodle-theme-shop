import { toggleCSS, themeToCss } from "./css-injection";
import { loadExampleTheme } from "./theme-loader";
import { initializeStorage, upsertThemeForSite, getThemeForSite, Theme } from "./theme-storage";
import { getCurrentTab, isInScope, getDomainFromUrl, getCurrentTabContext, markDomainAsApplied } from "./utils";

initializeStorage();

let css = 'body { border: 20px solid black; }';
let allowedUrls: string[] = ["moodle.informatik.tu-darmstadt.de"];
let appliedUrls: string[] = [];
let activeEditingTheme: Theme = { 
    name: "Active Editing Theme",
    site: "moodle.informatik.tu-darmstadt.de",
    author: "Author Name",
    description: "Theme currently being edited",
    version: "0.1",
    rules: []
};
let activeInjectedCss = '';
let selectedSelector: string | null = null;

//load css if url already in scope
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if(changeInfo.status !== 'complete' || !tab.url) {
    return;
  }
  let tabUrl = getDomainFromUrl(tab.url);
  if (!tabUrl) {
    return;
  }
  let theme = await getThemeForSite(tabUrl);
  if (isInScope(tabUrl, appliedUrls) && theme) {
    css = themeToCss(theme);
    activeInjectedCss = css;
    toggleCSS(tab, css, true);
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
    handleMessage(message, sender);
});

async function handleMessage(message: any, sender: chrome.runtime.MessageSender) {
    if (message.type === "toggle_theme") {
        await handleToggleTheme();
        return;
    }

    if (message.type === "chosen_element") {
        await handleChosenElement(message);
        return;
    }

    if (message.type === "install_theme") {
        await handleInstallTheme();
        return;
    }
    if (message.type === "select_element") {
        await handleSelectElement();
        return;
    }
    if (message.type === "update_selected_style") {
        await handleUpdateSelectedStyle(message);
        return;
    }
}

async function handleUpdateSelectedStyle(message: any) {
    if (!selectedSelector) {
        console.error("No selected element to update");
        return;
    }

    const existingRule = activeEditingTheme.rules.find((rule) => rule.selector === selectedSelector);

    if (!existingRule) {
        return;
    }

    existingRule.properties[message.property] = message.value;
    const context = await getCurrentTabContext();

    if (!context) {
        return;
    }

    const { domain, tab } = context;
    activeEditingTheme.site = domain;
    await upsertThemeForSite(activeEditingTheme);
    if (activeInjectedCss) {
        toggleCSS(tab, activeInjectedCss, false);
    }

    activeInjectedCss = themeToCss(activeEditingTheme);
    toggleCSS(tab, activeInjectedCss, true);
    markDomainAsApplied(domain, appliedUrls);
}

async function handleToggleTheme() {
    const context = await getCurrentTabContext(allowedUrls);
    if (!context) {
        return;
    }
    const { domain, tab } = context;

    let theme = await getThemeForSite(domain);
    let themeCss = theme ? themeToCss(theme) : '';

    if (themeCss === '') {
        return;
    }

    if (!isInScope(domain, appliedUrls)) {
        toggleCSS(tab, themeCss, true);
        activeInjectedCss = themeCss;
        markDomainAsApplied(domain, appliedUrls);
    }
    else {
        toggleCSS(tab, themeCss, false);
        appliedUrls = appliedUrls.filter((url) => url !== domain);
        if (activeInjectedCss === themeCss) {
            activeInjectedCss = "";
        }
    }
}

async function handleSelectElement() {
    const tab = await getCurrentTab();
    if (!tab || !tab.id) {
        return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "select_element" });
}

async function handleChosenElement(message: any) {
    const selector = message.selector;
    selectedSelector = selector;

    const context = await getCurrentTabContext();
    if (!context) {
        return;
    }
    const { domain } = context;

    if (activeEditingTheme.site !== domain || activeEditingTheme.rules.length === 0) {
        const storedTheme = await getThemeForSite(domain);

        activeEditingTheme = storedTheme ?? {
            name: "Active Editing Theme",
            site: domain,
            author: "Author Name",
            description: "Theme currently being edited",
            version: "0.1",
            rules: []
        };
    }

    const existingRule = activeEditingTheme.rules.find((rule) => rule.selector === selector);
    if (!existingRule) {
        activeEditingTheme.rules.push({
            selector,
            properties: {}
        });
    }
    console.log("current rules:", JSON.stringify(activeEditingTheme.rules, null, 2));
    console.log("Received chosen element selector in background script:", selector);
}

async function handleInstallTheme() {
    const context = await getCurrentTabContext(allowedUrls);
    if (!context) {
        return;
    }
    const { domain, tab } = context;

    let theme = await loadExampleTheme();
    await upsertThemeForSite(theme);
    css = themeToCss(theme);
    toggleCSS(tab, css, true);
    appliedUrls.push(domain);
}

