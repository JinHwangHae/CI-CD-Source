import * as JQuery from "jquery";
import { ParsedConstruktedAjax, AssetInfo } from "./types/common";
import AssetManager from "./AssetManager";

interface AssetTreeNodeData {
    id: string;
    title: string;
    icon: string;
    isVisible: boolean;
    children: AssetTreeNodeData[];
    isLayer?: boolean;
    data: {
        postId: string;
        image: string;
        date_capture?: string;
    };
}

enum AssetCompareMode {
    MultiSelect = "multiselect",
    Slider = "slider",
    Twin = "twin",
    Compare = "compare"
}

class AssetManagerTreeView {
    private _container: HTMLElement;
    private _draggedElement: HTMLElement | null = null;
    private _nodeTemplate: HTMLTemplateElement = document.createElement("template");
    private _nodes: Map<string, HTMLElement> = new Map();
    private _defaultLayer: HTMLElement | null = null;
    private _defaultLayerChildren: HTMLElement | null = null;
    private _assetCompareMode: AssetCompareMode = AssetCompareMode.MultiSelect;
    private _CONSTRUKTED_AJAX: ParsedConstruktedAjax;
    private _hasSavePermission: boolean = false;
    private _treeBuffer: any = null; // Buffer to store the last saved tree structure

    constructor(containerId: string) {
        const jQuery = window.jQuery;
        this._CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;
        this._hasSavePermission = false;
        const jqContainer = jQuery(containerId);

        if (!jqContainer.length) {
            throw new Error(`Container not found. ID/Selector: "${containerId}"`);
        }

        this._container = jqContainer[0];
        this._initializeAsync();
    }

    private async _initializeAsync(): Promise<void> {
        await this._checkPermission();
        this._initNodeTemplate();
        this._createControls(this._hasSavePermission);
        if (this._hasSavePermission) {
            this._initDragAndDrop();
        }
        const defaultLayer = this._createDefaultLayer();
        this._defaultLayer = defaultLayer;
        this._defaultLayerChildren = jQuery(defaultLayer).find(".node-children")[0];
        jQuery(".right-asset-list-activator").hide();
        this._loadAssets();
        try {
            await this._loadTree();
        } catch (error) {
            console.error("Failed to load tree structure:", error);
        }
        const assetManager = new AssetManager();
        assetManager.init();
    }

    private async _checkPermission(): Promise<void> {
        try {
            const response = await window.jQuery.ajax({
                url: window.CONSTRUKTED_AJAX.ajaxurl,
                type: "POST",
                data: {
                    action: "project_save_permission",
                    project_id: this._CONSTRUKTED_AJAX.post_id
                }
            });

            this._hasSavePermission = response.success && response.data.can_save === true;
        } catch (error) {
            console.error("Error checking save permission:", error);
            this._hasSavePermission = false;
        }
    }

    private _initNodeTemplate() {
        const template = document.createElement("template");
        template.innerHTML = `
            <div class="annotation-tree-node" draggable="true">
                <div class="node-content">
                    <div class="node-controls make-flex make-flex-row make-gap-4">
                        <input type="checkbox" class="visibility-toggle" checked>
                    </div>
                    <div class="node-info">
                        <i class="collapse-toggle" title="Collapse/Expand">▼</i>
                        <i></i>
                        <div class="asset-preview make-flex make-w-full make-flex-row make-align-center make-gap-8">
                            <div class="asset-info make-flex-1">
                                <span class="node-title make-block make-font-medium"></span>
                                <span class="asset-date make-block make-text-gray-500">Captured: </span>
                            </div>
                        </div>
                    </div>
                    <div class="node-actions">
                        <div class="layer-buttons"></div>
                        <button class="annotation-dropdown-toggle">⋮</button>
                        <div class="annotation-dropdown-menu hidden make-absolute make-flex make-flex-column make-gap-8"></div>
                    </div>
                </div>
                <div class="node-children"></div>
            </div>
        `;
        this._nodeTemplate = template;
    }

    private _createDefaultLayer() {
        const defaultLayer: AssetTreeNodeData = {
            id: "default-layer",
            title: "Asset List",
            icon: "icon-layer",
            isVisible: true,
            isLayer: true,
            children: [],
            data: {
                postId: "-1",
                image: ""
            }
        };
        const layerNode = this.createNode(defaultLayer);
        this._container.appendChild(layerNode);
        return layerNode;
    }

    private _showSaveButtons() {
        const jQuery = window.jQuery;
        const saveButton = jQuery(this._container).find(".save-layer-btn");
        const cancelButton = jQuery(this._container).find(".cancel-layer-btn");

        saveButton.removeClass("hidden");
        cancelButton.removeClass("hidden");
    }

    private _hideSaveButtons() {
        const jQuery = window.jQuery;
        const saveButton = jQuery(this._container).find(".save-layer-btn");
        const cancelButton = jQuery(this._container).find(".cancel-layer-btn");

        saveButton.addClass("hidden");
        cancelButton.addClass("hidden");
    }

    private _createControls(hasSavePermission: boolean): void {
        const jQuery = window.jQuery;
        const jqControlsContainer = jQuery("<div>").addClass(
            "annotation-tree-controls make-flex make-flex-column make-gap-4"
        ).html(`
            <div class="main-controls">
                <div class="make-flex" style="justify-content:space-between;">
                    <h3 class="popup-title" style="margin-bottom: 0px;">
                        <i class="gwicon-layers title-icon"></i>
                        Asset Manager
                    </h3>
                    <div class="make-flex make-flex-row make-gap-4 make-align-center make-justify-end">
                        <button class="save-layer-btn make-btn make-btn-primary make-btn-sm hidden" title="Save Asset List changes">
                            <i class="icon-save"></i>
                        </button>
                        <button class="cancel-layer-btn make-btn make-btn-close make-btn-sm hidden" title="Do not save changes">
                            <i class="icon-cancel"></i>
                        </button>
                        <button id="update-assets" class="make-btn make-btn-primary make-btn-sm hidden" title="Save asset changes">
                            <i class="icon-save"></i>
                        </button>
                        <button id="close-asset-edit" class="make-btn make-btn-close make-btn-sm hidden" title="Cancel asset changes">
                            <i class="icon-cancel"></i>
                        </button>
                        ${
                            hasSavePermission
                                ? `
                            <button id="add-project-asset" class="add-remove-asset-btn make-btn make-btn-sm make-btn-outline" title="Add/Remove Asset">
                                <i class="icon-plus"></i>
                            </button>
                        `
                                : ""
                        }
                    </div>
                </div>
                <div class="make-flex make-w-full make-mt-4 make-mb-4">
                    <div class="make-flex-1 make-w-full">
                        <input type="text" class="asset-search-input make-input make-input-sm make-w-full" style="margin-top:16px; margin-bottom: 4px; " placeholder="Search assets...">
                    </div>
                </div>
                <div class="make-flex make-w-full make-mt-4">
                    <div class="make-flex-1">
                        <select id="compare-assets-option" class="make-select make-select-sm make-w-full">
                            <option value="multiselect">Multi Select</option>
                            <option value="slider">Slider</option>
                            <option value="twin">Twin View</option>
                            <option value="compare">Compare View</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="comparison-controls">
                <div id="compare-assets-spans-container" class="make-flex make-w-full make-gap-4 make-mt-2 make-mb-4">
                </div>
                <div id="compare-project-assets-slider" class="make-flex make-w-full hidden make-mt-2">
                    <input type="range" class="make-w-full" min="0" max="1" value="1">
                </div>
            </div>
        `);

        this._container.appendChild(jqControlsContainer[0]);

        const jqSaveButton = jqControlsContainer.find(".save-layer-btn");
        const jqCancelButton = jqControlsContainer.find(".cancel-layer-btn");
        const jqSearchInput = jqControlsContainer.find(".asset-search-input");
        const jqCompareAssetsOption = jqControlsContainer.find("#compare-assets-option");
        const jqCompareAssetsSpansContainer = jqControlsContainer.find("#compare-assets-spans-container");

        jqSaveButton.on("click", () => {
            this._handleSaveClick();
        });

        jqCancelButton.on("click", () => {
            this._handleCancelClick();
        });

        jqSearchInput.on("input", (e: JQuery.TriggeredEvent) => this._handleSearch(jQuery(e.target).val() as string));
        jqCompareAssetsSpansContainer.hide();
        jqCompareAssetsOption.on("change", (e: JQuery.TriggeredEvent) => {
            const value = jQuery(e.target).val() as string;
            this._handleCompareMode(value);
        });

        jQuery(document).on("click", ".left-asset-list-activator", (e: JQuery.ClickEvent) => {
            this._onClickedLeftAssetCheckBox(e.target as HTMLInputElement);
        });

        jQuery(document).on("click", ".right-asset-list-activator", (e: JQuery.ClickEvent) => {
            this._onClickedRightAssetCheckBox(e.target as HTMLInputElement);
        });
    }

    private _createAssetNode(assetInfo: AssetInfo, container: HTMLElement) {
        const nodeData: AssetTreeNodeData = {
            id: assetInfo.post_id,
            title: assetInfo.post_title,
            icon: "icon-asset",
            isVisible: true,
            children: [],
            data: {
                postId: assetInfo.post_id,
                image: assetInfo.image,
                date_capture: assetInfo.date_capture
            }
        };

        const node = this.createNode(nodeData);
        container.appendChild(node);
        return node;
    }

    public createNode(data: AssetTreeNodeData): HTMLElement {
        const node = this._nodeTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;

        node.dataset.id = data.id;
        node.dataset.nodeType = data.isLayer ? "layer" : "asset";

        if (data.isLayer) {
            node.classList.add("layer-node");
            if (data.id === "default-layer" && this._hasSavePermission) {
                const layerButtons = node.querySelector(".layer-buttons");
                if (layerButtons) {
                    layerButtons.innerHTML = '<button class="add-layer-btn" title="Add New Folder">+</button>';
                }
            }
            const collapseToggle = node.querySelector(".collapse-toggle");
            if (collapseToggle) {
                collapseToggle.classList.remove("hidden");
            }
            const assetPreview = node.querySelector(".asset-preview");
            if (assetPreview) {
                assetPreview.remove();
            }
            const nodeInfo = node.querySelector(".node-info");
            if (nodeInfo) {
                const titleSpan = document.createElement("span");
                titleSpan.className = "node-title make-block make-font-medium";
                titleSpan.textContent = data.title;
                nodeInfo.appendChild(titleSpan);
            }

            if (!this._hasSavePermission) {
                const dropdownToggle = node.querySelector(".annotation-dropdown-toggle");
                const dropdownMenu = node.querySelector(".annotation-dropdown-menu");
                if (dropdownToggle) dropdownToggle.remove();
                if (dropdownMenu) dropdownMenu.remove();
            } else {
                const dropdownMenu = node.querySelector(".annotation-dropdown-menu");
                if (dropdownMenu) {
                    dropdownMenu.innerHTML =
                        data.id !== "default-layer"
                            ? `<button class="menu-item" data-action="rename"><i class="icon-edit"></i> Rename</button>
                           <button class="menu-item" data-action="delete-layer"><i class="icon-delete"></i> Delete Folder</button>`
                            : `<button class="menu-item" data-action="rename"><i class="icon-edit"></i> Rename</button>`;
                }
            }
        } else {
            const collapseToggle = node.querySelector(".collapse-toggle");
            if (collapseToggle) {
                collapseToggle.classList.add("hidden");
            }

            const nodeControls = node.querySelector(".node-controls");
            if (nodeControls) {
                nodeControls.innerHTML = `
                    <input class="left-asset-list-activator" type="checkbox" checked data-post-id="${data.id}" />
                    <input class="right-asset-list-activator" type="checkbox" checked data-post-id="${data.id}" style="display: none;" />
                `;
            }

            const titleElement = node.querySelector(".node-title");
            if (titleElement) {
                titleElement.textContent = data.title;
            }

            const dateElement = node.querySelector(".asset-date");
            if (dateElement) {
                dateElement.textContent = data.data.date_capture ? `Captured: ${data.data.date_capture}` : "";
            }

            const dropdownMenu = node.querySelector(".annotation-dropdown-menu");
            if (dropdownMenu) {
                dropdownMenu.innerHTML = this._hasSavePermission
                    ? `<button class="menu-item" data-action="view"><i class="icon-views"></i> Zoom to</button>
                       <button class="menu-item" data-action="delete"><i class="icon-delete"></i> Remove</button>`
                    : `<button class="menu-item" data-action="view"><i class="icon-views"></i> Zoom to</button>`;
            }
        }

        this._addNodeEventListeners(node, data);
        this._nodes.set(data.id, node);
        return node;
    }

    private _addNodeEventListeners(node: HTMLElement, data: AssetTreeNodeData): void {
        const jQuery = window.jQuery;

        jQuery(node)
            .find(".visibility-toggle")
            .on("change", (e: JQuery.ChangeEvent) => {
                const isVisible = (e.target as HTMLInputElement).checked;
                if (data.isLayer) {
                    // Update all children visibility when layer visibility changes
                    this._updateChildrenVisibility(node, isVisible);
                } else {
                    this._handleVisibilityToggle(data.id);
                }
            });

        jQuery(node)
            .find(".add-layer-btn")
            .on("click", (e: JQuery.ClickEvent) => {
                e.stopPropagation();
                this._createNewLayer(node);
            });

        jQuery(node)
            .find(".collapse-toggle")
            .on("click", (e: JQuery.ClickEvent) => {
                e.stopPropagation();
                const childrenContainer = node.querySelector(".node-children");
                if (childrenContainer) {
                    childrenContainer.classList.toggle("collapsed");
                    (e.target as HTMLElement).classList.toggle("collapsed");
                }
            });

        jQuery(node)
            .find(".annotation-dropdown-toggle")
            .on("click", (e: JQuery.ClickEvent) => {
                e.stopPropagation();
                jQuery(".annotation-dropdown-menu")
                    .not(jQuery(e.target).siblings(".annotation-dropdown-menu"))
                    .addClass("hidden");
                jQuery(e.target).siblings(".annotation-dropdown-menu").toggleClass("hidden");
            });

        jQuery(document).on("click", (e: JQuery.ClickEvent) => {
            if (!jQuery(e.target).closest(".annotation-dropdown-toggle").length) {
                jQuery(".annotation-dropdown-menu").addClass("hidden");
            }
        });

        jQuery(node)
            .find(".menu-item")
            .on("click", (e: JQuery.ClickEvent) => {
                e.stopPropagation();
                const action = jQuery(e.target).closest(".menu-item").data("action");
                this._handleMenuAction(data.id, action);
                jQuery(e.target).closest(".annotation-dropdown-menu").addClass("hidden");
            });
    }

    private _updateChildrenVisibility(parentNode: HTMLElement, isVisible: boolean) {
        const construkted = window.Construkted;

        const childrenContainer = parentNode.querySelector(".node-children");
        if (!childrenContainer) return;

        const assetNodes = childrenContainer.querySelectorAll(":scope > .annotation-tree-node:not(.layer-node)");
        assetNodes.forEach((assetNode) => {
            const leftCheckbox = assetNode.querySelector(".left-asset-list-activator") as HTMLInputElement;
            const rightCheckbox = assetNode.querySelector(".right-asset-list-activator") as HTMLInputElement;

            if (!leftCheckbox || !rightCheckbox) return;

            // Update checkbox states to match parent visibility
            leftCheckbox.checked = isVisible;
            rightCheckbox.checked = isVisible;

            // Get the asset and update its visibility directly
            const postId = leftCheckbox.getAttribute("data-post-id");
            if (postId) {
                const asset = construkted.getAsset(postId);
                if (asset) {
                    // Special handling for compare view and twin view modes
                    if (
                        this._assetCompareMode === AssetCompareMode.Compare ||
                        this._assetCompareMode === AssetCompareMode.Twin
                    ) {
                        // In compare/twin modes, we need to handle both left and right panels
                        if (isVisible) {
                            if (this._assetCompareMode === AssetCompareMode.Compare) {
                                // Compare mode: set split directions for both panels
                                asset.setSplitDirection?.(true, true);
                            } else {
                                // Twin mode: ensure asset is visible in both panels
                                // In twin mode, main asset controls left panel, twin asset controls right panel
                                // First ensure the main asset is visible for left panel
                                if (asset.isTileset() && !(asset as any).tileset?.show) {
                                    asset.toggle();
                                }
                                // Don't use setSplitDirection in twin mode - let the twin viewer handle it

                                // Get the twin asset and ensure it's visible for right panel
                                const twinAsset = construkted.projectViewer?.twinViewerAsswetGroup?.getAsset(postId);
                                if (twinAsset) {
                                    if (twinAsset.isTileset() && !(twinAsset as any).tileset?.show) {
                                        twinAsset.toggle();
                                    }
                                }
                            }
                        } else if (this._assetCompareMode === AssetCompareMode.Compare) {
                            // Hide asset from both panels in compare mode
                            asset.setSplitDirection?.(false, false);
                        } else {
                            // Hide asset from both panels in twin mode
                            // In twin mode, hide the main asset from left panel
                            if (asset.isTileset() && (asset as any).tileset?.show) {
                                asset.toggle();
                            }
                            // Don't use setSplitDirection in twin mode

                            // Hide the twin asset from right panel
                            const twinAsset = construkted.projectViewer?.twinViewerAsswetGroup?.getAsset(postId);
                            if (twinAsset) {
                                if (twinAsset.isTileset() && (twinAsset as any).tileset?.show) {
                                    twinAsset.toggle();
                                }
                            }
                        }
                    } else {
                        // For non-compare modes, handle visibility normally
                        // Check current asset visibility state
                        const isCurrentlyVisible = asset.isTileset() ? (asset as any).tileset?.show : false;

                        // Only toggle if the current state doesn't match desired state
                        if (isCurrentlyVisible !== isVisible) {
                            asset.toggle();
                        }
                    }
                }
            }
        });

        const nestedLayers = childrenContainer.querySelectorAll(":scope > .layer-node");
        nestedLayers.forEach((nestedLayer) => {
            const visibilityToggle = nestedLayer.querySelector(".visibility-toggle") as HTMLInputElement;
            if (visibilityToggle) {
                visibilityToggle.checked = isVisible;
                this._updateChildrenVisibility(nestedLayer as HTMLElement, isVisible);
            }
        });
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

        this._container.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (!this._draggedElement) return;

            const target = e.target as HTMLElement;
            const node = target.closest(".annotation-tree-node") as HTMLElement;
            if (!node || node === this._draggedElement) return;

            const rect = node.getBoundingClientRect();
            const mouseY = e.clientY;
            const threshold = 5;
            const isLayer = node.dataset.nodeType === "layer";

            const position = AssetManagerTreeView._calculateDropPositionForNode(mouseY, rect, threshold, isLayer);
            this._updateDropIndicators(node, position);
        });

        this._container.addEventListener("drop", (e) => {
            e.preventDefault();
            if (!this._draggedElement) return;

            const target = e.target as HTMLElement;
            const node = target.closest(".annotation-tree-node") as HTMLElement;
            if (!node || node === this._draggedElement) return;

            const rect = node.getBoundingClientRect();
            const mouseY = e.clientY;
            const threshold = 5;
            const isLayer = node.dataset.nodeType === "layer";

            const position = AssetManagerTreeView._calculateDropPositionForNode(mouseY, rect, threshold, isLayer);
            this._performDrop(node, position);
        });
    }

    private static _calculateDropPositionForNode(
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

    private _updateDropIndicators(node: HTMLElement, position: "before" | "after" | "inside"): void {
        this._clearDropIndicators();
        node.classList.add(`drop-${position}`);
    }

    private _clearDropIndicators() {
        this._container.querySelectorAll(".drop-before, .drop-after, .drop-inside").forEach((el) => {
            el.classList.remove("drop-before", "drop-after", "drop-inside");
        });
    }

    private _performDrop(node: HTMLElement, position: "before" | "after" | "inside") {
        if (!this._draggedElement) return;

        if (position === "inside" && node.dataset.nodeType === "layer") {
            if (this._draggedElement.classList.contains("layer-node")) {
                const targetDepth = AssetManagerTreeView._calculateLayerDepth(node);
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
        this._showSaveButtons();
    }

    private _handleVisibilityToggle(assetId: string): void {
        const construkted = window.Construkted;
        const asset = construkted.getAsset(assetId);
        if (asset) {
            asset.toggle();
            this._showSaveButtons();
        }
    }

    private _handleMenuAction(assetId: string, action: string): void {
        const construkted = window.Construkted;

        switch (action) {
            case "view": {
                const asset = construkted.getAsset(assetId);
                if (asset) {
                    construkted.zoomToAsset(asset);
                }
                break;
            }
            case "delete": {
                if (window.confirm("Are you sure you want to remove this asset?")) {
                    this._deleteAsset(assetId).then((success) => {
                        if (success) {
                            // Hide the asset in the viewer if it's currently visible
                            const asset = construkted.getAsset(assetId);
                            if (asset && asset.isTileset() && (asset as any).tileset?.show) {
                                asset.toggle();
                            }
                        }
                    });
                }
                break;
            }
            case "rename": {
                this._startLayerRename(this._nodes.get(assetId)!);
                break;
            }
            case "delete-layer": {
                this._deleteLayer(this._nodes.get(assetId)!);
                break;
            }
            default:
                break;
        }
    }

    private _createNewLayer(parentNode: HTMLElement | null = null) {
        if (parentNode) {
            const parentDepth = AssetManagerTreeView._calculateLayerDepth(parentNode);
            if (parentDepth >= 2) {
                alert("Cannot create folders more than 3 levels deep");
                return;
            }
        }

        const newLayerId = `layer-${Date.now()}`;
        const layerData: AssetTreeNodeData = {
            id: newLayerId,
            title: "New Folder",
            icon: "icon-layer",
            isVisible: true,
            isLayer: true,
            children: [],
            data: {
                postId: "-1",
                image: "",
                date_capture: ""
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

        this._showSaveButtons();
    }

    private static _calculateLayerDepth(node: HTMLElement): number {
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

    private async _saveTree(): Promise<void> {
        const treeStructure = this._serializeTree();

        try {
            const formData = new FormData();
            formData.append("action", "save_asset_tree");
            formData.append("project_id", window.CONSTRUKTED_AJAX.post_id);
            formData.append("tree_data", JSON.stringify(treeStructure));

            const response = await window.jQuery.ajax({
                url: window.CONSTRUKTED_AJAX.ajaxurl,
                type: "POST",
                data: formData,
                processData: false,
                contentType: false
            });

            if (!response.success) {
                throw new Error(response.data || "Failed to save tree structure");
            }
        } catch (error) {
            console.error("Error saving tree structure:", error);
            throw error;
        }
    }

    private _serializeTree(): any {
        const serializeNode = (node: HTMLElement): any => {
            const id = node.dataset.id;
            const nodeType = node.dataset.nodeType;
            const title = node.querySelector(".node-title")?.textContent || "";
            const isVisible = (node.querySelector(".visibility-toggle") as HTMLInputElement)?.checked || false;
            const date = node.querySelector(".asset-date")?.textContent || "";
            const captureDate = date.replace("Captured: ", "");

            const childrenContainer = node.querySelector(".node-children");
            const children = Array.from(childrenContainer?.children || [])
                .filter((child) => child.classList.contains("annotation-tree-node"))
                .map((child) => serializeNode(child as HTMLElement));

            return {
                id: id,
                type: nodeType,
                title: title,
                isVisible: isVisible,
                date: captureDate,
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

    private async _handleSaveClick(): Promise<void> {
        const jQuery = window.jQuery;
        const saveButton = jQuery(this._container).find(".save-layer-btn");

        try {
            saveButton.html('<i class="icon-loading"></i>');
            saveButton.attr("disabled", "true");

            await this._saveTree();
            saveButton.html('<i class="icon-save"></i>');
            saveButton.attr("disabled", "false");
            // Update the buffer with the new tree structure after successful save
            const currentTree = this._serializeTree();
            this._treeBuffer = JSON.parse(JSON.stringify(currentTree));

            const alert = document.createElement("div");
            alert.className = "ck-toolbar-alert";
            alert.innerHTML = '<i class="icon-tick"></i> Asset structure saved successfully!';

            const controlsContainer = jQuery(this._container).find(".annotation-tree-controls");
            if (controlsContainer.length) {
                controlsContainer.after(alert);

                setTimeout(() => {
                    alert.style.opacity = "0";
                    setTimeout(() => alert.remove(), 300);
                }, 3000);
            }

            this._hideSaveButtons();
        } catch (error) {
            console.error("Failed to save tree structure:", error);
            const alert = document.createElement("div");
            alert.className = "ck-toolbar-alert ck-toolbar-alert-error";
            alert.innerHTML = '<i class="icon-error"></i> Failed to save asset structure';

            const controlsContainer = jQuery(this._container).find(".annotation-tree-controls");
            if (controlsContainer.length) {
                controlsContainer.after(alert);
                setTimeout(() => {
                    alert.style.opacity = "0";
                    setTimeout(() => alert.remove(), 300);
                }, 3000);
            }

            saveButton.html('<i class="icon-save"></i>');
            saveButton.removeAttr("disabled");
        }
    }

    private _handleCancelClick(): void {
        if (window.confirm("You have unsaved changes. Are you sure you want to cancel?")) {
            this._hideSaveButtons();
            if (this._treeBuffer) {
                // Revert to the last saved state using the buffer
                this._deserializeTree(this._treeBuffer);
            } else {
                // If there's no saved state, remove all custom layers and restore to initial state
                this._container.querySelectorAll(".layer-node").forEach((node) => {
                    if (node !== this._defaultLayer) {
                        node.remove();
                    }
                });

                // Ensure default layer is in initial state
                if (this._defaultLayer) {
                    const titleElement = this._defaultLayer.querySelector(".node-title");
                    if (titleElement) {
                        titleElement.textContent = "Asset List";
                    }
                }
            }
        }
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
                titleSpan.textContent = newTitle;
                this._showSaveButtons();
            } else {
                titleSpan.textContent = currentTitle;
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

    private _deleteLayer(layerNode: HTMLElement) {
        if (!this._defaultLayer || !this._defaultLayerChildren) return;
        if (layerNode.dataset.id === "default-layer") {
            alert("Cannot delete the default folder");
            return;
        }

        const childrenContainer = layerNode.querySelector(".node-children");
        if (childrenContainer) {
            while (childrenContainer.firstChild) {
                this._defaultLayerChildren.appendChild(childrenContainer.firstChild);
            }
        }

        layerNode.remove();
        this._showSaveButtons();
    }

    private async _deleteAsset(assetId: string): Promise<boolean> {
        try {
            const formData = new FormData();
            formData.append("action", "remove_project_asset");
            formData.append("project_id", window.CONSTRUKTED_AJAX.post_id);
            formData.append("asset_id", assetId);

            const response = await window.jQuery.ajax({
                url: window.CONSTRUKTED_AJAX.ajaxurl,
                type: "POST",
                data: formData,
                processData: false,
                contentType: false
            });

            if (!response.success) {
                throw new Error(response.data || "Failed to remove asset");
            }

            // Remove the node from the tree
            const node = this._nodes.get(assetId);
            if (node) {
                node.remove();
                this._nodes.delete(assetId);
            }

            // Show success message
            const alert = document.createElement("div");
            alert.className = "ck-toolbar-alert";
            alert.innerHTML = '<i class="icon-tick"></i> Asset deleted successfully!';

            const controlsContainer = jQuery(this._container).find(".annotation-tree-controls");
            if (controlsContainer.length) {
                controlsContainer.after(alert);
                setTimeout(() => {
                    alert.style.opacity = "0";
                    setTimeout(() => alert.remove(), 300);
                }, 3000);
            }

            return true;
        } catch (error) {
            console.error("Error deleting asset:", error);

            // Show error message
            const alert = document.createElement("div");
            alert.className = "ck-toolbar-alert ck-toolbar-alert-error";
            alert.innerHTML = '<i class="icon-error"></i> Failed to delete asset';

            const controlsContainer = jQuery(this._container).find(".annotation-tree-controls");
            if (controlsContainer.length) {
                controlsContainer.after(alert);
                setTimeout(() => {
                    alert.style.opacity = "0";
                    setTimeout(() => alert.remove(), 300);
                }, 3000);
            }

            return false;
        }
    }

    private _checkAllLayerGroupCheckboxes(): void {
        // Check all layer/group visibility checkboxes when switching modes
        const jQuery = window.jQuery;
        const visibilityToggles = jQuery(this._container).find(".visibility-toggle");
        visibilityToggles.prop("checked", true);

        // Update visibility for all layers to ensure assets are shown
        visibilityToggles.each((_: number, toggle: HTMLElement) => {
            const jqToggle = jQuery(toggle);
            const node = jqToggle.closest(".annotation-tree-node");
            if (node.length && node.hasClass("layer-node")) {
                // This is a layer node, update its children visibility
                this._updateChildrenVisibility(node[0], true);
            }
        });
    }

    private _initSliderMode(): void {
        const jQuery = window.jQuery;
        const construkted = window.Construkted;

        // Get all asset nodes
        const assetNodes = jQuery(this._container).find(".annotation-tree-node:not(.layer-node)");
        const totalAssets = assetNodes.length;

        if (totalAssets === 0) return;

        // Get the slider element
        const slider = jQuery("#compare-project-assets-slider input[type='range']");

        // Set slider properties
        slider.attr({
            min: "0",
            max: totalAssets.toString(),
            value: totalAssets.toString()
        });

        // Show all assets initially
        assetNodes.each((_: number, node: HTMLElement) => {
            const postId = node.dataset.id;
            if (postId) {
                const asset = construkted.getAsset(postId);
                if (asset && asset.isTileset() && !(asset as any).tileset?.show) {
                    asset.toggle();
                }
            }
        });

        // Add slider change event listener
        slider.off("input").on("input", (e: JQuery.TriggeredEvent) => {
            const value = parseInt((e.target as HTMLInputElement).value, 10);
            this._handleSliderChange(value);
        });
    }

    private _handleSliderChange(sliderValue: number): void {
        const jQuery = window.jQuery;
        const construkted = window.Construkted;

        // Get all asset nodes
        const assetNodes = jQuery(this._container).find(".annotation-tree-node:not(.layer-node)");

        // Hide all assets first
        assetNodes.each((_: number, node: HTMLElement) => {
            const postId = node.dataset.id;
            if (postId) {
                const asset = construkted.getAsset(postId);
                if (asset && asset.isTileset() && (asset as any).tileset?.show) {
                    asset.toggle();
                }
            }
        });

        // Show assets up to the slider value
        assetNodes.slice(0, sliderValue).each((_: number, node: HTMLElement) => {
            const postId = node.dataset.id;
            if (postId) {
                const asset = construkted.getAsset(postId);
                if (asset && asset.isTileset() && !(asset as any).tileset?.show) {
                    asset.toggle();
                }
            }
        });
    }

    private _handleSearch(query: string) {
        const normalizedQuery = query.toLowerCase().trim();

        const filterNode = (node: HTMLElement) => {
            const title = node.querySelector(".node-title")?.textContent?.toLowerCase() || "";
            const isLayer = node.classList.contains("layer-node");
            const matches = title.includes(normalizedQuery);

            if (isLayer) {
                const childrenContainer = node.querySelector(".node-children");
                const children = childrenContainer?.querySelectorAll(".annotation-tree-node") || [];
                let hasMatchingChild = false;

                children.forEach((child) => {
                    const childMatches = filterNode(child as HTMLElement);
                    hasMatchingChild = hasMatchingChild || childMatches;
                });

                const shouldShow = matches || hasMatchingChild;
                node.style.display = shouldShow ? "" : "none";

                if (shouldShow && hasMatchingChild) {
                    const layerChildrenContainer = node.querySelector(".node-children");
                    const collapseToggle = node.querySelector(".collapse-toggle");
                    if (layerChildrenContainer && collapseToggle) {
                        layerChildrenContainer.classList.remove("collapsed");
                        collapseToggle.classList.remove("collapsed");
                    }
                }

                return shouldShow;
            }

            const shouldShow = matches;
            node.style.display = shouldShow ? "" : "none";
            return shouldShow;
        };

        this._container.querySelectorAll(".annotation-tree-node").forEach((node) => {
            if (node.parentElement === this._container || node.parentElement?.parentElement === this._container) {
                filterNode(node as HTMLElement);
            }
        });
    }

    private _handleCompareMode(compareMode: string): void {
        const jQuery = window.jQuery;
        const jqCompareAssetsSpansContainer = jQuery("#compare-assets-spans-container");
        const jqSliderContainer = jQuery("#compare-project-assets-slider");

        jqCompareAssetsSpansContainer.hide();
        jqSliderContainer.hide();

        jQuery(".popup-title").show();
        jQuery(".asset-search-input").closest(".make-flex").show();

        if (compareMode === "slider") {
            this._assetCompareMode = AssetCompareMode.Slider;

            // Show the slider container and remove the hidden class
            jQuery("#compare-project-assets-slider").removeClass("hidden").show();
            jQuery(".left-asset-list-activator").hide();
            jQuery(".right-asset-list-activator").hide();
            jqCompareAssetsSpansContainer.hide();
            AssetManagerTreeView._leaveCompareOrTwinViewMode();
            // Check all layer/group checkboxes when switching to slider mode
            this._checkAllLayerGroupCheckboxes();
            // Initialize slider functionality
            this._initSliderMode();
        } else if (compareMode === "twin") {
            this._assetCompareMode = AssetCompareMode.Twin;
            jQuery(".left-asset-list-activator").show().prop("disabled", false);
            jQuery(".right-asset-list-activator").show().prop("disabled", false);
            jQuery("#compare-project-assets-slider").addClass("hidden").hide();
            jqCompareAssetsSpansContainer.show();
            // Check all layer/group checkboxes when switching to twin view mode
            this._checkAllLayerGroupCheckboxes();
            AssetManagerTreeView._enterTwinViewMode();
        } else if (compareMode === "compare") {
            this._assetCompareMode = AssetCompareMode.Compare;
            jQuery(".left-asset-list-activator").show().prop("disabled", false);
            jQuery(".right-asset-list-activator").show().prop("disabled", false);
            jQuery("#compare-project-assets-slider").addClass("hidden").hide();
            jqCompareAssetsSpansContainer.show();
            // Check all layer/group checkboxes when switching to compare view mode
            this._checkAllLayerGroupCheckboxes();
            AssetManagerTreeView._enterCompareViewMode();
        } else {
            this._assetCompareMode = AssetCompareMode.MultiSelect;
            jQuery(".left-asset-list-activator").show().prop("disabled", false);
            jQuery(".right-asset-list-activator").hide();
            jQuery("#compare-project-assets-slider").addClass("hidden").hide();
            jqCompareAssetsSpansContainer.show();
            AssetManagerTreeView._leaveCompareOrTwinViewMode();
            // Check all layer/group checkboxes when switching to multi select mode
            this._checkAllLayerGroupCheckboxes();
            AssetManagerTreeView._enterMultiSelectMode();
        }
    }

    public static _enterCompareViewMode(): void {
        const jQuery = window.jQuery;
        const construkted = window.Construkted;
        const leftCheckboxes = jQuery(".left-asset-list-activator");
        const rightCheckboxes = jQuery(".right-asset-list-activator");

        if (construkted.projectViewer?.isTwinViewMode?.()) {
            construkted.projectViewer.leaveTwinViewMode();
        }

        // Enter compare view mode FIRST
        construkted.projectViewer?.enterCompareViewMode?.();

        // Reset all assets and configure them for compare view mode
        // In compare view, assets should be visible in BOTH panels initially
        const allAssets = new Set<string>();

        // Collect all asset IDs
        leftCheckboxes.each((i: number, checkbox: HTMLInputElement) => {
            const jqCheckbox = jQuery(checkbox);
            const postId = jqCheckbox.attr("data-post-id");
            if (postId) allAssets.add(postId);
            jqCheckbox.prop("checked", true);
        });

        rightCheckboxes.each((i: number, checkbox: HTMLInputElement) => {
            const jqCheckbox = jQuery(checkbox);
            const postId = jqCheckbox.attr("data-post-id");
            if (postId) allAssets.add(postId);
            jqCheckbox.prop("checked", true);
        });

        // Configure each asset to be visible in BOTH panels
        allAssets.forEach((postId) => {
            const asset = construkted.getAsset(postId);
            if (asset) {
                // Remove any split direction settings first
                asset.setSplitDirection?.(false, false);
                // Ensure the asset is visible first
                if (asset.isTileset() && !(asset as any).tileset?.show) {
                    asset.toggle();
                }
                // Set split direction for BOTH panels (left AND right)
                asset.setSplitDirection?.(true, true);
            }
        });
    }

    public static _enterTwinViewMode(): void {
        const jQuery = window.jQuery;
        const construkted = window.Construkted;
        const projectViewer = construkted.projectViewer;

        if (projectViewer?.isCompareViewMode?.()) {
            projectViewer.leaveCompareViewMode();
        }

        // Enter twin view mode FIRST
        projectViewer?.enterTwinViewMode?.();

        // Reset all assets and ensure they're visible in twin view mode
        jQuery(".left-asset-list-activator, .right-asset-list-activator").each((_: number, checkbox: HTMLElement) => {
            const jqCheckbox = jQuery(checkbox);
            const postId = jqCheckbox.attr("data-post-id");
            const asset = construkted.getAsset(postId);

            if (asset) {
                // Remove any split direction settings first
                asset.setSplitDirection?.(false, false);
                // Ensure the main asset is visible
                if (asset.isTileset() && !(asset as any).tileset?.show) {
                    asset.toggle();
                }
            }
            jqCheckbox.prop("checked", true);
            return true;
        });

        // Also ensure twin assets are visible
        if (construkted.projectViewer?.twinViewerAsswetGroup) {
            jQuery(".right-asset-list-activator").each((_: number, checkbox: HTMLElement) => {
                const jqCheckbox = jQuery(checkbox);
                const postId = jqCheckbox.attr("data-post-id");
                const twinAsset = construkted.projectViewer?.twinViewerAsswetGroup?.getAsset(postId);
                if (twinAsset) {
                    // Ensure twin asset is visible
                    if (twinAsset.isTileset() && !(twinAsset as any).tileset?.show) {
                        twinAsset.toggle();
                    }
                }
                return true;
            });
        }
    }

    public static _enterMultiSelectMode(): void {
        const jQuery = window.jQuery;
        const construkted = window.Construkted;

        // Leave any active comparison modes first
        AssetManagerTreeView._leaveCompareOrTwinViewMode();

        // Enable left checkboxes for asset selection
        jQuery(".left-asset-list-activator").prop("disabled", false).show();
        // Hide right checkboxes as they're not used in multiselect mode
        jQuery(".right-asset-list-activator").prop("disabled", true).hide();

        // Reset all assets to normal mode and ensure they're visible
        jQuery(".left-asset-list-activator").each((_: number, checkbox: HTMLElement) => {
            const jqCheckbox = jQuery(checkbox);
            const postId = jqCheckbox.attr("data-post-id");
            const asset = construkted.getAsset(postId);
            if (asset) {
                // Remove any split direction settings
                asset.setSplitDirection?.(false, false);
                // Ensure asset is visible
                if (asset.isTileset() && !(asset as any).tileset?.show) {
                    asset.toggle();
                }
            }
            jqCheckbox.prop("checked", true);
            return true;
        });

        // Also handle any twin viewer assets that might still be visible
        if (construkted.projectViewer?.twinViewerAsswetGroup) {
            jQuery(".right-asset-list-activator").each((_: number, checkbox: HTMLElement) => {
                const jqCheckbox = jQuery(checkbox);
                const postId = jqCheckbox.attr("data-post-id");
                const twinAsset = construkted.projectViewer?.twinViewerAsswetGroup?.getAsset(postId);
                if (twinAsset) {
                    // Hide twin assets when switching to multi select mode
                    if (twinAsset.isTileset() && (twinAsset as any).tileset?.show) {
                        twinAsset.toggle();
                    }
                }
                return true;
            });
        }
    }

    public static _leaveCompareOrTwinViewMode(): void {
        const construkted = window.Construkted;
        const projectViewer = construkted.projectViewer;

        if (projectViewer?.isCompareViewMode?.()) {
            projectViewer.leaveCompareViewMode();
        }

        if (projectViewer?.isTwinViewMode?.()) {
            projectViewer.leaveTwinViewMode();
        }
    }

    private _onClickedLeftAssetCheckBox(leftCheckbox: HTMLInputElement): void {
        const jQuery = window.jQuery;
        const construkted = window.Construkted;
        const clickedPostId = jQuery(leftCheckbox).attr("data-post-id") as string;
        const asset = construkted.getAsset(clickedPostId);

        if (this._assetCompareMode === AssetCompareMode.Compare) {
            // compare view mode
            let rightChecked = false;

            const rightCheckboxes = jQuery(".right-asset-list-activator");

            for (let i = 0; i < rightCheckboxes.length; i++) {
                const checkbox = jQuery(rightCheckboxes[i]);
                const postId = checkbox.attr("data-post-id");

                if (clickedPostId === postId) {
                    rightChecked = checkbox.prop("checked");
                    break;
                }
            }

            asset!.setSplitDirection(leftCheckbox.checked, rightChecked);
        } else {
            asset!.toggle();
        }
    }

    private _onClickedRightAssetCheckBox(rightCheckbox: HTMLInputElement): void {
        const construkted = window.Construkted;
        const clickedPostId = jQuery(rightCheckbox).attr("data-post-id") as string;
        const asset = construkted.getAsset(clickedPostId);

        if (this._assetCompareMode === AssetCompareMode.Compare) {
            // compare view mode
            let leftChecked = false;

            const leftCheckboxes = jQuery(".left-asset-list-activator");

            for (let i = 0; i < leftCheckboxes.length; i++) {
                const checkbox = jQuery(leftCheckboxes[i]);
                const postId = checkbox.attr("data-post-id");

                if (clickedPostId === postId) {
                    leftChecked = checkbox.prop("checked");
                    break;
                }
            }

            asset!.setSplitDirection(leftChecked, rightCheckbox.checked);
        } else {
            // twin view mode
            const twinAsset = construkted.projectViewer.twinViewerAsswetGroup?.getAsset(clickedPostId);

            twinAsset!.toggle();
        }
    }

    private async _loadTree(): Promise<void> {
        try {
            const response = await window.jQuery.ajax({
                url: window.CONSTRUKTED_AJAX.ajaxurl,
                type: "POST",
                data: {
                    action: "get_asset_tree",
                    project_id: window.CONSTRUKTED_AJAX.post_id
                }
            });

            if (!response || typeof response !== "object") {
                console.error("Invalid response format from server");
                return;
            }

            if (response.success && response.data) {
                if (!response.data.layers || !Array.isArray(response.data.layers)) {
                    console.error("Invalid tree structure: missing or invalid layers array");
                }
                if (Array.isArray(response.data.layers)) {
                    // Store the tree structure in the buffer
                    this._treeBuffer = JSON.parse(JSON.stringify(response.data));
                    this._deserializeTree(response.data);
                }
            }
        } catch (error) {
            console.error("Error loading tree structure:", error);
            const alert = document.createElement("div");
            alert.className = "ck-toolbar-alert ck-toolbar-alert-error";
            alert.innerHTML = '<i class="icon-error"></i> Failed to load asset structure';

            const controlsContainer = jQuery(this._container).find(".annotation-tree-controls");
            if (controlsContainer.length) {
                controlsContainer.after(alert);
                setTimeout(() => {
                    alert.style.opacity = "0";
                    setTimeout(() => alert.remove(), 300);
                }, 3000);
            }
        }
    }

    private _createNestedLayer(
        layerData: any,
        existingAssetNodes: Map<string, HTMLElement>,
        parentContainer: HTMLElement
    ): void {
        const layerNode = this.createNode({
            id: layerData.id,
            title: layerData.title,
            icon: "icon-layer",
            isVisible: layerData.isVisible !== false,
            isLayer: true,
            children: [],
            data: {
                postId: layerData.id,
                image: "",
                date_capture: layerData.date || ""
            }
        });

        const visibilityToggle = layerNode.querySelector(".visibility-toggle") as HTMLInputElement;
        if (visibilityToggle) {
            visibilityToggle.checked = layerData.isVisible !== false;
        }

        parentContainer.appendChild(layerNode);

        if (layerData.children && Array.isArray(layerData.children)) {
            const layerChildren = layerNode.querySelector(".node-children");
            if (!layerChildren) return;

            layerData.children.forEach((child: any) => {
                if (child.type === "layer") {
                    this._createNestedLayer(child, existingAssetNodes, layerChildren as HTMLElement);
                } else {
                    const existingNode = existingAssetNodes.get(child.id);
                    if (existingNode) {
                        const titleEl = existingNode.querySelector(".node-title");
                        if (titleEl) titleEl.textContent = child.title || "";

                        const leftCheckbox = existingNode.querySelector(
                            ".left-asset-list-activator"
                        ) as HTMLInputElement;
                        if (leftCheckbox) leftCheckbox.checked = child.isVisible !== false;

                        const rightCheckbox = existingNode.querySelector(
                            ".right-asset-list-activator"
                        ) as HTMLInputElement;
                        if (rightCheckbox) rightCheckbox.checked = child.isVisible !== false;

                        const dateEl = existingNode.querySelector(".asset-date");
                        if (dateEl) dateEl.textContent = child.date ? `Captured: ${child.date}` : "";

                        layerChildren.appendChild(existingNode);
                        existingAssetNodes.delete(child.id);
                    }
                }
            });
        }
    }

    private _ensureCheckboxesChecked(): void {
        this._container
            .querySelectorAll(".left-asset-list-activator, .right-asset-list-activator")
            .forEach((checkbox) => {
                (checkbox as HTMLInputElement).checked = true;
            });
    }

    private _deserializeTree(data: any): void {
        try {
            const existingAssetNodes = new Map<string, HTMLElement>();
            this._container.querySelectorAll(".annotation-tree-node:not(.layer-node)").forEach((node) => {
                const id = (node as HTMLElement).dataset.id;
                if (id) {
                    existingAssetNodes.set(id, node as HTMLElement);
                }
            });
            this._container.querySelectorAll(".layer-node").forEach((node) => {
                if (node !== this._defaultLayer) {
                    node.remove();
                }
            });

            if (this._defaultLayerChildren) {
                this._defaultLayerChildren.innerHTML = "";
            }

            data.layers.forEach((layerData: any) => {
                if (layerData.id === "default-layer") {
                    if (this._defaultLayer) {
                        const titleElement = this._defaultLayer.querySelector(".node-title");
                        if (titleElement) {
                            titleElement.textContent = layerData.title || "Default Layer";
                        }

                        const visibilityToggle = this._defaultLayer.querySelector(
                            ".visibility-toggle"
                        ) as HTMLInputElement;
                        if (visibilityToggle) {
                            visibilityToggle.checked = layerData.isVisible !== false;
                        }

                        if (layerData.children && Array.isArray(layerData.children) && this._defaultLayerChildren) {
                            layerData.children.forEach((child: any) => {
                                if (child.type === "layer") {
                                    this._createNestedLayer(
                                        child,
                                        existingAssetNodes,
                                        this._defaultLayerChildren as HTMLElement
                                    );
                                } else {
                                    const existingNode = existingAssetNodes.get(child.id);
                                    if (existingNode) {
                                        const titleEl = existingNode.querySelector(".node-title");
                                        if (titleEl) titleEl.textContent = child.title || "";

                                        const leftCheckbox = existingNode.querySelector(
                                            ".left-asset-list-activator"
                                        ) as HTMLInputElement;
                                        if (leftCheckbox) leftCheckbox.checked = child.isVisible !== false;

                                        const rightCheckbox = existingNode.querySelector(
                                            ".right-asset-list-activator"
                                        ) as HTMLInputElement;
                                        if (rightCheckbox) rightCheckbox.checked = child.isVisible !== false;

                                        const dateEl = existingNode.querySelector(".asset-date");
                                        if (dateEl) dateEl.textContent = child.date ? `Captured: ${child.date}` : "";

                                        this._defaultLayerChildren!.appendChild(existingNode);
                                        existingAssetNodes.delete(child.id);
                                    }
                                }
                            });
                        }
                    }
                } else {
                    this._createNestedLayer(layerData, existingAssetNodes, this._container);
                }
            });

            if (this._defaultLayerChildren) {
                existingAssetNodes.forEach((node) => {
                    this._defaultLayerChildren!.appendChild(node);
                });
            }

            this._ensureCheckboxesChecked();

            this._hideSaveButtons();
        } catch (error) {
            console.error("Error deserializing tree:", error);
            throw error;
        }
    }

    private _loadAssets(): void {
        const jQuery = window.jQuery;
        const construkted = window.Construkted;
        if (construkted?.isProject?.()) {
            if (window.master_asset) {
                this._createAssetNode(window.master_asset, this._defaultLayerChildren!);
            } else if (window.project_assets && window.project_assets.length > 0) {
                window.project_assets.forEach((assetInfo) => {
                    this._createAssetNode(assetInfo, this._defaultLayerChildren!);
                });
            } else {
                jQuery(this._defaultLayerChildren).append(`
                    <div class="no-assets-message make-text-center make-text-gray-500 make-py-4">
                        No assets found in this project.
                    </div>
                `);
            }

            this._ensureCheckboxesChecked();
        }
    }
}

export function initAssetManagerPopup(): AssetManagerTreeView {
    const assetManager = new AssetManagerTreeView("#project-asset-list");
    return assetManager;
}
