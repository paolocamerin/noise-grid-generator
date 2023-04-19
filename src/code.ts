// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for the plugins. It has access to the *document*.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (see documentation).

// This shows the HTML page in "ui.html".
figma.showUI(__html__);
figma.ui.resize(300, 650);
// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
import { createNoise2D } from "simplex-noise";

const noise = createNoise2D();

figma.ui.onmessage = (msg) => {
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (msg.type === "create-grid") {
    const nodes: SceneNode[] = [];

    let dd = [];
    for (let d of msg.dots) {
      const dot = figma.createEllipse();
      dot.name = d.name;
      dot.x = d.x;
      dot.y = d.y;
      dot.resize(d.dimension, d.dimension);

      dot.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
      dd.push(dot);
    }

    const group = figma.group(dd, figma.currentPage);
    group.name = "Noise grid";

    // Position the group in the center of the viewport
    group.x = figma.viewport.center.x - group.width / 2;
    group.y = figma.viewport.center.y - group.height / 2;

    figma.currentPage.appendChild(group);
    nodes.push(group);

    figma.currentPage.selection = nodes;
  }
};

// Get the width and height of the content inside the frame
