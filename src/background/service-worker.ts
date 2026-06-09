import {
    applyThemeToTab,
    reapplyThemeIfEnabled,
    replaceThemeCssInTab,
    toggleThemeForTab
} from "./theme-application";
import { selectThemeRule, updateSelectedThemeStyle } from "./theme-editor";
import { loadExampleTheme } from "./theme-loader";
import { initializeStorage, upsertThemeForSite } from "./theme-storage";
import { getCurrentTab, getCurrentTabContext } from "./utils";
import type { ExtensionMessage } from "../shared/messages";

const allowedDomains = ["moodle.informatik.tu-darmstadt.de"];

initializeStorage();

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") {
        return;
    }

    await reapplyThemeIfEnabled(tab);
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
    handleMessage(message);
});

async function handleMessage(message: ExtensionMessage) {
    switch (message.type) {
        case "toggle_theme":
            await handleToggleTheme();
            return;

        case "select_element":
            await handleSelectElement();
            return;

        case "chosen_element":
            await handleChosenElement(message);
            return;

        case "update_selected_style":
            await handleUpdateSelectedStyle(message);
            return;

        case "install_theme":
            await handleInstallTheme();
            return;

        default:
            console.warn("Unknown message:", message);
            return;
    }
}

async function handleToggleTheme() {
    const context = await getCurrentTabContext(allowedDomains);
    if (!context) {
        return;
    }

    await toggleThemeForTab(context.tab, context.domain);
}

async function handleSelectElement() {
    const tab = await getCurrentTab();
    if (!tab?.id) {
        return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "select_element" });
}

async function handleChosenElement(message: Extract<ExtensionMessage, { type: "chosen_element" }>) {
    const context = await getCurrentTabContext();
    if (!context) {
        return;
    }

    await selectThemeRule(context.domain, message.selector);
}

async function handleUpdateSelectedStyle(message: Extract<ExtensionMessage, { type: "update_selected_style" }>) {
    const context = await getCurrentTabContext();
    if (!context) {
        return;
    }

    const updatedTheme = await updateSelectedThemeStyle(context.domain, message.property, message.value);
    if (!updatedTheme) {
        return;
    }

    await replaceThemeCssInTab(context.tab, context.domain, updatedTheme);
}

async function handleInstallTheme() {
    const context = await getCurrentTabContext(allowedDomains);
    if (!context) {
        return;
    }

    const theme = await loadExampleTheme();
    theme.site = context.domain;

    await upsertThemeForSite(theme);
    await applyThemeToTab(context.tab, context.domain, theme);
}

