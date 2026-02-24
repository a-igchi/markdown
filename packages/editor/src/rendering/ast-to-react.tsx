import type {
  Document,
  BlockNode,
  InlineNode,
  Heading,
  Paragraph,
  List,
  ListItem,
  CodeBlock,
  BlockQuote,
  Emphasis,
  Strong,
  Link,
  CodeSpan,
} from "markdown-parser";
import type { ReactNode } from "react";

export function astToReact(doc: Document, source: string): ReactNode[] {
  const result: ReactNode[] = [];
  for (let i = 0; i < doc.children.length; i++) {
    const node = doc.children[i];
    if (node.type === "blank_line") {
      // Only render the trailing blank_line as a cursor target
      if (i === doc.children.length - 1) {
        result.push(<p key={`b${i}`}><br /></p>);
      }
      continue;
    }
    result.push(renderBlockNode(node, `b${i}`, source, false));
  }
  return result;
}

function renderBlockNodes(
  nodes: BlockNode[],
  source: string,
  tight: boolean,
): ReactNode[] {
  const result: ReactNode[] = [];
  let keyIdx = 0;
  for (const node of nodes) {
    if (node.type === "blank_line") continue;
    result.push(renderBlockNode(node, `b${keyIdx}`, source, tight));
    keyIdx++;
  }
  return result;
}

function renderBlockNode(
  node: BlockNode,
  key: string,
  source: string,
  tight: boolean,
): ReactNode {
  switch (node.type) {
    case "heading":
      return renderHeading(node, key, source);
    case "paragraph":
      return renderParagraph(node, key, source, tight);
    case "list":
      return renderList(node, key, source);
    case "list_item":
      return renderListItem(node, key, source, tight);
    case "thematic_break":
      return renderThematicBreak(node, key, source);
    case "code_block":
      return renderCodeBlock(node, key, source);
    case "block_quote":
      return renderBlockQuote(node, key, source);
    case "blank_line":
      return null;
  }
}

function renderHeading(node: Heading, key: string, source: string): ReactNode {
  const Tag = `h${node.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  const prefix = "#".repeat(node.level) + " ";
  return (
    <Tag key={key} data-block="heading">
      {prefix}
      {renderInlineNodes(node.children, source)}
    </Tag>
  );
}

function renderParagraph(
  node: Paragraph,
  key: string,
  source: string,
  tight: boolean,
): ReactNode {
  if (tight) {
    return renderInlineNodes(node.children, source);
  }
  return (
    <p key={key} data-block="paragraph">
      {renderInlineNodes(node.children, source)}
    </p>
  );
}

function renderList(node: List, key: string, source: string): ReactNode {
  const children = node.children.map((item, i) =>
    renderListItem(item, `${key}-${i}`, source, node.tight),
  );
  if (node.ordered) {
    const startAttr = node.start !== 1 ? node.start : undefined;
    return (
      <ol key={key} data-block="list" start={startAttr}>
        {children}
      </ol>
    );
  }
  return (
    <ul key={key} data-block="list">
      {children}
    </ul>
  );
}

function renderListItem(
  node: ListItem,
  key: string,
  source: string,
  tight: boolean,
): ReactNode {
  const markerEnd = node.sourceLocation.start.offset + node.marker.length;
  const prefix =
    source[markerEnd] === " " ? node.marker + " " : node.marker;
  return (
    <li key={key} data-block="list_item">
      {prefix}
      {renderBlockNodes(node.children, source, tight)}
    </li>
  );
}

function renderThematicBreak(
  node: { sourceLocation: { start: { offset: number }; end: { offset: number } } },
  key: string,
  source: string,
): ReactNode {
  const text = source.slice(
    node.sourceLocation.start.offset,
    node.sourceLocation.end.offset,
  );
  return (
    <div key={key} data-block="thematic_break">
      {text}
    </div>
  );
}

function renderCodeBlock(
  node: CodeBlock,
  key: string,
  source: string,
): ReactNode {
  const text = source.slice(
    node.sourceLocation.start.offset,
    node.sourceLocation.end.offset,
  );
  const className = node.info ? `language-${node.info.split(/\s+/)[0]}` : undefined;
  return (
    <pre key={key} data-block="code_block">
      <code className={className}>{text}</code>
    </pre>
  );
}

function renderBlockQuote(
  node: BlockQuote,
  key: string,
  source: string,
): ReactNode {
  // The block parser strips "^ {0,3}> ?" from each blockquote line before
  // parsing children, so all child node offsets are relative to that stripped
  // sub-source rather than the original source. Reconstruct it here so that
  // inline renderers (emphasis, strong, etc.) index the correct characters.
  const bqSource = source.slice(
    node.sourceLocation.start.offset,
    node.sourceLocation.end.offset,
  );
  const subSource = bqSource
    .split("\n")
    .map((line) => line.replace(/^ {0,3}> ?/, ""))
    .join("\n");

  return (
    <blockquote key={key} data-block="block_quote">
      {"> "}
      {renderBlockNodes(node.children, subSource, false)}
    </blockquote>
  );
}

function renderInlineNodes(nodes: InlineNode[], source: string): ReactNode[] {
  return nodes.map((node, i) => renderInlineNode(node, `i${i}`, source));
}

function renderInlineNode(
  node: InlineNode,
  key: string,
  source: string,
): ReactNode {
  switch (node.type) {
    case "text":
      return node.value;
    case "emphasis":
      return renderEmphasis(node, key, source);
    case "strong":
      return renderStrong(node, key, source);
    case "code_span":
      return renderCodeSpan(node, key, source);
    case "link":
      return renderLinkNode(node, key, source);
    case "softbreak":
      return "\n";
    case "hardbreak":
      return <br key={key} />;
  }
}

function renderEmphasis(
  node: Emphasis,
  key: string,
  source: string,
): ReactNode {
  const startChar = source[node.sourceLocation.start.offset];
  return (
    <em key={key}>
      {startChar}
      {renderInlineNodes(node.children, source)}
      {startChar}
    </em>
  );
}

function renderStrong(node: Strong, key: string, source: string): ReactNode {
  const startChar = source[node.sourceLocation.start.offset];
  const delim = startChar + startChar;
  return (
    <strong key={key}>
      {delim}
      {renderInlineNodes(node.children, source)}
      {delim}
    </strong>
  );
}

function renderCodeSpan(
  node: CodeSpan,
  key: string,
  source: string,
): ReactNode {
  const text = source.slice(
    node.sourceLocation.start.offset,
    node.sourceLocation.end.offset,
  );
  return (
    <code key={key}>
      {text}
    </code>
  );
}

function renderLinkNode(node: Link, key: string, source: string): ReactNode {
  const text = source.slice(
    node.sourceLocation.start.offset,
    node.sourceLocation.end.offset,
  );
  return (
    <a key={key} href={node.destination} title={node.title ?? undefined}>
      {text}
    </a>
  );
}
