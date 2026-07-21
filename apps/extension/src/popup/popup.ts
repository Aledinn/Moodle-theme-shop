const buttonOpenEditor = document.getElementById("open_editor") as HTMLButtonElement;
const buttonToggleTheme = document.getElementById("toggle_theme") as HTMLButtonElement;
const buttonInstallTheme = document.getElementById("install_theme") as HTMLButtonElement;
const buttonExportTheme = document.getElementById("export_theme") as HTMLButtonElement;
const buttonUploadTheme = document.getElementById("upload_theme") as HTMLButtonElement;

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

