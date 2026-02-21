/** Source position information for WYSIWYG editor mapping */
export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface SourceLocation {
  start: Position;
  end: Position;
}

// --- Block Nodes ---

export interface Document {
  type: "document";
  children: BlockNode[];
  sourceLocation: SourceLocation;
}

export interface Heading {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
  sourceLocation: SourceLocation;
}

export interface Paragraph {
  type: "paragraph";
  children: InlineNode[];
  sourceLocation: SourceLocation;
}

export interface BlankLine {
  type: "blank_line";
  sourceLocation: SourceLocation;
}

export interface List {
  type: "list";
  ordered: boolean;
  start: number;
  tight: boolean;
  children: ListItem[];
  sourceLocation: SourceLocation;
}

export interface ListItem {
  type: "list_item";
  marker: string;
  children: BlockNode[];
  sourceLocation: SourceLocation;
}

export interface ThematicBreak {
  type: "thematic_break";
  sourceLocation: SourceLocation;
}

export interface CodeBlock {
  type: "code_block";
  info: string;
  value: string;
  sourceLocation: SourceLocation;
}

export interface BlockQuote {
  type: "block_quote";
  children: BlockNode[];
  sourceLocation: SourceLocation;
}

export type BlockNode =
  | Heading
  | Paragraph
  | List
  | ListItem
  | BlankLine
  | ThematicBreak
  | CodeBlock
  | BlockQuote;

// --- Inline Nodes ---

export interface Text {
  type: "text";
  value: string;
  sourceLocation: SourceLocation;
}

export interface Emphasis {
  type: "emphasis";
  children: InlineNode[];
  sourceLocation: SourceLocation;
}

export interface Strong {
  type: "strong";
  children: InlineNode[];
  sourceLocation: SourceLocation;
}

export interface Link {
  type: "link";
  destination: string;
  title: string | null;
  children: InlineNode[];
  sourceLocation: SourceLocation;
}

export interface SoftBreak {
  type: "softbreak";
  sourceLocation: SourceLocation;
}

export interface HardBreak {
  type: "hardbreak";
  sourceLocation: SourceLocation;
}

export interface CodeSpan {
  type: "code_span";
  value: string;
  sourceLocation: SourceLocation;
}

export type InlineNode = Text | Emphasis | Strong | Link | SoftBreak | HardBreak | CodeSpan;

/** Reference link definition collected during block parsing */
export interface LinkReference {
  label: string;
  destination: string;
  title: string | null;
}
