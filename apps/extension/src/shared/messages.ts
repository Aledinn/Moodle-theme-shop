export type ImportTarget = { tabId: number; url: string; site: string; documentId: string };

export type ExtensionMessage =
    | { type: "capture_import_target"; tabId: number; url: string }
    | { type: "import_theme"; target: ImportTarget; source: string }
    | { type: "toggle_theme" }
    | { type: "open_editor" }
    | { type: "select_element" }
    | { type: "chosen_element"; selector: string }
    | { type: "update_selected_style"; property: string; value: string }
    | { type: "export_json"}
    | { type: "upload_theme"};

