import { modifierKeyToProp, normalizeKey, translateToKey } from "./key";

function getEventKey(nativeEvent) {
  if (nativeEvent.key) {
    var key = normalizeKey[nativeEvent.key] || nativeEvent.key;

    if (key !== "Unidentified") {
      return key;
    }
  }

  if (nativeEvent.type === "keypress") {
    var charCode = getEventCharCode(nativeEvent);

    return charCode === 13 ? "Enter" : String.fromCharCode(charCode);
  }

  if (nativeEvent.type === "keydown" || nativeEvent.type === "keyup") {
    return translateToKey[nativeEvent.keyCode] || "Unidentified";
  }

  return "";
}
function getEventCharCode(nativeEvent) {
  var charCode;
  var keyCode = nativeEvent.keyCode;
  if ("charCode" in nativeEvent) {
    charCode = nativeEvent.charCode;

    if (charCode === 0 && keyCode === 13) {
      charCode = 13;
    }
  } else {
    charCode = keyCode;
  }
  if (charCode === 10) {
    charCode = 13;
  }
  if (charCode >= 32 || charCode === 13) {
    return charCode;
  }

  return 0;
}

function getEventModifierState(nativeEvent) {
  return modifierStateGetter;
}
function modifierStateGetter(keyArg) {
  const syntheticEvent = this;
  const nativeEvent = syntheticEvent.nativeEvent;

  if (nativeEvent.getModifierState) {
    return nativeEvent.getModifierState(keyArg);
  }

  const keyProp = modifierKeyToProp[keyArg];
  return keyProp ? !!nativeEvent[keyProp] : false;
}

export const EventInterface = {
  eventPhase: 0,
  bubbles: 0,
  cancelable: 0,
  timeStamp: function (event) {
    return event.timeStamp || Date.now();
  },
  defaultPrevented: 0,
  isTrusted: 0,
};

export const UIEventInterface = Object.assign({}, EventInterface, {
  view: 0,
  detail: 0,
});

export const KeyboardEventInterface = Object.assign({}, UIEventInterface, {
  key: getEventKey,
  code: 0,
  location: 0,
  ctrlKey: 0,
  shiftKey: 0,
  altKey: 0,
  metaKey: 0,
  repeat: 0,
  locale: 0,
  getModifierState: getEventModifierState,
  charCode: function (event) {
    if (event.type === "keypress") {
      return getEventCharCode(event);
    }

    return 0;
  },
  keyCode: function (event) {
    if (event.type === "keydown" || event.type === "keyup") {
      return event.keyCode;
    }

    return 0;
  },
  which: function (event) {
    if (event.type === "keypress") {
      return getEventCharCode(event);
    }

    if (event.type === "keydown" || event.type === "keyup") {
      return event.keyCode;
    }
    return 0;
  },
});

export const MouseEventInterface = Object.assign({}, UIEventInterface, {
  screenX: 0,
  screenY: 0,
  clientX: 0,
  clientY: 0,
  pageX: 0,
  pageY: 0,
  ctrlKey: 0,
  shiftKey: 0,
  altKey: 0,
  metaKey: 0,
  getModifierState: getEventModifierState,
  button: 0,
  buttons: 0,
  relatedTarget: function (event) {
    if (event.relatedTarget === undefined)
      return event.fromElement === event.srcElement
        ? event.toElement
        : event.fromElement;
    return event.relatedTarget;
  },
  movementX: function (event) {
    if ("movementX" in event) {
      return event.movementX;
    }
  },
  movementY: function (event) {
    if ("movementY" in event) {
      return event.movementY;
    }
  },
});
