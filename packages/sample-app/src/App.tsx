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
  // Allow e2e tests to supply initial markdown via ?md= URL parameter.
  const urlMd = new URLSearchParams(window.location.search).get("md");
  const [value, setValue] = useState(urlMd ?? INITIAL_MARKDOWN);

  return (
    <div className="app">
      <h1 className="app-title">Markdown WYSIWYG Editor</h1>
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
