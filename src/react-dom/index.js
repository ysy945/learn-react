import { isValidContainer } from "./valid";
import legacyRenderSubtreeIntoContainer from "./legacyRenderSubtreeIntoContainer";

function render(element, container, callback) {
  console.log(element, container);
  debugger;
  if (!isValidContainer(container)) {
    throw new Error("render: Target container is not a DOM element.");
  }

  return legacyRenderSubtreeIntoContainer(null, element, container, callback);
}

const ReactDOM = {
  render,
};

export default ReactDOM;
//!用于判断当前节点是否被标记为root节点
// function isContainerMarkedAsRoot(node) {
// return !!node[internalContainerInstanceKey];
// }
