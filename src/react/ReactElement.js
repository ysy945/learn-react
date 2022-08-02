import { REACT_ELEMENT_TYPE } from "./reactTypes";

/**
 *
 * @param {*} type  "a" function class
 * @param {*} config
 * @param {*} key "关键字" key
 */
export function createElement(type, key, ref, props) {
  const element = {
    $$typeof: REACT_ELEMENT_TYPE,

    type: type,
    key: key,
    ref: ref,
    props: props,
  };
  return element;
}

//!克隆一个Element 主要是修改children 其他的属性通过Object.assign浅克隆一下
export function cloneElement(element, config, children) {
  if (element === null || element === undefined) {
    throw new Error(
      `React.cloneElement(...): The argument must be a React element, but you passed ${element}.`
    );
  }

  const props = Object.assign({}, element.props);
  let key = element.key;
  let ref = element.ref;

  if (config != null) {
    ref = config.ref;

    key = "" + config.key;

    let defaultProps;
    if (element.type && element.type.defaultProps) {
      defaultProps = element.type.defaultProps;
    }
    for (const propName in config) {
      if (hasOwnProperty.call(config, propName)) {
        if (config[propName] === undefined && defaultProps !== undefined) {
          props[propName] = defaultProps[propName];
        } else {
          props[propName] = config[propName];
        }
      }
    }
  }

  const childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    const childArray = Array(childrenLength);
    for (let i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    props.children = childArray;
  }

  return createElement(element.type, key, ref, props);
}
