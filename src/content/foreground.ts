let selectionMode = false;

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
    if (message.type === "select_element" && !selectionMode) {
        console.log("Received select_element message in foreground script");
        selectionMode = true;
    }
    else if (message.type === "select_element" && selectionMode) {
        console.log("Exiting selection mode");
        selectionMode = false;
    }});

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