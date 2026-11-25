export const SHOP_URL = import.meta.env.VITE_SHOP_URL;
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function isThemeTarget(url: string): boolean {
    try {
        const parsed = new URL(url);
        return /^https?:$/.test(parsed.protocol) && parsed.origin !== new URL(SHOP_URL).origin;
    } catch {
        return false;
    }
}
