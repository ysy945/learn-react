import { KeyboardEventInterface } from "./interface";
import createSyntheticEvent from "./createSyntheticEvent";

export const SyntheticKeyboardEvent = createSyntheticEvent(
  KeyboardEventInterface
);
