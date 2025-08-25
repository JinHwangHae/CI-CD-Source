import * as JQuery from "jquery";
import "../css/annotationTreeview.css";
import { ParsedConstruktedAjax } from "../types/common";

interface TreeNodeData {
    id: string;
    title: string;
    icon: string;
    isVisible: boolean;
    children: TreeNodeData[];
    isLayer?: boolean;
    data: {
        postId: number;
        entityType: string;
        asset: string;
        type: string;
    };
}

interface DOMElements {
    jqContainer: JQuery;
    jqSaveButton: JQuery;
    jqCancelButton: JQuery;
    jqSearchInput: JQuery;
    jqControlsContainer: JQuery;
}

class AnnotationTreeView {
    private _container: HTMLElement;
    private _draggedElement: HTMLElement | null = null;
    private _nodes: Map<string, HTMLElement> = new Map();
    private _defaultLayer: HTMLElement | null = null;
    private _defaultLayerChildren: HTMLElement | null = null;
    private _nodeTemplate: HTMLTemplateElement = document.createElement("template");
    private _isEditMode: boolean = true;
    private _isDirty: boolean = false;
    private _eventHandlers: {
        onVisibilityChange?: (nodeId: string, isVisible: boolean, nodeType: string) => void;
        onMenuAction?: (nodeId: string, action: string) => void;
        onNodeMoved?: (nodeId: string, targetId: string, position: "before" | "after" | "inside") => void;
        onLayerRenamed?: (layerId: string, newName: string) => void;
    } = {};

    private readonly _CONSTRUKTED_AJAX: ParsedConstruktedAjax;
    private _treeStructure: any = null;
    private _elements: DOMElements;
    private _hasSavePermission: boolean = false;

    constructor(containerId: string) {
        this._CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;
        const jQuery = window.jQuery;

        // Initialize container
        const jqContainer = jQuery(containerId);
        if (!jqContainer.length) {
            throw new Error(`Container not found. ID/Selector: "${containerId}"`);
        }
        this._container = jqContainer[0];

        // Create and add controls first
        this._createControls();

        // Then initialize DOM elements after controls are created
        this._elements = this._getDOMElements();

        this._initNodeTemplate();
        this._initDragAndDrop();
        this._initNavigationWarning();

        // Create default layer after the controls
        const defaultLayer = this._createDefaultLayer();
        this._defaultLayer = defaultLayer;
        this._defaultLayerChildren = jQuery(defaultLayer).find(".node-children")[0];

        // Move all existing annotations into default layer
        this._moveExistingAnnotationsToDefaultLayer(defaultLayer);

        // Initialize an empty tree structure in case load fails
        this._initializeDefaultTreeStructure();

        // Set default save permission to true, will be updated after loading
        this._hasSavePermission = true;

        // Initialize tree in edit mode by default
        this._enableTreeModification();

        // Load tree structure
        this._loadTree().catch((error) => {
            console.error("Failed to load tree structure:", error);
        });
    }

    private _getDOMElements(): DOMElements {
        const jQuery = window.jQuery;
        const jqContainer = jQuery(this._container);

        return {
            jqContainer: jqContainer,
            jqSaveButton: jqContainer.find(".save-layer-btn"),
            jqCancelButton: jqContainer.find(".cancel-layer-btn"),
            jqSearchInput: jqContainer.find(".annotation-search-input"),
            jqControlsContainer: jqContainer.find(".annotation-tree-controls")
        };
    }

    private _initNodeTemplate() {
        const template = document.createElement("template");
        template.innerHTML = `
            <div class="annotation-tree-node" draggable="true">
                <div class="node-content">
                    <div class="node-controls">
                        <input type="checkbox" class="visibility-toggle">
                    </div>
                    <div class="node-info">
                        <i class="collapse-toggle" title="Collapse/Expand">▼</i>
                        <i></i>
                        <span class="node-title"></span>
                    </div>
                    <div class="node-actions make-relative">
                        <div class="layer-buttons"></div>
                        <button class="annotation-dropdown-toggle">⋮</button>
                        <div class="annotation-dropdown-menu hidden make-absolute make-flex make-flex-column make-gap-8">
                        </div>
                    </div>
                </div>
                <div class="node-children"></div>
            </div>
        `;
        this._nodeTemplate = template;
    }

    private _createDefaultLayer() {
        const defaultLayer: TreeNodeData = {
            id: "default-layer",
            title: "Annotation List",
            icon: "icon-layer",
            isVisible: true,
            isLayer: true,
            children: [],
            data: {
                postId: -1,
                entityType: "layer",
                asset: "",
                type: "layer"
            }
        };
        const layerNode = this.createNode(defaultLayer);
        this._container.appendChild(layerNode);
        return layerNode;
    }

    private _moveExistingAnnotationsToDefaultLayer(defaultLayer: HTMLElement) {
        // Get the children container of the default layer
        const childrenContainer = defaultLayer.querySelector(".node-children");
        if (!childrenContainer) return;

        // Get all existing annotations (direct children of the container that aren't the default layer or controls)
        const existingAnnotations = Array.from(this._container.children).filter(
            (node) =>
                node !== defaultLayer &&
                node instanceof HTMLElement &&
                !node.classList.contains("annotation-tree-controls")
        );

        // Move each annotation to the default layer's children container
        existingAnnotations.forEach((annotation) => {
            childrenContainer.appendChild(annotation);
        });
    }

    private _updateChildrenVisibility(parentNode: HTMLElement, isVisible: boolean) {
        const childrenContainer = parentNode.querySelector(".node-children");
        if (!childrenContainer) return;

        // Update all child checkboxes and trigger visibility change
        const childNodes = childrenContainer.querySelectorAll<HTMLElement>(".annotation-tree-node");
        childNodes.forEach((childNode) => {
            const checkbox = childNode.querySelector<HTMLInputElement>(".visibility-toggle");
            if (checkbox && checkbox.checked !== isVisible) {
                checkbox.checked = isVisible;
                // Trigger visibility change for each child
                const nodeType = childNode.dataset.type || "annotation";
                const nodeId = childNode.dataset.id;
                if (nodeId) {
                    this._onVisibilityChange(nodeId, isVisible, nodeType);
                } else {
                    // Child node without ID found during visibility update
                    console.error("Child node without ID found during visibility update");
                }
            }
        });
    }

    private _startLayerRename(layerNode: HTMLElement) {
        const titleSpan = layerNode.querySelector(".node-title") as HTMLElement;
        if (!titleSpan) return;

        const currentTitle = titleSpan.textContent || "";
        const input = document.createElement("input");
        input.type = "text";
        input.value = currentTitle;
        input.className = "layer-rename-input";
        input.style.cssText =
            "width: 100%; border: none; padding: 2px 4px; outline: none; background: white; border-radius: 2px;";

        const finishRename = () => {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== currentTitle) {
                const titleElement = layerNode.querySelector(".layer-title");
                if (titleElement) {
                    titleElement.textContent = newTitle;
                }
                const layerId = layerNode.dataset.id;
                if (layerId) {
                    this._onLayerRenamed(layerId, newTitle);
                    this._markDirty();
                } else {
                    // Layer node without ID found during rename
                    console.warn("Layer node without ID found during rename");
                }
            }
            input.remove();
            titleSpan.style.display = "";
        };

        input.addEventListener("blur", finishRename);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                finishRename();
            } else if (e.key === "Escape") {
                titleSpan.textContent = currentTitle;
                input.remove();
                titleSpan.style.display = "";
            }
        });

        titleSpan.style.display = "none";
        titleSpan.parentElement?.insertBefore(input, titleSpan);
        input.focus();
        input.select();
    }

    public createNode(data: TreeNodeData): HTMLElement {
        // Clone the template
        const node = this._nodeTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;

        // Set basic attributes
        if (data.isLayer) {
            node.classList.add("layer-node");
            // Add layer button only for the default layer
            const layerButtons = node.querySelector(".layer-buttons");
            if (layerButtons && data.id === "default-layer") {
                layerButtons.innerHTML = '<button class="add-layer-btn" title="Add New Layer">+</button>';
            }
            // Show collapse toggle for layer nodes
            const collapseToggle = node.querySelector(".collapse-toggle");
            if (collapseToggle) {
                collapseToggle.classList.remove("hidden");
            }
        } else {
            // Hide collapse toggle for non-layer nodes
            const collapseToggle = node.querySelector(".collapse-toggle");
            if (collapseToggle) {
                collapseToggle.classList.add("hidden");
            }
        }

        node.dataset.id = data.id;
        node.dataset.nodeType = data.isLayer ? "layer" : "annotation";

        // Update specific elements
        const visibilityToggle = node.querySelector(".visibility-toggle") as HTMLInputElement;
        visibilityToggle.checked = data.isVisible;

        // Set icon based on type
        const icon = node.querySelector(".node-info i:not(.collapse-toggle)");
        if (icon) {
            // For layers, use icon-layer, for annotations use their specific icon
            icon.className = data.isLayer ? "icon-layer" : data.icon;
        }

        const title = node.querySelector(".node-title");
        if (title) {
            title.textContent = data.title;
        }

        // Set up dropdown menu
        const dropdownMenu = node.querySelector(".annotation-dropdown-menu");
        if (dropdownMenu) {
            if (data.isLayer && data.id !== "default-layer") {
                dropdownMenu.innerHTML = `<button class="menu-item" data-action="rename"><i class="gwicon-edit"></i> Rename</button>
                 <button class="menu-item" data-action="delete-layer"><i class="icon-delete"></i> Delete Layer</button>`;
                // Show the dropdown toggle button for non-default layers
                const dropdownToggle = node.querySelector(".annotation-dropdown-toggle") as HTMLElement;
                if (dropdownToggle) {
                    dropdownToggle.style.display = "block";
                }
            } else if (!data.isLayer) {
                dropdownMenu.innerHTML = `<button class="menu-item" data-action="edit"><i class="gwicon-edit"></i> Edit</button>
                 <button class="menu-item" data-action="view"><i class="icon-views"></i> View</button>
                 <button class="menu-item" data-action="delete"><i class="icon-delete"></i> Delete</button>`;
                // Show the dropdown toggle button for annotations
                const dropdownToggle = node.querySelector(".annotation-dropdown-toggle") as HTMLElement;
                if (dropdownToggle) {
                    dropdownToggle.style.display = "block";
                }
            } else {
                // Hide the dropdown toggle button for default layer
                const dropdownToggle = node.querySelector(".annotation-dropdown-toggle") as HTMLElement;
                if (dropdownToggle) {
                    dropdownToggle.style.display = "none";
                }
            }
        }

        // Add event listeners
        this._addNodeEventListeners(node, data);

        // Store node reference
        this._nodes.set(data.id, node);

        // Create children recursively
        if (data.children.length) {
            const fragment = document.createDocumentFragment();
            const childrenContainer = node.querySelector(".node-children");

            data.children.forEach((childData) => {
                const childNode = this.createNode(childData);
                fragment.appendChild(childNode);
            });

            if (childrenContainer) {
                childrenContainer.appendChild(fragment);
            }
        }

        return node;
    }

    private _addNodeEventListeners(node: HTMLElement, data: TreeNodeData): void {
        // Visibility toggle with parent-child relationship
        const visibilityToggle = node.querySelector(".visibility-toggle") as HTMLInputElement;
        if (visibilityToggle) {
            visibilityToggle.addEventListener("change", () => {
                const isVisible = visibilityToggle.checked;

                // If this is a layer, update all children
                if (data.isLayer) {
                    this._updateChildrenVisibility(node, isVisible);
                }

                this._onVisibilityChange(data.id, isVisible);
            });
        }

        // Add layer button listener
        const addLayerBtn = node.querySelector(".add-layer-btn");
        if (addLayerBtn) {
            addLayerBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this._createNewLayer(node);
            });
        }

        // Dropdown menu
        const dropdownToggle = node.querySelector(".annotation-dropdown-toggle");
        const dropdownMenu = node.querySelector(".annotation-dropdown-menu");

        if (dropdownToggle && dropdownMenu) {
            // Close all other dropdowns when clicking anywhere
            document.addEventListener("click", (e) => {
                const target = e.target as HTMLElement;
                if (!target.closest(".annotation-dropdown-toggle")) {
                    document.querySelectorAll(".annotation-dropdown-menu").forEach((menu) => {
                        menu.classList.add("hidden");
                    });
                }
            });

            // Toggle dropdown
            dropdownToggle.addEventListener("click", (e) => {
                e.stopPropagation();
                // Close all other dropdowns first
                document.querySelectorAll(".annotation-dropdown-menu").forEach((menu) => {
                    if (menu !== dropdownMenu) {
                        menu.classList.add("hidden");
                    }
                });
                dropdownMenu.classList.toggle("hidden");
            });

            // Menu item click handlers
            dropdownMenu.querySelectorAll(".menu-item").forEach((item) => {
                item.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const action = (item as HTMLElement).getAttribute("data-action") || "";
                    if (action === "rename" && data.isLayer) {
                        this._startLayerRename(node);
                    } else if (action === "delete-layer") {
                        if (data.id === "default-layer") {
                            alert("Cannot delete the default layer");
                            return;
                        }
                        this._deleteLayer(node);
                    } else {
                        this._onMenuAction(data.id, action);
                    }
                    dropdownMenu.classList.add("hidden");
                });
            });
        }
    }

    private _createNewLayer(parentNode: HTMLElement | null = null) {
        // Check if we're trying to create a sub-layer
        if (parentNode) {
            // Check if the parent is already a sub-sub-layer (prevent sub-sub-sub-layers)
            const parentDepth = AnnotationTreeView._getLayerDepth(parentNode);
            if (parentDepth >= 2) {
                alert("Cannot create layers more than 3 levels deep");
                return;
            }
        }

        const newLayerId = `layer-${Date.now()}`;
        const layerData: TreeNodeData = {
            id: newLayerId,
            title: "New Layer",
            icon: "icon-layer",
            isVisible: true,
            isLayer: true,
            children: [],
            data: {
                postId: -1,
                entityType: "layer",
                asset: "",
                type: "layer"
            }
        };

        const layerNode = this.createNode(layerData);
        if (parentNode) {
            const childrenContainer = parentNode.querySelector(".node-children");
            if (childrenContainer) {
                childrenContainer.appendChild(layerNode);
            }
        } else {
            this._container.appendChild(layerNode);
        }

        // Mark as dirty since we added a new layer
        this._markDirty();
    }

    private _deleteLayer(layerNode: HTMLElement) {
        if (!this._defaultLayer || !this._defaultLayerChildren) {
            // Default layer not found
            console.error("Default layer not found");
            return;
        }

        // Find the parent layer's children container
        const parentLayer = layerNode.parentElement?.closest(".layer-node");
        const targetContainer = parentLayer ? parentLayer.querySelector(".node-children") : this._defaultLayerChildren;

        if (!targetContainer) {
            // Target container not found
            console.error("Target container not found");
            return;
        }

        // Get all children of the layer being deleted
        const childrenContainer = layerNode.querySelector(".node-children");
        if (childrenContainer) {
            // Get all annotation nodes (non-layer nodes)
            const annotations = Array.from(childrenContainer.children).filter(
                (child) => child instanceof HTMLElement && !child.classList.contains("layer-node")
            );

            // Move each annotation to the parent layer
            annotations.forEach((annotation) => {
                targetContainer.appendChild(annotation);
            });

            // Handle nested layers recursively
            const nestedLayers = Array.from(childrenContainer.children).filter(
                (child) => child instanceof HTMLElement && child.classList.contains("layer-node")
            );

            // Move annotations from nested layers to parent layer
            nestedLayers.forEach((layer) => {
                const nestedChildrenContainer = layer.querySelector(".node-children");
                if (nestedChildrenContainer) {
                    while (nestedChildrenContainer.firstChild) {
                        const child = nestedChildrenContainer.firstChild;
                        if (child instanceof HTMLElement && !child.classList.contains("layer-node")) {
                            targetContainer.appendChild(child);
                        }
                    }
                }
            });
        }

        // Remove the layer node
        layerNode.remove();

        // Remove from nodes Map
        const layerId = layerNode.dataset.id;
        if (layerId) {
            this._nodes.delete(layerId);
        }

        // Mark as dirty since we deleted a layer
        this._markDirty();
    }

    private _initDragAndDrop() {
        this._container.addEventListener("dragstart", (e) => {
            const target = e.target as HTMLElement;
            if (!target.classList.contains("annotation-tree-node")) return;

            this._draggedElement = target;
            target.classList.add("dragging");
        });

        this._container.addEventListener("dragend", () => {
            if (this._draggedElement) {
                this._draggedElement.classList.remove("dragging");
                this._draggedElement = null;
            }
        });

        this._container.addEventListener("dragover", this._handleDragOver.bind(this));
        this._container.addEventListener("drop", this._handleDrop.bind(this));

        // Use event delegation for common events
        this._container.addEventListener("click", this._handleClick.bind(this));

        // Close dropdowns when clicking outside
        document.addEventListener("click", (e) => {
            const target = e.target as HTMLElement;
            if (!target.closest(".annotation-options")) {
                document.querySelectorAll(".annotation-dropdown-menu").forEach((menu) => {
                    menu.classList.add("hidden");
                });
            }
        });
    }

    private _handleClick(e: MouseEvent) {
        const target = e.target as HTMLElement;

        if (target.classList.contains("collapse-toggle")) {
            AnnotationTreeView._handleCollapseToggle(target);
        } else if (target.classList.contains("visibility-toggle")) {
            this._handleVisibilityToggle(target);
        } else if (target.classList.contains("annotation-dropdown-toggle")) {
            AnnotationTreeView._handleDropdownToggle(e, target);
        } else if (target.classList.contains("menu-item")) {
            this._handleMenuItem(e, target);
        } else if (target.classList.contains("add-layer-btn")) {
            this._handleAddLayer(e, target);
        }
    }

    private static _handleCollapseToggle(target: HTMLElement) {
        const node = target.closest(".annotation-tree-node") as HTMLElement;
        if (!node || !node.classList.contains("layer-node")) return;

        const childrenContainer = node.querySelector(".node-children") as HTMLElement;
        if (!childrenContainer) return;

        const isCollapsed = childrenContainer.classList.toggle("collapsed");
        target.classList.toggle("collapsed", isCollapsed);
        target.textContent = "▼";
        target.title = isCollapsed ? "Expand" : "Collapse";
    }

    private _handleVisibilityToggle(target: HTMLElement) {
        const node = target.closest(".annotation-tree-node") as HTMLElement;
        if (!node) return;

        const nodeId = node.dataset.id;
        if (!nodeId) {
            // Visibility toggle clicked on node without ID
            console.error("Visibility toggle clicked on node without ID");
            return;
        }

        const isVisible = (target as HTMLInputElement).checked;
        if (node.classList.contains("layer-node")) {
            this._updateChildrenVisibility(node, isVisible);
        }
        this._onVisibilityChange(nodeId, isVisible);
    }

    private static _handleDropdownToggle(e: MouseEvent, target: HTMLElement) {
        e.stopPropagation();
        const dropdown = target.nextElementSibling as HTMLElement;
        if (!dropdown) return;

        // Close all other dropdowns first
        document.querySelectorAll(".annotation-dropdown-menu").forEach((menu) => {
            if (menu !== dropdown) {
                menu.classList.add("hidden");
            }
        });

        // Toggle the dropdown
        dropdown.classList.toggle("hidden");
    }

    private _handleMenuItem(e: MouseEvent, target: HTMLElement) {
        e.stopPropagation();
        const node = target.closest(".annotation-tree-node") as HTMLElement;
        if (!node) return;

        const nodeId = node.dataset.id;
        if (!nodeId) {
            // Menu item clicked on node without ID
            console.error("Menu item clicked on node without ID");
            return;
        }

        const action = target.getAttribute("data-action") || "";
        const isLayer = node.classList.contains("layer-node");

        if (action === "rename" && isLayer) {
            this._startLayerRename(node);
        } else if (action === "delete-layer") {
            if (nodeId === "default-layer") {
                alert("Cannot delete the default layer");
                return;
            }
            this._deleteLayer(node);
        } else {
            this._onMenuAction(nodeId, action);
        }
        target.closest(".annotation-dropdown-menu")?.classList.add("hidden");
    }

    private _handleAddLayer(e: MouseEvent, target: HTMLElement) {
        e.stopPropagation();
        const node = target.closest(".annotation-tree-node") as HTMLElement;
        this._createNewLayer(node);
    }

    private _handleDragOver(e: DragEvent) {
        if (!this._isEditMode) return;
        e.preventDefault();
        if (!this._draggedElement) return;

        const target = e.target as HTMLElement;
        const node = target.closest(".annotation-tree-node") as HTMLElement;
        if (!node || node === this._draggedElement) return;

        const rect = node.getBoundingClientRect();
        const mouseY = e.clientY;
        const threshold = 5;
        const isLayer = node.dataset.nodeType === "layer";

        const position = AnnotationTreeView._calculateDropPosition(mouseY, rect, threshold, isLayer);
        this._updateDropIndicators(node, position);
    }

    private _handleDrop(e: DragEvent) {
        if (!this._isEditMode) return;
        e.preventDefault();
        if (!this._draggedElement) return;

        const target = e.target as HTMLElement;
        const node = target.closest(".annotation-tree-node") as HTMLElement;
        if (!node || node === this._draggedElement) return;

        const rect = node.getBoundingClientRect();
        const mouseY = e.clientY;
        const threshold = 5;
        const isLayer = node.dataset.nodeType === "layer";

        // Check layer depth constraints before allowing drop
        if (this._draggedElement.classList.contains("layer-node")) {
            if (isLayer) {
                // Check if target would create a layer too deep
                const targetDepth = AnnotationTreeView._getLayerDepth(node);
                if (targetDepth >= 2) {
                    alert("Cannot create layers more than 3 levels deep");
                    return;
                }
            }
        }

        const position = AnnotationTreeView._calculateDropPosition(mouseY, rect, threshold, isLayer);
        this._performDrop(node, position);
    }

    private static _calculateDropPosition(
        mouseY: number,
        rect: DOMRect,
        threshold: number,
        isLayer: boolean
    ): "before" | "after" | "inside" {
        if (isLayer) {
            const topThreshold = rect.top + threshold;
            const bottomThreshold = rect.bottom - threshold;

            if (mouseY > topThreshold && mouseY < bottomThreshold) {
                return "inside";
            }
            return mouseY <= topThreshold ? "before" : "after";
        }
        return mouseY < rect.top + rect.height / 2 ? "before" : "after";
    }

    private _updateDropIndicators(node: HTMLElement, position: "before" | "after" | "inside") {
        this._clearDropIndicators();
        node.classList.add(`drop-${position}`);
    }

    private _performDrop(node: HTMLElement, position: "before" | "after" | "inside") {
        if (!this._draggedElement) return;

        if (position === "inside" && node.dataset.nodeType === "layer") {
            // Additional check for layer nesting
            if (this._draggedElement.classList.contains("layer-node")) {
                const targetDepth = AnnotationTreeView._getLayerDepth(node);
                if (targetDepth >= 2) {
                    alert("Cannot create layers more than 3 levels deep");
                    return;
                }
            }

            const childrenContainer = node.querySelector(".node-children");
            if (childrenContainer) {
                childrenContainer.appendChild(this._draggedElement);
            }
        } else {
            node.parentElement?.insertBefore(this._draggedElement, position === "before" ? node : node.nextSibling);
        }

        this._clearDropIndicators();

        const draggedNodeId = this._draggedElement.dataset.id;
        const targetNodeId = node.dataset.id;
        if (draggedNodeId && targetNodeId) {
            this._onNodeMoved(draggedNodeId, targetNodeId, position);
        } else {
            // Node move attempted with missing node IDs
            console.error("Node move attempted with missing node IDs");
        }

        // Mark as dirty since we moved a node
        this._markDirty();
    }

    private _clearDropIndicators() {
        this._container.querySelectorAll(".drop-before, .drop-after, .drop-inside").forEach((el) => {
            el.classList.remove("drop-before", "drop-after", "drop-inside");
        });
    }

    // Event handlers
    private _onVisibilityChange(nodeId: string, isVisible: boolean, nodeType?: string): void {
        if (this._eventHandlers.onVisibilityChange) {
            const node = this._nodes.get(nodeId);
            if (node) {
                const type = nodeType || node.dataset.nodeType || "";
                this._eventHandlers.onVisibilityChange(nodeId, isVisible, type);
            }
        }
    }

    private _onMenuAction(nodeId: string, action: string): void {
        if (this._eventHandlers.onMenuAction) {
            const node = this._nodes.get(nodeId);
            if (node) {
                this._eventHandlers.onMenuAction(nodeId, action);
            } else {
                // Attempted to perform action on deleted node
                console.error("Attempted to perform action on deleted node");
            }
        }
    }

    private _onNodeMoved(nodeId: string, targetId: string, position: "before" | "after" | "inside"): void {
        if (this._eventHandlers.onNodeMoved) {
            const sourceNode = this._nodes.get(nodeId);
            const targetNode = this._nodes.get(targetId);
            if (sourceNode && targetNode) {
                this._eventHandlers.onNodeMoved(nodeId, targetId, position);
            } else {
                // Attempted to move node but one or both nodes were deleted
                console.error("Attempted to move node but one or both nodes were deleted");
            }
        }
    }

    private _onLayerRenamed(layerId: string, newName: string): void {
        if (this._eventHandlers.onLayerRenamed) {
            const node = this._nodes.get(layerId);
            if (node && node.classList.contains("layer-node")) {
                this._eventHandlers.onLayerRenamed(layerId, newName);
            } else {
                // Attempted to rename deleted or invalid layer
                console.error("Attempted to rename deleted or invalid layer");
            }
        }
    }

    public setEventHandler<K extends keyof AnnotationTreeView["_eventHandlers"]>(
        event: K,
        handler: NonNullable<AnnotationTreeView["_eventHandlers"][K]>
    ): void {
        this._eventHandlers[event] = handler;
    }

    private static _getLayerDepth(node: HTMLElement): number {
        let depth = 0;
        let current = node;

        while (current.parentElement) {
            const parentLayer = current.parentElement.closest(".layer-node") as HTMLElement | null;
            if (!parentLayer) break;
            depth++;
            current = parentLayer;
        }

        return depth;
    }

    private _markDirty(): void {
        if (!this._isDirty) {
            this._isDirty = true;
            this._updateControlsVisibility();
        }
    }

    private _markClean(): void {
        this._isDirty = false;
        this._updateControlsVisibility();
    }

    private _updateControlsVisibility(): void {
        const jQuery = window.jQuery;
        const saveButton = jQuery(this._container).find(".save-layer-btn");
        const cancelButton = jQuery(this._container).find(".cancel-layer-btn");

        if (!this._hasSavePermission) {
            saveButton.addClass("hidden");
            cancelButton.addClass("hidden");
            if (this._isDirty) {
                // Show message that changes won't be saved
                const alert = document.createElement("div");
                alert.className = "ck-toolbar-alert ck-toolbar-alert-warning";
                alert.innerHTML = '<i class="icon-warning"></i> You don\'t have permission to save changes';

                const controlsContainer = this._elements.jqControlsContainer;
                if (controlsContainer.length) {
                    // Remove any existing warning
                    controlsContainer.find(".ck-toolbar-alert-warning").remove();
                    controlsContainer.after(alert);
                    setTimeout(() => {
                        alert.style.opacity = "0";
                        setTimeout(() => alert.remove(), 300);
                    }, 3000);
                }
            }
        } else if (this._isDirty) {
            saveButton.removeClass("hidden");
            cancelButton.removeClass("hidden");
        } else {
            saveButton.addClass("hidden");
            cancelButton.addClass("hidden");
        }
    }

    private async _handleSaveClick(): Promise<void> {
        if (!this._hasSavePermission) {
            const alert = document.createElement("div");
            alert.className = "ck-toolbar-alert ck-toolbar-alert-error";
            alert.innerHTML = '<i class="icon-error"></i> You don\'t have permission to save changes';

            const controlsContainer = this._elements.jqControlsContainer;
            if (controlsContainer.length) {
                controlsContainer.after(alert);
                setTimeout(() => {
                    alert.style.opacity = "0";
                    setTimeout(() => alert.remove(), 300);
                }, 3000);
            }
            return;
        }

        const saveButton = this._elements.jqSaveButton;
        const cancelButton = this._elements.jqCancelButton;
        if (!saveButton.length || !cancelButton.length) return;

        // Show loading state
        const originalSaveButtonText = saveButton.html();
        saveButton.html('<i class="icon-loading"></i>').prop("disabled", true);
        cancelButton.prop("disabled", true);

        try {
            // Save to backend using FormData
            const formData = new FormData();
            formData.append("action", "save_annotation_tree");
            formData.append("project_id", this._CONSTRUKTED_AJAX.post_id);
            formData.append("tree_data", JSON.stringify(this._serializeTree()));
            const response = await window.jQuery.ajax({
                url: this._CONSTRUKTED_AJAX.ajaxurl,
                type: "POST",
                data: formData,
                processData: false,
                contentType: false
            });
            if (!response.success) {
                throw new Error(response.data || "Failed to save tree structure");
            }

            // Update the cached tree structure with current state
            this._treeStructure = this._serializeTree();

            // Mark as clean and hide save/cancel buttons
            this._markClean();

            // Show success message
            const alert = document.createElement("div");
            alert.className = "ck-toolbar-alert ck-toolbar-alert-success";
            alert.innerHTML = '<i class="icon-success"></i> Tree structure saved successfully';

            const controlsContainer = this._elements.jqControlsContainer;
            if (controlsContainer.length) {
                controlsContainer.after(alert);
                setTimeout(() => {
                    alert.style.opacity = "0";
                    setTimeout(() => alert.remove(), 300);
                }, 3000);
            }
        } catch (error) {
            // Show error message
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            const alert = document.createElement("div");
            alert.className = "ck-toolbar-alert ck-toolbar-alert-error";
            alert.innerHTML = `<i class="icon-error"></i> Failed to save tree structure: ${errorMessage}`;

            const controlsContainer = this._elements.jqControlsContainer;
            if (controlsContainer.length) {
                controlsContainer.after(alert);
                setTimeout(() => {
                    alert.style.opacity = "0";
                    setTimeout(() => alert.remove(), 300);
                }, 5000);
            }
        } finally {
            // Restore button state
            saveButton.html(originalSaveButtonText).prop("disabled", false);
            cancelButton.prop("disabled", false);
        }
    }

    private _handleCancelClick(): void {
        const confirmMessage = "You have unsaved changes. Are you sure you want to cancel?";
        if (!window.confirm(confirmMessage)) {
            return;
        }

        // Revert any changes by restoring the original tree structure
        this._reloadTreeStructure();

        // Mark as clean and hide buttons
        this._markClean();
    }

    private _reloadTreeStructure(): void {
        // Use the cached tree structure to restore the original state
        try {
            if (this._treeStructure) {
                this._deserializeTree(this._treeStructure);
                // Successfully restored tree structure from cache
            } else {
                // No cached tree structure found to restore
                console.warn("No cached tree structure found to restore");
            }
        } catch (error) {
            // Error restoring tree structure
            console.error("Error restoring tree structure");
        }
    }

    private _disableTreeModification() {
        const jQuery = window.jQuery;
        // Disable drag and drop
        jQuery(this._container)
            .find(".annotation-tree-node")
            .each((_: number, node: Element) => {
                jQuery(node).attr("draggable", "false");
            });

        // Hide add layer buttons
        jQuery(this._container).find(".add-layer-btn").addClass("hidden");

        // Hide 3 dot menu for layers (except default layer), but not for annotations
        jQuery(this._container)
            .find(
                ".layer-node:not([data-id='default-layer']) > .node-content > .node-actions > .annotation-dropdown-toggle"
            )
            .addClass("hidden");

        // Disable menu items that modify the tree
        jQuery(this._container)
            .find(".menu-item")
            .each((_: number, item: Element) => {
                const action = jQuery(item).attr("data-action");
                if (action === "rename" || action === "delete-layer" || action === "edit" || action === "delete") {
                    jQuery(item).hide();
                }
            });
    }

    private _enableTreeModification() {
        const jQuery = window.jQuery;
        if (!this._hasSavePermission) {
            this._disableTreeModification();
            return;
        }

        // Enable drag and drop
        jQuery(this._container)
            .find(".annotation-tree-node")
            .each((_: number, node: Element) => {
                jQuery(node).attr("draggable", "true");
            });

        // Show add layer button only for default layer
        jQuery(this._container).find(".add-layer-btn").addClass("hidden");
        jQuery(this._container).find('[data-id="default-layer"] .add-layer-btn').removeClass("hidden");

        // Show 3 dot menu for all layers, but not affecting annotations
        jQuery(this._container)
            .find(".layer-node > .node-content > .node-actions > .annotation-dropdown-toggle")
            .removeClass("hidden");

        // Enable menu items that modify the tree
        jQuery(this._container)
            .find(".menu-item")
            .each((_: number, item: Element) => {
                const action = jQuery(item).attr("data-action");
                if (action === "rename" || action === "delete-layer" || action === "edit" || action === "delete") {
                    jQuery(item).show();
                }
            });
    }

    private _handleSearch(query: string) {
        const normalizedQuery = query.toLowerCase().trim();

        // Function to show/hide nodes based on search
        const filterNode = (node: HTMLElement) => {
            const title = node.querySelector(".node-title")?.textContent?.toLowerCase() || "";
            const isLayer = node.classList.contains("layer-node");
            const matches = title.includes(normalizedQuery);

            if (isLayer) {
                // For layers, also check children
                const childrenContainer = node.querySelector(".node-children");
                const children = childrenContainer?.querySelectorAll(".annotation-tree-node") || [];
                let hasMatchingChild = false;

                children.forEach((child) => {
                    const childMatches = filterNode(child as HTMLElement);
                    hasMatchingChild = hasMatchingChild || childMatches;
                });

                // Show layer if it matches or has matching children
                const shouldShow = matches || hasMatchingChild;
                node.style.display = shouldShow ? "" : "none";

                // If showing layer due to matching children, expand it
                if (shouldShow && hasMatchingChild) {
                    const layerChildrenContainer = node.querySelector(".node-children");
                    const collapseToggle = node.querySelector(".collapse-toggle");
                    if (layerChildrenContainer && collapseToggle) {
                        layerChildrenContainer.classList.remove("collapsed");
                        collapseToggle.classList.remove("collapsed");
                        collapseToggle.textContent = "▼";
                    }
                }

                return shouldShow;
            }

            // For regular annotations, just check the title
            const shouldShow = matches;
            node.style.display = shouldShow ? "" : "none";
            return shouldShow;
        };

        // Start filtering from the root
        this._container.querySelectorAll(".annotation-tree-node").forEach((node) => {
            if (node.parentElement === this._container || node.parentElement?.parentElement === this._container) {
                filterNode(node as HTMLElement);
            }
        });
    }

    public async saveTree(): Promise<void> {
        const treeStructure = this._serializeTree();
        this._treeStructure = treeStructure;

        // Save to backend using FormData
        const formData = new FormData();
        formData.append("action", "save_annotation_tree");
        formData.append("project_id", this._CONSTRUKTED_AJAX.post_id);
        formData.append("tree_data", JSON.stringify(treeStructure));
        const response = await window.jQuery.ajax({
            url: this._CONSTRUKTED_AJAX.ajaxurl,
            type: "POST",
            data: formData,
            processData: false,
            contentType: false
        });
        if (!response.success) {
            throw new Error(response.data || "Failed to save tree structure");
        }
    }

    private _serializeTree(): any {
        const serializeNode = (node: HTMLElement): any => {
            const id = node.dataset.id;
            const nodeType = node.dataset.nodeType;
            const title = node.querySelector(".node-title")?.textContent || "";
            const isVisible = (node.querySelector(".visibility-toggle") as HTMLInputElement)?.checked || false;
            // Get the exact icon class name
            const icon = node.querySelector(".node-info i:not(.collapse-toggle)")?.className || "";

            const childrenContainer = node.querySelector(".node-children");
            const children = Array.from(childrenContainer?.children || [])
                .filter((child) => child.classList.contains("annotation-tree-node"))
                .map((child) => serializeNode(child as HTMLElement));

            return {
                id: id,
                type: nodeType,
                title: title,
                isVisible: isVisible,
                icon: icon,
                children: children
            };
        };

        const layers = Array.from(this._container.children)
            .filter(
                (child) =>
                    child instanceof HTMLElement &&
                    child.classList.contains("annotation-tree-node") &&
                    child.classList.contains("layer-node")
            )
            .map((layer) => serializeNode(layer as HTMLElement));

        return {
            layers: layers,
            version: "1.0"
        };
    }

    async _loadTree(): Promise<void> {
        try {
            const response = await window.jQuery.ajax({
                url: this._CONSTRUKTED_AJAX.ajaxurl,
                type: "POST",
                data: {
                    action: "get_annotation_tree",
                    project_id: this._CONSTRUKTED_AJAX.post_id
                }
            });

            if (!response || typeof response !== "object") {
                // Invalid response format from server
                console.error("Invalid response format from server");

                // If response format is invalid, assume user has save permission for current structure
                this._hasSavePermission = true;
                this._enableTreeModification();
                this._updateControlsVisibility();
                return;
            }

            if (response.success && response.data) {
                // Update save permission based on server response
                this._hasSavePermission = response.data.can_save === true;
                if (!this._hasSavePermission) {
                    this._disableTreeModification();
                }
                // Update controls visibility based on permissions
                this._updateControlsVisibility();
                // Reinitialize navigation warning based on new permission status
                this._initNavigationWarning();

                const treeData = response.data.tree_data;
                // Validate the structure
                if (!treeData.layers || !Array.isArray(treeData.layers)) {
                    this._hasSavePermission = true;
                    this._enableTreeModification();
                    this._updateControlsVisibility();
                    // Invalid tree structure: missing or invalid layers array
                    return;
                }

                // Save tree structure before deserializing
                this._treeStructure = JSON.parse(JSON.stringify(treeData));

                // Now deserialize the tree
                this._deserializeTree(treeData);

                // Mark as clean after loading
                this._markClean();
            } else {
                // If response is not successful, ensure we save the current structure
                this._treeStructure = this._serializeTree();

                // If response is not successful, assume user has save permission for current structure
                this._hasSavePermission = true;
                this._enableTreeModification();
                this._updateControlsVisibility();
            }
        } catch (error) {
            // Error loading tree structure
            console.error("Error loading tree structure", error);
            // If loading fails, save the current structure
            this._treeStructure = this._serializeTree();

            // If loading fails, assume user has save permission for current structure
            this._hasSavePermission = true;
            this._enableTreeModification();
            this._updateControlsVisibility();

            const alert = document.createElement("div");
            alert.className = "ck-toolbar-alert ck-toolbar-alert-error";
            alert.innerHTML = '<i class="icon-error"></i> Failed to load layer structure';

            const controlsContainer = this._elements.jqControlsContainer;
            if (controlsContainer.length) {
                controlsContainer.after(alert);
                setTimeout(() => {
                    alert.style.opacity = "0";
                    setTimeout(() => alert.remove(), 300);
                }, 3000);
            }
        }
    }

    private _deserializeTree(data: any): void {
        try {
            const jQuery = window.jQuery;
            // Clear existing tree structure except controls
            const jqControls = jQuery(this._container).find(".annotation-tree-controls");
            this._container.innerHTML = "";
            if (jqControls.length) {
                this._container.appendChild(jqControls[0]);
            }

            // Create default layer if it doesn't exist in the data
            if (!data.layers || !data.layers.some((layer: any) => layer.id === "default-layer")) {
                const defaultLayer = this._createDefaultLayer();
                this._defaultLayer = defaultLayer;
                this._defaultLayerChildren = jQuery(defaultLayer).find(".node-children")[0];
            }

            const createNodeFromData = (nodeData: any): HTMLElement => {
                // For annotations, preserve their specific icon, for layers use icon-layer
                const icon = nodeData.type === "layer" ? "icon-layer" : nodeData.icon || "icon-default";

                const Treedata: TreeNodeData = {
                    id: nodeData.id,
                    title: nodeData.title,
                    icon: icon,
                    isVisible: nodeData.isVisible,
                    isLayer: nodeData.type === "layer",
                    children: [],
                    data: {
                        postId: nodeData.postId || -1,
                        entityType: nodeData.type,
                        asset: nodeData.asset || "",
                        type: nodeData.type
                    }
                };

                const node = this.createNode(Treedata);

                // Recursively create children
                if (nodeData.children && nodeData.children.length > 0) {
                    const childrenContainer = node.querySelector(".node-children");
                    nodeData.children.forEach((childData: any) => {
                        const childNode = createNodeFromData(childData);
                        childrenContainer?.appendChild(childNode);
                    });
                }

                return node;
            };

            // Create and add all layers and their children
            if (data.layers && Array.isArray(data.layers)) {
                data.layers.forEach((layerData: any) => {
                    const layerNode = createNodeFromData(layerData);
                    this._container.appendChild(layerNode);
                });
            }

            // Enable modifications
            this._enableTreeModification();
        } catch (error) {
            // Error deserializing tree
            console.error("Error deserializing tree", error);
            this._initializeDefaultTreeStructure();
        }
    }

    private _createControls(): void {
        const jQuery = window.jQuery;

        // Check if we're in asset view by looking at the URL
        const isAssetView = window.location.pathname.includes("/asset/");

        // Only show buttons container if not in asset view
        const buttonsHtml = isAssetView
            ? ""
            : `
            <div class="make-flex make-flex-row make-gap-4 make-align-center make-justify-end">
                <button class="save-layer-btn make-btn make-btn-primary make-btn-sm hidden" title="Save Annotation list changes">
                    <i class="icon-save"></i>
                </button>
                <button class="cancel-layer-btn make-btn make-btn-close make-btn-sm hidden" title="Do not save changes">
                    <i class="icon-cancel"></i>
                </button>
            </div>`;

        const baseControlsHtml = `
            <div class="make-flex" style="justify-content:space-between;">
                <h3 class="popup-title" style="margin-bottom: 0px;">
                    <i class="gwicon-annotations title-icon"></i>
                    Annotations
                </h3>
                ${buttonsHtml}
            </div>`;

        // Add the info message only if in Asset View mode
        const infoMessage = isAssetView
            ? `
            <div id="construkted-annontations-popup-info">
                Annotations in Asset View Mode are not saved. <br> If you want persistent annotations, create a <a href="${this._CONSTRUKTED_AJAX.ajaxurl}?action=ck_create_quick_project_action">New project</a>.
            </div>`
            : "";

        const searchInput = `
            <div class="make-flex make-flex-row make-gap-4 make-align-center">
                <div class="make-flex-1 make-relative">
                    <input type="text" class="annotation-search-input make-input make-input-sm" placeholder="Search annotations...">
                </div>
            </div>`;

        const jqControlsContainer = jQuery("<div>")
            .addClass("annotation-tree-controls make-flex make-flex-column make-gap-4 make-mb-4")
            .html(baseControlsHtml + infoMessage + searchInput);

        this._container.appendChild(jqControlsContainer[0]);

        // Only set up save/cancel button handlers if not in asset view
        if (!isAssetView) {
            const jqSaveButton = jqControlsContainer.find(".save-layer-btn");
            const jqCancelButton = jqControlsContainer.find(".cancel-layer-btn");

            jqSaveButton.on("click", async () => {
                try {
                    await this._handleSaveClick();
                } catch (error) {
                    console.error("Save operation failed:", error);
                }
            });

            jqCancelButton.on("click", () => {
                this._handleCancelClick();
            });
        }

        // Search input is always needed
        const jqSearchInput = jqControlsContainer.find(".annotation-search-input");
        jqSearchInput.on("input", (e: JQuery.TriggeredEvent) => this._handleSearch(jQuery(e.target).val() as string));
    }

    private _initNavigationWarning() {
        const confirmationMessage = "You have unsaved changes. Are you sure you want to leave?";
        const self = this;

        // Skip navigation warnings if in asset view or no save permission
        const isAssetView = window.location.pathname.includes("/asset/");
        if (isAssetView || !this._hasSavePermission) {
            return;
        }

        // Handle page refresh/close
        window.addEventListener("beforeunload", (e) => {
            if (self._isDirty) {
                e.preventDefault();
                e.returnValue = confirmationMessage;
                return confirmationMessage;
            }
            return undefined;
        });
    }

    private _initializeDefaultTreeStructure(): void {
        // Create a default tree structure with just the default layer
        const defaultStructure = {
            layers: [
                {
                    id: "default-layer",
                    type: "layer",
                    title: "Annotation List",
                    isVisible: true,
                    children: []
                }
            ],
            version: "1.0"
        };

        // Store as the initial tree structure
        this._treeStructure = defaultStructure;
    }

    public hasUnsavedChanges(): boolean {
        return this._isDirty;
    }

    public confirmDiscardChanges(): boolean {
        const isAssetView = window.location.pathname.includes("/asset/");

        // Skip confirmation in asset view mode
        if (isAssetView) {
            return true;
        }

        if (!this._isDirty) {
            return true;
        }

        const confirmed = window.confirm("You have unsaved changes. Are you sure you want to leave?");
        if (confirmed) {
            this._reloadTreeStructure();
            this._markClean();
        }
        return confirmed;
    }

    /**
     * Removes a node from the tree view and cleans up internal state
     * @param nodeId The ID of the node to remove
     * @returns true if the node was found and removed, false otherwise
     */
    public removeNode(nodeId: string): boolean {
        const node = this._nodes.get(nodeId);
        if (!node) {
            // Attempted to remove non-existent node
            console.error("Attempted to remove non-existent node");
            return false;
        }
        if (!node.parentElement) {
            // Node is already removed from DOM
            console.warn("Node is already removed from DOM");
            this._nodes.delete(nodeId);
            return true;
        }
        node.remove();
        this._nodes.delete(nodeId);
        this._markDirty();
        if (!this.validateTreeState()) {
            // Tree view state inconsistent after node removal, attempting repair...
            this.repairTreeState();
        }
        // Successfully removed node
        return true;
    }

    /**
     * Validates the tree view state and ensures consistency between DOM and internal state
     * @returns true if the tree view is in a consistent state, false otherwise
     */
    public validateTreeState(): boolean {
        const issues: string[] = [];
        const domNodes = new Set<HTMLElement>();
        const mapNodes = new Set<string>();

        // Check all DOM nodes
        this._container.querySelectorAll(".annotation-tree-node").forEach((node) => {
            const nodeId = (node as HTMLElement).dataset.id;
            if (nodeId) {
                domNodes.add(node as HTMLElement);
                if (!this._nodes.has(nodeId)) {
                    issues.push(`DOM node ${nodeId} not in _nodes map`);
                }
            }
        });

        // Check all map nodes
        this._nodes.forEach((node, nodeId) => {
            mapNodes.add(nodeId);
            if (!node.parentElement) {
                issues.push(`Map node ${nodeId} not in DOM`);
            }
        });

        if (issues.length > 0) {
            // Tree view state validation failed
            return false;
        }
        // Tree view state validation passed
        return true;
    }

    /**
     * Attempts to repair the tree view state by cleaning up inconsistencies
     */
    public repairTreeState(): void {
        // Attempting to repair tree view state...

        // Remove orphaned nodes from _nodes map
        this._nodes.forEach((node, nodeId) => {
            if (!node.parentElement) {
                this._nodes.delete(nodeId);
                // Removing orphaned node from _nodes map
            }
        });

        // Rebuild _nodes map from DOM
        this._nodes.clear();
        this._container.querySelectorAll(".annotation-tree-node").forEach((node) => {
            const nodeId = (node as HTMLElement).dataset.id;
            if (nodeId) {
                this._nodes.set(nodeId, node as HTMLElement);
            }
        });

        // Tree view state repair completed
    }
}

export { AnnotationTreeView };
export type { TreeNodeData };
