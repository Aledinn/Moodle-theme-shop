import type { Theme } from "./theme-storage";
const API_BASE_URL = "http://localhost:8080"

export async function loadThemeFromBackend(themeId: number): Promise<Theme> {
    const themeUrl = '${API_BASE_URL}/${themeId}';

    const response = await fetch(themeUrl);

    if (!response.ok) {
        throw new Error(`Failed to load theme from backend: ${response.status}`);
    }

    const theme = await response.json();

    console.log("Loaded theme:", theme);

    return theme;
}
