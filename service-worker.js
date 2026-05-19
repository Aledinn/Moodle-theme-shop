const css = 'body { border: 20px solid black; }';
let editedTabs = [];

chrome.action.onClicked.addListener((tab) => {
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
        target: { tabId: tab.id },
        css : css,
    }).then(() => {
    console.log('CSS removed successfully.');
        });
  }
});