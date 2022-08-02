import { DOCUMENT_NODE, ELEMENT_NODE } from "./react-dom-types";

export function isValidContainer(node) {
  return (
    node && (node.nodeType === DOCUMENT_NODE || node.nodeType === ELEMENT_NODE)
  );
}
