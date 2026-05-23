export type ThemeRule = {
    selector: string;
    properties: Record<string, string>;
};

export type Theme = {
    name: string;
    site: string;
    author: string;
    description: string;
    version: string;
    rules: ThemeRule[];
};

export type InstalledThemes = {
    themesBySite: Record<string, Theme>;
};

const createEmptyInstalledThemes = (): InstalledThemes => ({
    themesBySite: {}
});

function isInstalledThemes(value: unknown): value is InstalledThemes {
    return (
        typeof value === "object" &&
        value !== null &&
        "themesBySite" in value
    );
}

export async function initializeStorage() {
    const data = await chrome.storage.local.get("installedThemes");

    if (!isInstalledThemes(data.installedThemes)) {
        await chrome.storage.local.set({
            installedThemes: createEmptyInstalledThemes()
        });

        console.log("storage initialized");
    }
    else {
        console.log("storage already initialized");
    }
}

export async function upsertThemeForSite(theme: Theme) {
    const data = await chrome.storage.local.get("installedThemes");

    const installedThemes = isInstalledThemes(data.installedThemes)
        ? data.installedThemes
        : createEmptyInstalledThemes();
    

    installedThemes.themesBySite[theme.site] = theme;

    await chrome.storage.local.set({ installedThemes });
    console.log(`Theme for site ${theme.site} installed successfully`);
    for (const rule of theme.rules) {
        for (const [property, value] of Object.entries(rule.properties)) {
            console.log(property, value);
        }
    }
}


