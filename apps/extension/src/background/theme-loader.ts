import type { Theme } from "./theme-storage";
import { API_BASE_URL } from "../shared/config";

export async function loadThemeFromBackend(themeId: number): Promise<Theme> {
    const themeUrl = `${API_BASE_URL}/themes/${themeId}`;

    const response = await fetch(themeUrl);

    if (!response.ok) {
        throw new Error(`Failed to load theme from backend: ${response.status}`);
    }

    const theme = await response.json();

    console.log("Loaded theme:", theme);

    return theme;
}
