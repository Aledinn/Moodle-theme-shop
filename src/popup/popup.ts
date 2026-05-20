const button = document.getElementById("apply_theme") as HTMLButtonElement;

button.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "apply_theme" });
});