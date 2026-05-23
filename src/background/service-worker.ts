import { toggleCSS, themeToCss } from "./css-injection";
import { loadExampleTheme } from "./theme-loader";
import { initializeStorage, upsertThemeForSite } from "./theme-storage";
import { getCurrentTab, isInScope } from "./utils";

initializeStorage();

let css = 'body { border: 20px solid black; }';
let allowedUrls: string[] = ["https://moodle."];
let appliedUrls: string[] = [];

//load css if url already in scope
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isInScope(tab.url!,appliedUrls)) {
      toggleCSS(tab, css, true);
  }
});

//inject css when the button in the popup is clicked
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === "toggle_theme") {
        getCurrentTab().then((tab) => {
        if  (!tab || !tab.id || !tab.url ||!isInScope(tab.url!, allowedUrls)){
            return;
        }
        else if (!isInScope(tab.url!, appliedUrls)) {
            toggleCSS(tab, css, true);
            appliedUrls.push(tab.url);
        }
        else {
            toggleCSS(tab, css, false);
            appliedUrls = appliedUrls.filter((url) => url !== tab.url);
        }
    }
    );}
});

chrome.runtime.onMessage.addListener((message, sender) => { 
    if (message.type === "select_element") {
        getCurrentTab().then((tab) => {
            if (!tab || !tab.id) {
                return;
            }
            chrome.tabs.sendMessage(tab.id, { type: "select_element" });
        });
    }});

chrome.runtime.onMessage.addListener((message, sender) => { 
    if (message.type === "chosen_element") {
        const selector = message.selector;
        console.log("Received chosen element selector in background script:", selector);
    }});

chrome.runtime.onMessage.addListener(async (message, sender) => { 
    if (message.type === "install_theme") {
        let theme = await loadExampleTheme();
        await upsertThemeForSite(theme);
        css = themeToCss(theme);
        getCurrentTab().then((tab) => {
            if (!tab || !tab.id || !tab.url ||!isInScope(tab.url!, allowedUrls)){
                return;
            }
            toggleCSS(tab, css, true);
            appliedUrls.push(tab.url);
        });
    }
});
