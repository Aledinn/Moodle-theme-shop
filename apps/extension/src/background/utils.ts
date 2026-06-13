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

export async function getCurrentTabContext(allowedDomains?: string[]): Promise<{ domain: string, tab: chrome.tabs.Tab } | null> {
    const tab = await getCurrentTab();
    
    if  (!tab || !tab.id || !tab.url){
        return null;
    }
    const domain = getDomainFromUrl(tab.url);
    if (!domain || (allowedDomains && !isInScope(domain, allowedDomains))) {
        return null;
    }
    return { domain, tab };
}

export function markDomainAsApplied(domain: string, list: string[]) {
    if (!isInScope(domain, list)) {
        list.push(domain);
    }
}
