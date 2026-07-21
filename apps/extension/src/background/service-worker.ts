import {
    reapplyThemeIfEnabled,
    replaceThemeCssInTab,
    toggleThemeForTab
} from "./theme-application";
import { selectThemeRule, setActiveEditingTheme, updateSelectedThemeStyle } from "./theme-editor";
import { loadThemeFromBackend } from "./theme-loader";
import { initializeStorage, upsertThemeForSite, getThemeForSite } from "./theme-storage";
import { getCurrentTab, getCurrentTabContext } from "./utils";
import type { ExtensionMessage } from "../shared/messages";
import {API_BASE_URL} from "../shared/config"

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

        case "export_json":
            await exportThemeToJson();
            return

        case "upload_theme":
            await uploadThemeToShop();
            return

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

async function exportThemeToJson(){
    const context = await getCurrentTabContext();
    if (!context) {
        return;
    }
    const theme = await getThemeForSite(context.domain);
    const json = JSON.stringify(theme,null,2);
    const dataUrl = "data:application/json;charset=utf-8," + encodeURIComponent(json);

    chrome.downloads.download({
        url : dataUrl,
        filename: `${context.domain}-theme.json`
    });
}

async function uploadThemeToShop(){
    const context = await getCurrentTabContext();
    if (!context) return;

    const theme = await getThemeForSite(context.domain);
    if (!theme) return;

    await fetch(`${API_BASE_URL}/themes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme)
    });
}
