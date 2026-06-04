import { toggleCSS, themeToCss } from "./css-injection";
import { loadExampleTheme } from "./theme-loader";
import { initializeStorage, upsertThemeForSite, getThemeForSite, Theme } from "./theme-storage";
import { getCurrentTab, isInScope, getDomainFromUrl, getAllowedCurrentTabContext } from "./utils";

initializeStorage();

let css = 'body { border: 20px solid black; }';
let allowedUrls: string[] = ["moodle.informatik.tu-darmstadt.de"];
let appliedUrls: string[] = [];
let draftTheme: Theme = { 
    name: "Draft Theme",
    site: "example.com",
    author: "Author Name",
    description: "A draft theme for testing",
    version: "0.1",
    rules: []
};

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

    if (message.type === "select_element") {
        await handleSelectElement();
        return;
    }

    if (message.type === "chosen_element") {
        handleChosenElement(message);
        return;
    }

    if (message.type === "install_theme") {
        await handleInstallTheme();
        return;
    }
}

async function handleToggleTheme() {
    const context = await getAllowedCurrentTabContext(allowedUrls);
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
        appliedUrls.push(domain);
    }
    else {
        toggleCSS(tab, themeCss, false);
        appliedUrls = appliedUrls.filter((url) => url !== domain);
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
    const existingRule = draftTheme.rules.find((rule) => rule.selector === selector);
    if (existingRule) {
        existingRule.properties["background-color"] = "blue";
    }
    else
    {
        draftTheme.rules.push({
            selector,
            properties: {
                "background-color": "red"
            }
        });
    }
    let css = themeToCss(draftTheme);
    const context = await getAllowedCurrentTabContext(allowedUrls);
    if (!context) {
        return;
    }
    const { domain, tab } = context;
    toggleCSS(tab, css, true);
    console.log("Received chosen element selector in background script:", selector);
}

async function handleInstallTheme() {
    const context = await getAllowedCurrentTabContext(allowedUrls);
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
