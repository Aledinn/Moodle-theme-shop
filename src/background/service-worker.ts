const css = 'body { border: 20px solid black; }';
let allowedUrls: string[] = ["https://moodle."];
let appliedUrls: string[] = [];

async function getCurrentTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

async function toggleCSS(tab: chrome.tabs.Tab, css: string,toggle: boolean) {
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

function isInScope(url: string, list: string[]) {
    return list.some((presentUrl) => url.startsWith(presentUrl));
}

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

