import { toggleCSS, themeToCss } from "./css-injection";
import { loadExampleTheme } from "./theme-loader";
import { initializeStorage, upsertThemeForSite,  getThemeForSite} from "./theme-storage";
import { getCurrentTab, isInScope, getDomainFromUrl } from "./utils";

initializeStorage();

let css = 'body { border: 20px solid black; }';
let allowedUrls: string[] = ["moodle.informatik.tu-darmstadt.de"];
let appliedUrls: string[] = [];

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

//inject css when the button in the popup is clicked
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === "toggle_theme") {
        getCurrentTab().then((tab) => {
        if  (!tab || !tab.id || !tab.url){
            return;
        }

        const domain = getDomainFromUrl(tab.url);
        if (!domain || !isInScope(domain, allowedUrls)) {
            return;
        }

        if (!isInScope(domain, appliedUrls)) {
            toggleCSS(tab, css, true);
            appliedUrls.push(domain);
        }
        else {
            toggleCSS(tab, css, false);
            appliedUrls = appliedUrls.filter((url) => url !== domain);
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
            if (!tab || !tab.id || !tab.url){
                return;
            }

            const domain = getDomainFromUrl(tab.url);
            if (!domain || !isInScope(domain, allowedUrls)) {
                return;
            }

            toggleCSS(tab, css, true);
            appliedUrls.push(domain);
        });
    }
});
