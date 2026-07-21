import {
    reapplyThemeIfEnabled,
    replaceThemeCssInTab,
    toggleThemeForTab
} from "./theme-application";
import { selectThemeRule, setActiveEditingTheme, updateSelectedThemeStyle } from "./theme-editor";
import { loadThemeFromBackend } from "./theme-loader";
import { initializeStorage, upsertThemeForSite } from "./theme-storage";
import { getCurrentTab, getCurrentTabContext } from "./utils";
import type { ExtensionMessage } from "../shared/messages";

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
        case "open_editor":
            await handleOpenEditor();
            return;

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
            await handleInstallTheme(message.id);
            return;

        default:
            console.warn("Unknown message:", message);
            return;
    }
}

async function handleOpenEditor() {
    const tab = await getCurrentTab();
    if (!tab?.id) {
        return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "open_editor" });
}

async function handleToggleTheme() {
    const context = await getCurrentTabContext();
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
    if (!message.property || !message.value) {
        return;
    }

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

async function handleInstallTheme(id:number) {
    const context = await getCurrentTabContext();
    if (!context) {
        return;
    }

    const theme = await loadThemeFromBackend(id);
    theme.site = context.domain;

    await upsertThemeForSite(theme);
    setActiveEditingTheme(theme);
    await replaceThemeCssInTab(context.tab, context.domain, theme);
}
