import type { Theme } from "./theme-storage";

export async function insertCss(tab: chrome.tabs.Tab, css: string, documentId?: string) {
    await chrome.scripting.insertCSS({
        target: { tabId: tab.id!, ...(documentId ? { documentIds: [documentId] } : {}) },
        css
    });
}

export async function removeCss(tab: chrome.tabs.Tab, css: string, documentId?: string) {
    await chrome.scripting.removeCSS({
        target: { tabId: tab.id!, ...(documentId ? { documentIds: [documentId] } : {}) },
        css
    });
}


export function themeToCss(theme: Theme): string {
    let css = "";
    for (const rule of theme.rules){
        let ruleCss = `${rule.selector} {`;
        for (const [property, value] of Object.entries(rule.properties)) {
            ruleCss += `${property}: ${value} !important;`;
        }
        ruleCss += '}';
        console.log("Generated CSS for rule:", ruleCss);
        css += ruleCss;
    }
    return css;
}
