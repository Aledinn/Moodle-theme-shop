const buttonOpenEditor = document.getElementById("open_editor") as HTMLButtonElement;
const buttonToggleTheme = document.getElementById("toggle_theme") as HTMLButtonElement;
const buttonInstallTheme = document.getElementById("install_theme") as HTMLButtonElement;
const buttonExportTheme = document.getElementById("export_theme") as HTMLButtonElement;
const buttonUploadTheme = document.getElementById("upload_theme") as HTMLButtonElement;
const buttonImportTheme = document.getElementById("import_theme") as HTMLButtonElement;
// Capture when the toolbar popup opens, before opening an extension page/file picker.
const intendedTab = chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab);
buttonImportTheme.addEventListener("click", async () => {
    const tab = await intendedTab;
    if (tab?.id === undefined || !tab.url) return;
    const params = new URLSearchParams({ tab: String(tab.id), url: tab.url });
    await chrome.tabs.create({ url: chrome.runtime.getURL(`import/import.html?${params}`) });
});

buttonOpenEditor.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "open_editor" });
});

buttonToggleTheme.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "toggle_theme" });
});

buttonExportTheme.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "export_json"})
});

buttonInstallTheme.addEventListener("click", () => {
    window.location.href = chrome.runtime.getURL("shop/shop.html");
});

buttonUploadTheme.addEventListener("click", () =>{
    chrome.runtime.sendMessage({ type: "upload_theme"})
})

