const css = 'body { border: 20px solid black; }';
let editedTabs: number[] = [];

async function getCurrentTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "apply_theme") {
    console.log("Apply theme message received");
  }
});
//load css if tab already edited before
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith("https://moodle.")) {
    if (editedTabs.includes(tabId)) {
      chrome.scripting.insertCSS({
        target: { tabId: tabId },
        css: css
      });
    }
  }
});

//inject css when the extension icon is clicked
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "apply_theme") {
    getCurrentTab().then((tab) => {
      if (!tab?.id) return;
      console.log(tab.url);
      if (tab.url?.startsWith("https://moodle.")) {
        console.log("Moodle page detected");
        if (tab && !editedTabs.includes(tab.id)) {
        editedTabs.push(tab.id);
        chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            css : css,
        }).then(() => {
        console.log('CSS injected successfully.');
            });
    }
    else {
        let index = editedTabs.indexOf(tab.id);
        if (index > -1) {
            editedTabs.splice(index, 1);   
        }
        chrome.scripting.removeCSS({
            target: { tabId : tab.id },
            css : css,
        }).then(() => {
        console.log('CSS removed successfully.');
            });
    }
  }
});}});