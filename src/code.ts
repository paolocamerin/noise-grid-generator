// This plugin creates a grid of instances based on user input and selection
// It allows users to select a component and create multiple instances in a grid pattern

// This file holds the main code for the plugins. It has access to the *document*.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (see documentation).

figma.showUI(__html__);
figma.ui.resize(400, 830);

import { PluginMessage, GridConfig, ShapeConfig } from './types/index';
import { createNoise2D } from "simplex-noise";

// Initialize noise generator for potential random variations
const noise = createNoise2D();

// Track the currently selected node in Figma
let selectedNode: SceneNode | null = null;
// Track the main component for preview (when working with instances)
let mainComponent: ComponentNode | null = null;
// Track all variant images for preview randomization
let variantImages: Uint8Array[] = [];

// Function to get the main component for preview
async function getMainComponentForPreview(node: SceneNode): Promise<ComponentNode | null> {
  if (node.type === 'COMPONENT') {
    return node as ComponentNode;
  } else if (node.type === 'INSTANCE') {
    try {
      const mainComp = await (node as InstanceNode).getMainComponentAsync();
      return mainComp;
    } catch (error) {
      return null;
    }
  }
  return null;
}

// Function to load all variant images for a component or component set
async function loadVariantImages(node: ComponentNode | ComponentSetNode): Promise<Uint8Array[]> {
  const images: Uint8Array[] = [];

  try {
    let variants: ComponentNode[] = [];

    if (node.type === 'COMPONENT_SET') {
      // If it's a component set, get all its children
      variants = node.children as ComponentNode[];
    } else if (node.type === 'COMPONENT') {
      // If it's a component, check if it's part of a component set
      const parent = node.parent;
      if (parent && parent.type === 'COMPONENT_SET') {
        variants = parent.children as ComponentNode[];
      } else {
        // Single component, load just the main component image
        const image = await node.exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 1 }
        });
        images.push(image);
        return images;
      }
    }

    // Load image for each variant
    for (const variant of variants) {
      try {
        const image = await variant.exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 1 }
        });
        images.push(image);
      } catch (error) {
      }
    }
  } catch (error) {
  }

  return images;
}

// Function to handle variant group selection - load first variant's image
async function handleVariantGroupSelection(node: SceneNode): Promise<Uint8Array | null> {
  if (node.type === 'COMPONENT_SET') {
    const variants = node.children as ComponentNode[];
    if (variants.length > 0) {
      // Load the first variant's image
      try {
        const firstVariant = variants[0];
        if (firstVariant) {
          const image = await firstVariant.exportAsync({
            format: 'PNG',
            constraint: { type: 'SCALE', value: 1 }
          });

          return image;
        }
      } catch (error) {
        return null;
      }
    }
  }
  return null;
}

// Function to create a grid with the current selection
async function createGridWithSelection(gridData: any) {
  // Ensure a node is selected before proceeding
  if (!selectedNode) {
    figma.notify('Please select an object first');
    return;
  }

  // Create or use existing component based on selection type
  let gridComponent: ComponentNode | null = null;

  if (selectedNode.type === 'COMPONENT') {
    // If it's already a component, use it as is
    gridComponent = selectedNode as ComponentNode;
  } else if (selectedNode.type === 'INSTANCE') {
    try {
      // If it's an instance, use its main component
      const mainComponent = await (selectedNode as InstanceNode).getMainComponentAsync();
      if (!mainComponent) {
        figma.notify('Could not find the main component for this instance');
        return;
      }
      gridComponent = mainComponent;
    } catch (error) {
      figma.notify('Error accessing the main component. Please try again.');
      return;
    }
  } else if (selectedNode.type === 'COMPONENT_SET') {
    // If a variant group is selected, use the first variant as the component
    const variants = (selectedNode as ComponentSetNode).children as ComponentNode[];
    if (!variants || variants.length === 0) {
      figma.notify('This component set has no variants to instantiate');
      return;
    }
    gridComponent = variants[0] ?? null;
  } else {
    // For other node types, try to create a component from the node safely
    try {
      gridComponent = figma.createComponentFromNode(selectedNode);
    } catch (error) {
      figma.notify('Cannot create a component from the selected node. Select a component, instance, or a frame/group.');
      return;
    }
  }

  // Create grid instances from the component
  if (gridComponent && gridData) {
    const instances = gridData.map((element: { x: number; y: number; rotation: number; variantIndex?: number; randomizeVariants?: boolean; }) => {
      // Decide which component to instantiate for this cell
      let componentForCell: ComponentNode = gridComponent as ComponentNode;
      if (element.randomizeVariants && element.variantIndex !== undefined) {
        try {
          const parent = gridComponent.parent;
          if (parent && parent.type === 'COMPONENT_SET') {
            const variants = parent.children as ComponentNode[];
            if (variants && variants.length > 0) {
              componentForCell = variants[element.variantIndex % variants.length] || gridComponent;
            }
          }
        } catch (error) {
        }
      }

      // Create instance from the chosen component
      const instance = componentForCell.createInstance();

      // Get the width and height of the instance
      const width = instance.width;
      const height = instance.height;

      // Position the instance so its center is at the specified coordinates
      instance.x = element.x - width / 2;
      instance.y = element.y - height / 2;

      // Apply rotation
      if (typeof element.rotation === 'number') {
        // Figma rotates counterclockwise for positive angles
        instance.rotation = -element.rotation;
      }

      return instance;
    });

    // Group all instances together and position them
    const group = figma.group(instances, figma.currentPage);
    group.name = "Noise grid";
    positionGroup(group);

    // Position the original component at the top-left of the group if it was newly created
    if (selectedNode.type !== 'COMPONENT' && selectedNode.type !== 'INSTANCE') {
      // Position at the top-left of the group
      gridComponent.x = group.x - gridComponent.width - 20; // 20px spacing to the left
      gridComponent.y = group.y; // Same y position as the group
    }
  }
}

// Function to get background color, prioritizing page color first
function getBackgroundColorFromNode(node: SceneNode | PageNode): { r: number, g: number, b: number } {
  const defaultColor = { r: 245 / 255, g: 245 / 255, b: 245 / 255 };

  // First check if we're on a page or get the current page
  const currentPage = node.type === 'PAGE' ? node as PageNode : figma.currentPage;

  // Try to get page background color
  if (currentPage.backgrounds && Array.isArray(currentPage.backgrounds)) {
    const pageFill = currentPage.backgrounds.find(fill => fill.type === 'SOLID' && fill.visible !== false);
    if (pageFill && pageFill.type === 'SOLID') {
      return {
        r: pageFill.color.r,
        g: pageFill.color.g,
        b: pageFill.color.b
      };
    }
  }

  // If node has a parent, check parent's fill
  if (node.parent && (node.parent as BaseNode).type !== 'PAGE') {
    const parent = node.parent as SceneNode;
    if ('fills' in parent) {
      const fills = parent.fills as Paint[];
      if (fills && Array.isArray(fills)) {
        const solidFill = fills.find(fill => fill.type === 'SOLID' && fill.visible !== false);
        if (solidFill && solidFill.type === 'SOLID') {
          return {
            r: solidFill.color.r,
            g: solidFill.color.g,
            b: solidFill.color.b
          };
        }
      }
    }
  }

  // If no background color found, return default color
  return defaultColor;
}

// Load all pages to ensure we can listen to document changes
// This is required for dynamic page loading
(async function initializePlugin() {
  try {
    await figma.loadAllPagesAsync();

    // Check if there's already a selection when the plugin opens
    const initialSelection = figma.currentPage.selection;
    if (initialSelection.length === 1 && initialSelection[0]) {
      selectedNode = initialSelection[0];

      // Send the selection to the UI
      if (selectedNode) {
        try {
          // Prevent sections from being previewed
          if (selectedNode.type === 'SECTION') {
            figma.ui.postMessage({
              type: 'selection-updated',
              image: null,
              hasSelection: true,
              errorMessage: 'Sections are not supported.\n Please select a layer, frame, component, or instance.'
            });
            return;
          }
          let image: Uint8Array | null = null;
          let initialVariantImages: Uint8Array[] | undefined;

          if (selectedNode.type === 'COMPONENT_SET') {
            const firstVariant = (selectedNode as ComponentSetNode).children?.[0] as ComponentNode | undefined;
            if (firstVariant) {

              image = await firstVariant.exportAsync({
                format: 'PNG',
                constraint: { type: 'SCALE', value: 1 }
              });
              initialVariantImages = await loadVariantImages(selectedNode as ComponentSetNode);
            } else {
              figma.notify('Selected component set has no variants');
            }
          } else {
            image = await selectedNode.exportAsync({
              format: 'PNG',
              constraint: { type: 'SCALE', value: 1 }
            });
          }



          // Extract background color from node hierarchy
          const backgroundColor = getBackgroundColorFromNode(selectedNode);

          figma.ui.postMessage({
            type: 'selection-updated',
            image: image,
            hasSelection: true,
            backgroundColor: backgroundColor,
            variantImages: initialVariantImages,
            isSelectionASet: selectedNode.type === 'COMPONENT_SET'
          });
        } catch (error) {
          figma.notify('Error exporting preview image');
        }
      }
    }

    // Handle document changes to update preview
    figma.on('documentchange', async (event) => {
      if (!selectedNode) return;

      try {
        // Check if the changes affect the selected node or its related components
        const changeChecks = await Promise.all(event.documentChanges.map(async change => {
          if (change.id === (selectedNode as SceneNode).id) return true;

          if ((selectedNode as SceneNode).type === "INSTANCE") {
            const mainComponent = (selectedNode as InstanceNode).mainComponent;
            return mainComponent && change.id === mainComponent.id;
          }

          if ((selectedNode as SceneNode).type === "COMPONENT") {
            // Use getInstancesAsync instead of directly accessing instances
            const instances = await (selectedNode as ComponentNode).getInstancesAsync();
            return instances.some(instance => change.id === instance.id);
          }

          return false;
        }));

        const isRelevantChange = changeChecks.some(result => result);

        if (isRelevantChange) {
          // Update preview when relevant changes occur
          let image: Uint8Array | null = null;
          let updatedVariantImages: Uint8Array[] | undefined;

          if (selectedNode.type === 'SECTION') {
            figma.ui.postMessage({
              type: 'selection-updated',
              image: null,
              errorMessage: 'Sections are not supported.\n Please select a layer, frame, component, or instance.',
              backgroundColor: getBackgroundColorFromNode(figma.currentPage)
            });
            return;
          } else if (selectedNode.type === 'COMPONENT_SET') {
            const firstVariant = (selectedNode as ComponentSetNode).children?.[0] as ComponentNode | undefined;
            if (firstVariant) {
              image = await firstVariant.exportAsync({
                format: 'PNG',
                constraint: { type: 'SCALE', value: 1 }
              });
              updatedVariantImages = await loadVariantImages(firstVariant);
            }
          } else {
            image = await selectedNode.exportAsync({
              format: 'PNG',
              constraint: { type: 'SCALE', value: 1 }
            });
          }

          figma.ui.postMessage({
            type: 'selection-updated',
            image: image,
            variantImages: updatedVariantImages,
            backgroundColor: getBackgroundColorFromNode(figma.currentPage)
          });
        }
      } catch (error) {
        figma.notify('Error updating preview');
      }
    });
  } catch (error) {
    figma.notify('Error initializing plugin. Please try again.');
  }
})();

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'create-grid') {
    await createGridWithSelection(msg.data);
  } else if (msg.type === 'selection-status-check') {
    // Send back whether there's a selection or not
    figma.ui.postMessage({
      type: 'selection-status',
      hasSelection: selectedNode !== null,
      isSelectionASet: selectedNode?.type === 'COMPONENT_SET'
    });
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};

// Handle selection changes in Figma
figma.on('selectionchange', async () => {
  const selection = figma.currentPage.selection;

  if (selection.length === 1 && selection[0]) {
    selectedNode = selection[0];

    // Get the main component for preview (if it's a component or instance)
    const newMainComponent = await getMainComponentForPreview(selectedNode);

    // Only update preview if:
    // 1. We don't have a main component yet, OR
    // 2. The main component has changed, OR  
    // 3. The selected node is not a component/instance (regular node)
    const shouldUpdatePreview = !mainComponent ||
      (newMainComponent && newMainComponent.id !== mainComponent.id) ||
      !newMainComponent;

    if (shouldUpdatePreview) {
      // Prevent sections from being previewed
      if (selectedNode.type === 'SECTION') {
        figma.ui.postMessage({
          type: 'selection-updated',
          image: null,
          hasSelection: true,
          errorMessage: 'Sections are not supported.\n Please select a layer, frame, component, or instance.'
        });
        return;
      }
      mainComponent = newMainComponent;

      // Handle variant group selection
      if (selectedNode.type === 'COMPONENT_SET') {
        const variantGroupImage = await handleVariantGroupSelection(selectedNode);
        if (variantGroupImage) {
          // Load all variants for the group
          const firstVariant = (selectedNode as ComponentSetNode).children[0] as ComponentNode;
          if (firstVariant) {
            variantImages = await loadVariantImages(firstVariant);
          }


          const backgroundColor = getBackgroundColorFromNode(selectedNode);

          figma.ui.postMessage({
            type: 'selection-updated',
            image: variantGroupImage,
            hasSelection: true,
            backgroundColor: backgroundColor,
            variantImages: variantImages,
            isSelectionASet: true
          });
          return;
        }
      }

      // Load variant images if we have a component
      if (mainComponent) {
        variantImages = await loadVariantImages(mainComponent);

      } else {
        variantImages = [];
      }

      // Use the main component for preview if available, otherwise use the selected node
      const previewNode = mainComponent || selectedNode;

      try {
        // Export the preview node as PNG
        const image = await previewNode.exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 1 }
        });



        // Extract background color from node hierarchy
        const backgroundColor = getBackgroundColorFromNode(selectedNode);

        figma.ui.postMessage({
          type: 'selection-updated',
          image: image,
          hasSelection: true,
          backgroundColor: backgroundColor,
          variantImages: variantImages,
          isSelectionASet: selectedNode.type === 'COMPONENT_SET'
        });
      } catch (error) {
        figma.notify('Error updating preview');
      }
    } else {
      // For now, let's always update the preview to keep it simple
      // TODO: Implement smart component preview in a future iteration
      const previewNode = mainComponent || selectedNode;

      try {
        const image = await previewNode.exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 1 }
        });

        const backgroundColor = getBackgroundColorFromNode(selectedNode);

        figma.ui.postMessage({
          type: 'selection-updated',
          image: image,
          hasSelection: true,
          backgroundColor: backgroundColor,
          variantImages: variantImages,
          isSelectionASet: selectedNode.type === 'COMPONENT_SET'
        });
      } catch (error) {
        figma.notify('Error updating preview');
      }
    }
  } else {
    selectedNode = null;
    mainComponent = null;
    figma.ui.postMessage({
      type: 'selection-updated',
      image: null,
      hasSelection: false
    });
  }
});

// Utility function to create a shape based on configuration
function createShape(config: ShapeConfig): EllipseNode {
  const shape = figma.createEllipse();
  shape.name = config.name;
  shape.x = config.x;
  shape.y = config.y;
  shape.resize(config.dimension, config.dimension);
  shape.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  return shape;
}

// Utility function to create a group of shapes
function createShapesGroup(shapes: EllipseNode[]): GroupNode {
  const group = figma.group(shapes, figma.currentPage);
  group.name = "Noise grid";
  return group;
}

// Utility function to position a group in the center of the viewport
function positionGroup(group: GroupNode): void {
  group.x = figma.viewport.center.x - group.width / 2;
  group.y = figma.viewport.center.y - group.height / 2;
  figma.currentPage.appendChild(group);
}

// Utility function to validate grid configuration
function validateGridConfig(config: GridConfig): void {
  if (config.columns <= 0 || config.rows <= 0) {
    throw new Error('Grid dimensions must be positive numbers');
  }
  if (config.size <= 0) {
    throw new Error('Dot size must be positive');
  }
}