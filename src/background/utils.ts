export async function getCurrentTab() {
    const queryOptions = { active: true, lastFocusedWindow: true };
    const [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

export function isInScope(url: string, list: string[]) {
    return list.some((presentUrl) => url.startsWith(presentUrl));
}

export function getDomainFromUrl(url: string): string | null {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname;
    } catch (error) {
        console.error("Invalid URL:", url);
        return null;
    }
}