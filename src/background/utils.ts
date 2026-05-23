export async function getCurrentTab() {
    const queryOptions = { active: true, lastFocusedWindow: true };
    const [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

export function isInScope(url: string, list: string[]) {
    return list.some((presentUrl) => url.startsWith(presentUrl));
}
