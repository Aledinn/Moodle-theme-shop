export type ExtensionMessage =
    | { type: "toggle_theme" }
    | { type: "open_editor" }
    | { type: "select_element" }
    | { type: "chosen_element"; selector: string }
    | { type: "update_selected_style"; property: string; value: string }
    | { type: "install_theme"; id: number}
    | { type: "export_json"}
    | { type: "upload_theme"};

