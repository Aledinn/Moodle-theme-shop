let selectionMode = false;
let editorPanel: HTMLDivElement | null = null;

const hoverOverlay = document.createElement("div");
hoverOverlay.style.position = "fixed";
hoverOverlay.style.pointerEvents = "none";
hoverOverlay.style.zIndex = "9999";
hoverOverlay.style.border = "2px solid #2563eb";
hoverOverlay.style.backgroundColor = "rgba(37, 99, 235, 0.15)";
hoverOverlay.style.display = "none";
hoverOverlay.style.boxSizing = "border-box";
document.body.appendChild(hoverOverlay);

chrome.runtime.onMessage.addListener((message, sender) => { 
    if (message.type === "open_editor") {
        toggleEditorPanel();
    }
    else if (message.type === "select_element" && !selectionMode) {
        console.log("Received select_element message in foreground script");
        selectionMode = true;
    }
    else if (message.type === "select_element" && selectionMode) {
        console.log("Exiting selection mode");
        selectionMode = false;
    }}); 

function toggleEditorPanel() {
    if (editorPanel) {
        editorPanel.remove();
        editorPanel = null;
        return;
    }

    editorPanel = document.createElement("div");
    editorPanel.style.position = "fixed";
    editorPanel.style.top = "1rem";
    editorPanel.style.right = "1rem";
    editorPanel.style.zIndex = "10000";
    editorPanel.style.background = "#222";
    editorPanel.style.color = "white";
    editorPanel.style.padding = "0.75rem";
    editorPanel.style.border = "1px solid #555";
    editorPanel.style.display = "grid";
    editorPanel.style.gap = "0.5rem";
    editorPanel.style.fontFamily = "system-ui, sans-serif";

    editorPanel.innerHTML = `
        <strong>Theme editor</strong>
        <button id="mts_select_element">Select element</button>
        <select id="mts_property">
            <option value="">Choose property</option>
            <option value="background-color">Background color</option>
            <option value="color">Text color</option>
            <option value="font-family">Font family</option>
        </select>
        <input id="mts_color" type="color" value="#ff0000">
        <select id="mts_font" hidden>
            <option value="">Choose font</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="Verdana, sans-serif">Verdana</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="system-ui, sans-serif">System UI</option>
        </select>
    `;

    document.body.appendChild(editorPanel);

    const selectButton = editorPanel.querySelector("#mts_select_element") as HTMLButtonElement;
    const propertyInput = editorPanel.querySelector("#mts_property") as HTMLSelectElement;
    const colorInput = editorPanel.querySelector("#mts_color") as HTMLInputElement;
    const fontInput = editorPanel.querySelector("#mts_font") as HTMLSelectElement;

    function selectedValue() {
        return propertyInput.value === "font-family" ? fontInput.value : colorInput.value;
    }

    function sendStyleUpdate() {
        if (!propertyInput.value || !selectedValue()) {
            return;
        }

        chrome.runtime.sendMessage({
            type: "update_selected_style",
            property: propertyInput.value,
            value: selectedValue()
        });
    }

    function resetEditorInputs() {
        propertyInput.value = "";
        colorInput.value = "#ff0000";
        fontInput.value = "";
        colorInput.hidden = false;
        fontInput.hidden = true;
    }

    selectButton.addEventListener("click", () => {
        resetEditorInputs();
        selectionMode = true;
    });

    propertyInput.addEventListener("change", () => {
        const isFont = propertyInput.value === "font-family";
        colorInput.hidden = isFont;
        fontInput.hidden = !isFont;
        sendStyleUpdate();
    });

    colorInput.addEventListener("input", sendStyleUpdate);
    fontInput.addEventListener("change", sendStyleUpdate);
}

function mouseoverElement(event: MouseEvent) {
    if (!selectionMode) {
        return;
    }
    if (!(event.target instanceof HTMLElement)) {
        return;
    }
    showOverlay(event.target);
}

function mouseclickElement(event: MouseEvent) {
    if (!selectionMode) {
        return;
    }
    if (!(event.target instanceof HTMLElement)) {
        return;
    }

    /** prevented a case where the dom adds extra id to the 
      element when clicked, which causes the selector to be
      wrong and not work when applied again */
    event.preventDefault();
    event.stopPropagation();

    const target = event.target;
    hoverOverlay.style.display = "none";
    let selector = "";
    selectionMode = false;

    if (target.classList.length > 0) {
        selector = target.tagName.toLowerCase()
        for (const className of target.classList) {
            selector += `.` + CSS.escape(className);
        }
    }
    else {
        let parts = []
        if (target.parentElement) {
            if (target.parentElement.parentElement) {
                parts.push(target.parentElement.parentElement.tagName.toLowerCase());
            }
            parts.push(target.parentElement.tagName.toLowerCase());
        }
        parts.push(target.tagName.toLowerCase());
        selector = parts.join(" ");
    }
    
    console.log("Selected element:", selector);
    chrome.runtime.sendMessage({ type: "chosen_element", selector: selector });
}

function showOverlay(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    
    hoverOverlay.style.top = `${rect.top}px`;
    hoverOverlay.style.left = `${rect.left}px`;
    hoverOverlay.style.width = `${rect.width}px`;
    hoverOverlay.style.height = `${rect.height}px`;
    hoverOverlay.style.display = "block";
}



window.addEventListener("mouseover", mouseoverElement,true);
window.addEventListener("click", mouseclickElement,true);
