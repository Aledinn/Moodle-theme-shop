import type { Theme } from "./theme-storage";

export async function loadExampleTheme(): Promise<Theme> {
    const themeUrl = chrome.runtime.getURL("theme.json");

    const response = await fetch(themeUrl);

    if (!response.ok) {
        throw new Error(`Failed to load theme.json: ${response.status}`);
    }

    const theme = await response.json();

    console.log("Loaded theme:", theme);

    return theme;
}
