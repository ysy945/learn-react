import React from "./react";
import ReactDOM from "./react-dom";
import App from "./App";
import C from "./C";

debugger;
ReactDOM.render(
  <div style={{ backgroundColor: "red" }}>
    <p style={{ color: "blue" }}>hello</p>
    123 2<p>点我</p>
    <div>asd</div>
    <App>987654</App>
    <App />
    <C></C>
    <C />
  </div>,
  document.getElementById("root")
);
