import Ajv from "ajv";
import portableSchema from "../../../../contracts/theme/portable.schema.json";
import summarySchema from "../../../../contracts/theme/api-summary.schema.json";

export const MAX_THEME_BYTES = 256 * 1024;

const ajv = new Ajv({ allErrors: true, strict: true });
// No coercion, defaults, removal of unknown fields, or CSS serialization.
const schemas = {
    portable: ajv.compile(portableSchema),
    api: ajv.compile(summarySchema),
};

/** Contract check only. Call before storing, rendering, or applying imported data. */
export function validateThemeBytes(
    bytes: Uint8Array,
    kind: "portable" | "api" = "portable",
    browser?: Pick<Document, "querySelector">,
): unknown {
    if (bytes.byteLength > MAX_THEME_BYTES) throw new Error("Theme exceeds 256 KiB");
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new Error("JSON BOM is unsupported");
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value: unknown = JSON.parse(source);
    checkUniqueKeys(source);
    const validate = schemas[kind];
    if (!validate(value)) throw new Error(ajv.errorsText(validate.errors));
    if (kind === "portable" && browser) {
        for (const rule of (value as { rules: { selector: string; properties: Record<string, string> }[] }).rules) {
            // Matching an element is not required; parsing every selector is.
            browser.querySelector(rule.selector);
            for (const [property, cssValue] of Object.entries(rule.properties)) {
                if (!CSS.supports(property, cssValue)) throw new Error("Browser rejected CSS value");
            }
        }
    }
    return value;
}

// JSON.parse accepts duplicate keys by dropping earlier values. Reject those files
// rather than silently changing their meaning. JSON.parse checks grammar first.
function checkUniqueKeys(source: string): void {
    let pos = 0;
    const skip = () => { while (/\s/.test(source[pos] ?? "") && pos < source.length) pos++; };
    const string = (): string => {
        const start = pos++;
        while (pos < source.length) {
            const char = source[pos++];
            if (char === "\\") pos++;
            else if (char === '"') break;
        }
        const result = JSON.parse(source.slice(start, pos)) as string;
        for (let i = 0; i < result.length; i++) {
            const code = result.charCodeAt(i);
            if (code >= 0xdc00 && code <= 0xdfff) throw new Error("Isolated low surrogate");
            if (code < 0xd800 || code > 0xdbff) continue;
            const low = result.charCodeAt(++i);
            if (!(low >= 0xdc00 && low <= 0xdfff)) throw new Error("Isolated high surrogate");
        }
        return result;
    };
    const visit = (depth: number): void => {
        if (depth > 32) throw new Error("JSON nesting exceeds 32");
        skip();
        if (source[pos] === "{") {
            pos++; skip();
            const keys = new Set<string>();
            if (source[pos] !== "}") {
                do {
                    skip();
                    const key = string();
                    if (keys.has(key)) throw new Error("Duplicate JSON field");
                    keys.add(key); skip(); pos++; // colon
                    visit(depth + 1); skip();
                    if (source[pos] !== ",") break;
                    pos++;
                } while (true);
            }
            pos++;
        } else if (source[pos] === "[") {
            pos++; skip();
            if (source[pos] !== "]") {
                do {
                    visit(depth + 1); skip();
                    if (source[pos] !== ",") break;
                    pos++;
                } while (true);
            }
            pos++;
        } else if (source[pos] === '"') string();
        else { while (pos < source.length && !/[\s,\]}]/.test(source[pos])) pos++; }
    };
    visit(0);
}
