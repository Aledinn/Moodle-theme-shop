const button_applyTheme = document.getElementById("toggle_theme") as HTMLButtonElement;
const button_selectElement = document.getElementById("select_element") as HTMLButtonElement;
const button_installTheme = document.getElementById("install_theme") as HTMLButtonElement;
const cssPropertyInput = document.getElementById("css_property") as HTMLSelectElement;
const cssColorInput = document.getElementById("css_color") as HTMLInputElement;
let colorUpdateTimeout: number | undefined;

function sendStyleUpdate() {
    window.clearTimeout(colorUpdateTimeout);

    colorUpdateTimeout = window.setTimeout(() => {
        chrome.runtime.sendMessage({
            type: "update_selected_style",
            property: cssPropertyInput.value,
            value: cssColorInput.value
        });
    }, 100);
}

button_applyTheme.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "toggle_theme" });
});

button_installTheme.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "install_theme" });
});

button_selectElement.addEventListener("click", () => {
    chrome.runtime.sendMessage({
        type: "select_element",
    });
});

cssColorInput.addEventListener("input", sendStyleUpdate);

cssPropertyInput.addEventListener("change", sendStyleUpdate);
