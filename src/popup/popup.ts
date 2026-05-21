const button_applyTheme = document.getElementById("toggle_theme") as HTMLButtonElement;
const button_selectElement = document.getElementById("select_element") as HTMLButtonElement;

button_applyTheme.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "toggle_theme" });
});

button_selectElement.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "select_element" });
});