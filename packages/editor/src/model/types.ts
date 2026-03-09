export type Block =
  | { type: "paragraph"; content: string }
  | { type: "heading"; content: string }
  | { type: "thematic_break"; content: string }
  | { type: "list"; content: string }
  | { type: "fenced_code_block"; content: string }
  | { type: "block_quote"; content: string }
  | { type: "blank_line"; content: "" };

export type Document = { blocks: readonly Block[] };

export type ModelCursor = { blockIndex: number; offset: number };
