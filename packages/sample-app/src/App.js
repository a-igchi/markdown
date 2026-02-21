import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Editor } from "markdown-editor";
import "./App.css";
const INITIAL_MARKDOWN = `# Hello World

This is a **markdown** editor with *WYSIWYG* rendering.

- Item one
- Item two
- Item three

> This is a blockquote

\`\`\`js
console.log("hello");
\`\`\`

---

Click [here](https://example.com) to visit a link.`;
function App() {
    const [value, setValue] = useState(INITIAL_MARKDOWN);
    return (_jsxs("div", { className: "app", children: [_jsx("h1", { className: "app-title", children: "Markdown WYSIWYG Editor" }), _jsx("div", { className: "editor-container", children: _jsx(Editor, { value: value, onChange: setValue, className: "editor" }) }), _jsxs("details", { className: "raw-section", children: [_jsx("summary", { children: "Raw Markdown" }), _jsx("pre", { className: "raw-source", children: value })] })] }));
}
export default App;
