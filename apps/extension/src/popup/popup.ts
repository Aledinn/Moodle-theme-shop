const buttonOpenEditor = document.getElementById("open_editor") as HTMLButtonElement;
const buttonToggleTheme = document.getElementById("toggle_theme") as HTMLButtonElement;
const buttonInstallTheme = document.getElementById("install_theme") as HTMLButtonElement;

buttonOpenEditor.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "open_editor" });
});

buttonToggleTheme.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "toggle_theme" });
});

buttonInstallTheme.addEventListener("click", () => {
    window.location.href = chrome.runtime.getURL("shop/shop.html");
});