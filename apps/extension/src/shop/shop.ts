import {API_BASE_URL} from "../shared/config"
const list = document.getElementById("theme-list");

if (list){
    interface Theme{
        id: string;
        name: string;
        author: string;
        description: string;
    }

    const response = await(fetch(`${API_BASE_URL}/themes`));

    if (!response.ok) {
        throw new Error(`Failed to load themes from backend: ${response.status}`);
    }
    
    const themes : Theme[] = await response.json();

    for(const theme of themes){
        const block = document.createElement("div");
        block.innerHTML = `
        <h2>${theme.name}</h2>
        <p>${theme.description}</p>
        <small>by ${theme.author}</small>
        <button data-id="${theme.id}">Install</button>
        `;
        block.querySelector("button")!.addEventListener("click", () => {
            chrome.runtime.sendMessage({ type: "install_theme",id: theme.id})
        });

        list.appendChild(block);
    }

}
