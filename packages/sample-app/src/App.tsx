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

  return (
    <div className="app">
      <h1 className="app-title">Markdown WYSIWYG Editor (CST)</h1>
      <div className="editor-container">
        <Editor value={value} onChange={setValue} className="editor" />
      </div>
      <details className="raw-section">
        <summary>Raw Markdown</summary>
        <pre className="raw-source">{value}</pre>
      </details>
    </div>
  );
}

export default App;
