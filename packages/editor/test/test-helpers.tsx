import { render } from "@testing-library/react";
import { parse } from "parser-cst";
import { cstToReact } from "../src/rendering/cst-to-react.js";
import { extractText } from "../src/text-extraction/extract-text.js";

export function roundTrip(source: string): string {
  const doc = parse(source);
  const elements = cstToReact(doc);
  const { container } = render(<div>{elements}</div>);
  return extractText(container.firstElementChild as HTMLElement);
}

export function renderIntoContainer(source: string): HTMLElement {
  const doc = parse(source);
  const elements = cstToReact(doc);
  const { container } = render(<div>{elements}</div>);
  return container.firstElementChild as HTMLElement;
}
