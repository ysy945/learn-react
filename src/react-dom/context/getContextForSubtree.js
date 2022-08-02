const emptyContextObject = {};

export default function getContextForSubtree(parentComponent) {
  //!如果不存在父组件返回空对象
  if (!parentComponent) {
    return emptyContextObject;
  }
  //TODO 后面看是否实现context
  /*var fiber = get(parentComponent);
  var parentContext = findCurrentUnmaskedContext(fiber);

  if (fiber.tag === ClassComponent) {
    var Component = fiber.type;

    if (isContextProvider(Component)) {
      return processChildContext(fiber, Component, parentContext);
    }
  }

  return parentContext;*/
}
