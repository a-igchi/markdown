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
        <div data-testid="editor-wrapper">
          <Editor value={value} onChange={setValue} className="editor" />
        </div>
      </div>
      <details className="raw-section" data-testid="raw-section">
        <summary>Raw Markdown</summary>
        <pre className="raw-source" data-testid="raw-markdown">{value}</pre>
      </details>
    </div>
  );
}

export default App;
