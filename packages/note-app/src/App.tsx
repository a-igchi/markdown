import { useState } from "react";
import { Editor } from "editor-cst";
import { useLocalStorage } from "./hooks/useLocalStorage.js";
import { SpeedDial } from "./components/SpeedDial.js";
import "./App.css";

const INITIAL_CONTENT = `# My Notes

Start writing your notes here.

- Item one
- Item two

---

Another section.`;

function App() {
  const [value, setValue] = useLocalStorage("note-app:content", INITIAL_CONTENT);
  const [showSource, setShowSource] = useState(false);

  return (
    <div className="app">
      <div className="panes">
        <div className="pane">
          <Editor value={value} onChange={setValue} className="editor" />
        </div>
        {showSource && (
          <div className="pane">
            <textarea
              className="source-view"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              spellCheck={false}
            />
          </div>
        )}
      </div>
      <SpeedDial
        value={value}
        onChange={setValue}
        showSource={showSource}
        onToggleSource={() => setShowSource((s) => !s)}
      />
    </div>
  );
}

export default App;
