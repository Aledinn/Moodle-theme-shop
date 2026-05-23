import type { Theme } from "./theme-storage";
export async function toggleCSS(tab: chrome.tabs.Tab, css: string, toggle: boolean) {
    if (toggle) {
        chrome.scripting.insertCSS({
            target: { tabId: tab.id! },
            css: css
        });
    } else {
        chrome.scripting.removeCSS({
            target: { tabId: tab.id! },
            css: css
        });
    }
}


export function themeToCss(theme: Theme): string {
    let css = "";
    for (const rule of theme.rules){
        let ruleCss = `${rule.selector} {`;
        for (const [property, value] of Object.entries(rule.properties)) {
            ruleCss += `${property}: ${value}; `;
        }
        ruleCss += '}';
        console.log("Generated CSS for rule:", ruleCss);
        css += ruleCss;
    }
    return css;
}
