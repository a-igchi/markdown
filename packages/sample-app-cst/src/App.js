import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Editor } from "editor-cst";
import "./App.css";
const INITIAL_MARKDOWN = `# Hello World

This is a markdown editor with CST-based rendering.

- Item one
- Item two
- Item three

1. First
2. Second
3. Third

---

Another paragraph here.`;
function App() {
    const [value, setValue] = useState(INITIAL_MARKDOWN);
    return (_jsxs("div", { className: "app", children: [_jsx("h1", { className: "app-title", children: "Markdown WYSIWYG Editor (CST)" }), _jsx("div", { className: "editor-container", children: _jsx(Editor, { value: value, onChange: setValue, className: "editor" }) }), _jsxs("details", { className: "raw-section", children: [_jsx("summary", { children: "Raw Markdown" }), _jsx("pre", { className: "raw-source", children: value })] })] }));
}
export default App;
