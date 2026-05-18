const css = 'body { border: 20px solid black; }';
let editedCss = false;


chrome.action.onClicked.addListener((tab) => {
  if (!editedCss) {
    chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        css : css,
    }).then(() => {
    console.log('CSS injected successfully.');
        });
    editedCss = true;
  }
  else {
    chrome.scripting.removeCSS({
        target: { tabId: tab.id },
        css : css,
    }).then(() => {
    console.log('CSS removed successfully.');
        });
    editedCss = false;
  }
});