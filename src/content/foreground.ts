let selectionMode = false;

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
    const target = event.target;
    target.style.outline = "2px solid red";
}

function mouseoutElement(event: MouseEvent) {
    if (!selectionMode) {
        return;
    }
    if (!(event.target instanceof HTMLElement)) {
        return;
    }
    const target = event.target;
    target.style.outline = "";
}

function mouseclickElement(event: MouseEvent) {
    if (!selectionMode) {
        return;
    }
    if (!(event.target instanceof HTMLElement)) {
        return;
    }
    const target = event.target;
    target.style.outline = "";
    selectionMode = false;
    let selector = target.parentElement?.parentElement?.tagName.toLowerCase() + " " + target.parentElement?.tagName.toLowerCase() + " " + target.tagName.toLowerCase();
    console.log("Selected element:", selector);
}

document.addEventListener("mouseover", mouseoverElement);
document.addEventListener("mouseout", mouseoutElement);
document.addEventListener("click", mouseclickElement);