import {
    createEmptyThemeForSite,
    getThemeForSite,
    Theme,
    ThemeRule,
    upsertThemeForSite
} from "./theme-storage";

let activeEditingTheme: Theme = createEmptyThemeForSite("moodle.informatik.tu-darmstadt.de");
let selectedSelector: string | null = null;

export async function selectThemeRule(domain: string, selector: string) {
    selectedSelector = selector;
    activeEditingTheme = await getActiveThemeForDomain(domain);
    ensureRuleExists(selector);

    console.log("Selected selector:", selector);
    console.log("Current rules:", JSON.stringify(activeEditingTheme.rules, null, 2));
}

export async function updateSelectedThemeStyle(domain: string, property: string, value: string): Promise<Theme | null> {
    if (!selectedSelector) {
        console.error("No selected element to update");
        return null;
    }

    activeEditingTheme = await getActiveThemeForDomain(domain);

    const rule = ensureRuleExists(selectedSelector);
    rule.properties[property] = value;

    await upsertThemeForSite(activeEditingTheme);

    return activeEditingTheme;
}

async function getActiveThemeForDomain(domain: string): Promise<Theme> {
    if (activeEditingTheme.site === domain && activeEditingTheme.rules.length > 0) {
        return activeEditingTheme;
    }

    return (await getThemeForSite(domain)) ?? createEmptyThemeForSite(domain);
}

function ensureRuleExists(selector: string): ThemeRule {
    let rule = activeEditingTheme.rules.find((rule) => rule.selector === selector);

    if (!rule) {
        rule = {
            selector,
            properties: {}
        };

        activeEditingTheme.rules.push(rule);
    }

    return rule;
}

