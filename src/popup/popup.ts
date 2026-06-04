const button_applyTheme = document.getElementById("toggle_theme") as HTMLButtonElement;
const button_selectElement = document.getElementById("select_element") as HTMLButtonElement;
const button_installTheme = document.getElementById("install_theme") as HTMLButtonElement;
const button_saveDraftTheme = document.getElementById("save_draft_theme") as HTMLButtonElement;

button_applyTheme.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "toggle_theme" });
});

button_selectElement.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "select_element" });
});

button_installTheme.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "install_theme" });
});

button_saveDraftTheme.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "save_draft_theme" });
});