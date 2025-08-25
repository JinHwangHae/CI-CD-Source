import * as JQuery from "jquery";
import { ParsedConstruktedAjax } from "./types/common";

interface DOMElements {
    jqAddRemoveBtn: JQuery;
    jqEditModeButtons: JQuery;
    jqDefaultViewContent: JQuery;
    jqEditModeContent: JQuery;
    jqUpdateBtn: JQuery;
    jqCloseBtn: JQuery;
    jqAllAssetsList: JQuery;
    jqProjectAssetsList: JQuery;
    jqProjectAssetHeader: JQuery;
    jqProjectAssetDesc: JQuery;
}

interface Asset {
    ID: number;
    title: string;
    thumbnail: string;
    georeferenced: boolean;
    selected: boolean;
}

interface AssetResponse {
    success: boolean;
    data?: Asset[];
}

interface AjaxResponse {
    success: boolean;
    data?: string;
}

class AssetManager {
    private _CONSTRUKTED_AJAX: ParsedConstruktedAjax;
    private _elements: DOMElements;

    constructor() {
        this._CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;
        this._elements = AssetManager._getDOMElements();
        this.init();
    }

    private static _getDOMElements(): DOMElements {
        const jQuery = window.jQuery;
        return {
            jqAddRemoveBtn: jQuery("#add-project-asset"),
            jqEditModeButtons: jQuery("#edit-mode-buttons"),
            jqDefaultViewContent: jQuery("#default-view-content"),
            jqEditModeContent: jQuery("#edit-mode-content"),
            jqUpdateBtn: jQuery("#update-assets"),
            jqCloseBtn: jQuery("#close-asset-edit"),
            jqAllAssetsList: jQuery("#all-assets-list"),
            jqProjectAssetsList: jQuery("#project-assets-list"),
            jqProjectAssetHeader: jQuery("#project-asset-list-container strong"),
            jqProjectAssetDesc: jQuery("#project-asset-list-container .desc")
        };
    }

    init(): void {
        this.bindEvents();
    }

    bindEvents(): void {
        const jQuery = window.jQuery;
        this._elements.jqAddRemoveBtn.on("click", () => {
            this.toggleEditMode(true);
            this.loadAllAvailableAssets();
        });

        this._elements.jqCloseBtn.on("click", () => {
            this.toggleEditMode(false);
        });

        this._elements.jqUpdateBtn.on("click", () => {
            this.saveSelectedAssets();
        });

        jQuery("#asset-search").on("input", (e: Event) => {
            const target = e.target as HTMLInputElement;
            const searchTerm = target.value.toLowerCase();
            const jqAssetItems = this._elements.jqAllAssetsList.find(".asset-item");

            jqAssetItems.each(function () {
                const jqItem = jQuery(this);
                const title = jqItem.find(".asset-title").text().toLowerCase();
                jqItem.toggle(title.includes(searchTerm));
            });
        });
    }

    toggleEditMode(showEditMode: boolean): void {
        const jQuery = window.jQuery;
        this._elements.jqAddRemoveBtn.css("display", showEditMode ? "none" : "block");
        this._elements.jqUpdateBtn.toggleClass("hidden", !showEditMode);
        this._elements.jqCloseBtn.toggleClass("hidden", !showEditMode);
        this._elements.jqDefaultViewContent.css("display", showEditMode ? "none" : "block");
        this._elements.jqEditModeContent.css("display", showEditMode ? "block" : "none");

        // Update the title based on mode
        jQuery(".popup-title").html(
            showEditMode
                ? '<i class="gwicon-pencil title-icon"></i>Asset Selection'
                : '<i class="gwicon-pencil title-icon"></i>Asset Manager'
        );

        // Hide/show tree view elements
        jQuery(".asset-search-input").css("display", showEditMode ? "none" : "block");
        jQuery("#compare-assets-option")
            .closest(".make-flex")
            .css("display", showEditMode ? "none" : "block");

        if (showEditMode) {
            jQuery(".node-children").hide();
            jQuery(".annotation-tree-node").hide();
            this._elements.jqAllAssetsList.show(); // Show the all assets list when entering edit mode
        } else {
            jQuery(".node-children").show();
            jQuery(".annotation-tree-node").show();
            this._elements.jqAllAssetsList.hide(); // Hide the all assets list when closing edit mode
            this._elements.jqProjectAssetHeader.text("Main Project Assets");
            this._elements.jqProjectAssetDesc.text("Main assets selected for the project").css("display", "block");
        }
    }

    async loadAllAvailableAssets(): Promise<void> {
        this._elements.jqEditModeButtons.css("display", "none");
        this._elements.jqProjectAssetHeader.css("display", "none");
        this._elements.jqProjectAssetDesc.css("display", "none");

        this._elements.jqAllAssetsList.html(`
            <div class="make-flex make-justify-center make-align-center" style="padding: 20px; margin-top:60px;">
                <div class="loading-spinner"></div>
            </div>
        `);

        const jQuery = window.jQuery;
        try {
            const response: AssetResponse = await jQuery.ajax({
                url: this._CONSTRUKTED_AJAX.ajaxurl,
                type: "POST",
                data: {
                    action: "get_user_project_assets",
                    post_id: this._CONSTRUKTED_AJAX.post_id
                }
            });

            this._elements.jqEditModeButtons.css("display", "flex");
            this._elements.jqProjectAssetHeader.text("Add or Remove Asset").css("display", "block");

            if (response.success && response.data) {
                // Render all assets without initial filtering - let user filtering handle it
                this.renderAvailableAssets(response.data);
            } else {
                this._showError("Failed to load assets");
            }
        } catch (error) {
            this._handleLoadError();
        }
    }

    private _showError(message: string): void {
        this._elements.jqAllAssetsList.html(`
            <div class="make-flex make-justify-center make-align-center" style="padding: 20px;">
                <div class="error-message">${message}</div>
            </div>
        `);
    }

    private _handleLoadError(): void {
        this._elements.jqEditModeButtons.css("display", "flex");
        this._elements.jqProjectAssetHeader.text("Main Project Assets").css("display", "block");
        this._elements.jqProjectAssetDesc.text("Main assets selected for the project").css("display", "block");

        this._showError("Error loading assets");
    }

    renderAvailableAssets(assets: Asset[]): void {
        const html = AssetManager._generateAssetListHTML(assets);
        this._elements.jqAllAssetsList.html(html);

        this._initializeSearch();
        // Re-initialize coordinate system filtering after rendering
        this._initializeCoordinateSystemFiltering();

        // Apply initial filtering based on already selected assets
        this._applyInitialFiltering();
    }

    private _applyInitialFiltering(): void {
        const jQuery = window.jQuery;
        const checkedAssets = this._elements.jqAllAssetsList.find(".asset-select:checked");

        if (checkedAssets.length > 0) {
            // Get the first checked asset to determine the coordinate system type
            const firstCheckedAsset = jQuery(checkedAssets[0]).closest(".asset-line-item");
            const isGeoreferenced = firstCheckedAsset.attr("data-georeferenced") === "true";

            if (isGeoreferenced) {
                // Hide all local CRS assets since a georeferenced asset is selected
                this._elements.jqAllAssetsList.find(".asset-line-item").each(function () {
                    const jqItem = jQuery(this);
                    const itemGeoreferencedAttr = jqItem.attr("data-georeferenced");
                    const itemIsGeoreferenced = itemGeoreferencedAttr === "true";

                    if (!itemIsGeoreferenced) {
                        jqItem.hide();
                    }
                });
            } else {
                // Hide all georeferenced assets since a local CRS asset is selected
                this._elements.jqAllAssetsList.find(".asset-line-item").each(function () {
                    const jqItem = jQuery(this);
                    const itemGeoreferencedAttr = jqItem.attr("data-georeferenced");
                    const itemIsGeoreferenced = itemGeoreferencedAttr === "true";

                    if (itemIsGeoreferenced) {
                        jqItem.hide();
                    }
                });
            }
        }
    }

    private static _generateAssetListHTML(assets: Asset[]): string {
        let html = `
            <div>
                <div class="relative">
                    <i class="icon-search" style="left: 16px;position: absolute;top: 13px;line-height: 1;"></i>
                    <input type="text" class="make-w-full" style="text-indent: 24px;" name="project-assets-search" placeholder="type name of asset to find it" />
                    <div class="project-assets-list mt-1" style="height: calc(100vh - 315px); overflow-y: auto;">
        `;

        html += assets.map((asset) => AssetManager._generateAssetItemHTML(asset)).join("");

        html += `
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    private static _generateAssetItemHTML(asset: Asset): string {
        return `
            <div class="make-flex make-w-full asset-line-item mb-1 make-align-center make-gap-3" 
                 data-id="${asset.ID}" 
                 data-georeferenced="${asset.georeferenced ? "true" : "false"}"
                 style="border: 1px solid #eee; border-radius: 4px;">
                <div style="width: 90px; min-width: 90px;">
                    <div style="width: 100%; aspect-ratio: 16/9; border-radius: 5px; overflow: hidden;">
                        <img src="${asset.thumbnail}" 
                             alt="${asset.title}"
                             style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                </div>
                <div class="make-flex-1" style="min-width: 0;">
                    <h5 style="margin: 0; font-size: 12px; line-height: 1.2; 
                              word-wrap: break-word; 
                              overflow-wrap: break-word; 
                              word-break: break-all; 
                              -ms-word-break: break-all;
                              -webkit-hyphens: auto;
                              -moz-hyphens: auto;
                              hyphens: auto;
                              max-width: 100%;
                              padding-left: 10px;">
                        <span style="display: inline-block; max-width: 100%;">
                            ${asset.title} 
                            ${
                                asset.georeferenced
                                    ? '<span class="gwicon-global" style="margin-left: 4px; vertical-align: top;"></span>'
                                    : ""
                            }
                        </span>
                    </h5>
                </div>
                <div style="width: 24px; min-width: 24px; display: flex; align-items: center; justify-content: center;">
                    <input type="checkbox" 
                           class="asset-select" 
                           value="${asset.ID}" 
                           ${asset.selected ? "checked" : ""}
                           style="width: 16px; height: 16px; margin: 0;">
                </div>
            </div>
        `;
    }

    private _initializeSearch(): void {
        const searchInput = this._elements.jqAllAssetsList.find('input[name="project-assets-search"]');

        // Remove any existing event handlers to prevent duplication
        searchInput.off("input.searchFilter");

        searchInput.on("input.searchFilter", (e: Event) => {
            const target = e.target as HTMLInputElement;
            const searchTerm = target.value.toLowerCase();
            const assetItems = this._elements.jqAllAssetsList.find(".asset-line-item");

            assetItems.each(function () {
                const jqItem = jQuery(this);
                const title = jqItem.find("h5").text().toLowerCase();
                const isVisible = title.includes(searchTerm);

                // Only show items that match the search AND are not hidden by coordinate filtering
                if (isVisible) {
                    jqItem.css("display", "flex");
                } else {
                    jqItem.hide();
                }
            });
        });

        // Add filtering logic for coordinate system types
        this._initializeCoordinateSystemFiltering();
    }

    private _initializeCoordinateSystemFiltering(): void {
        const jQuery = window.jQuery;

        // Remove any existing event handlers to prevent duplication
        this._elements.jqAllAssetsList.find(".asset-select").off("change.coordinateFilter");

        // Use event delegation to ensure the handlers work with dynamically generated content
        this._elements.jqAllAssetsList.on("change.coordinateFilter", ".asset-select", (e: Event) => {
            const target = e.target as HTMLInputElement;
            const isChecked = target.checked;
            const assetItem = jQuery(target).closest(".asset-line-item");

            // Get the georeferenced status from the data attribute
            const georeferencedAttr = assetItem.attr("data-georeferenced");
            const isGeoreferenced = georeferencedAttr === "true";

            if (isChecked) {
                // If selecting a non-georeferenced asset, uncheck all other non-georeferenced assets
                if (!isGeoreferenced) {
                    this._elements.jqAllAssetsList.find(".asset-line-item").each(function () {
                        const jqItem = jQuery(this);
                        const itemGeoreferencedAttr = jqItem.attr("data-georeferenced");
                        const itemIsGeoreferenced = itemGeoreferencedAttr === "true";

                        if (!itemIsGeoreferenced && !jqItem.is(assetItem)) {
                            jqItem.find(".asset-select").prop("checked", false);
                        }
                    });
                }

                // If selecting a georeferenced asset, hide all local CRS assets
                if (isGeoreferenced) {
                    this._elements.jqAllAssetsList.find(".asset-line-item").each(function () {
                        const jqItem = jQuery(this);
                        const itemGeoreferencedAttr = jqItem.attr("data-georeferenced");
                        const itemIsGeoreferenced = itemGeoreferencedAttr === "true";

                        if (!itemIsGeoreferenced) {
                            jqItem.hide();
                        }
                    });
                } else {
                    // If selecting a local CRS asset, hide all georeferenced assets
                    this._elements.jqAllAssetsList.find(".asset-line-item").each(function () {
                        const jqItem = jQuery(this);
                        const itemGeoreferencedAttr = jqItem.attr("data-georeferenced");
                        const itemIsGeoreferenced = itemGeoreferencedAttr === "true";

                        if (itemIsGeoreferenced) {
                            jqItem.hide();
                        }
                    });
                }
            } else {
                // If unchecking an asset, check if any assets of the same type are still checked
                const remainingCheckedAssets = this._elements.jqAllAssetsList.find(".asset-select:checked");

                if (remainingCheckedAssets.length === 0) {
                    // No assets checked, show all assets
                    this._elements.jqAllAssetsList.find(".asset-line-item").show();
                } else {
                    // Some assets are still checked, maintain filtering based on remaining selections
                    this._maintainFilteringBasedOnRemainingSelections();
                }
            }

            // Re-apply search filter if there's a search term
            this._reapplySearchFilter();
        });
    }

    private _maintainFilteringBasedOnRemainingSelections(): void {
        const jQuery = window.jQuery;
        const checkedAssets = this._elements.jqAllAssetsList.find(".asset-select:checked");

        if (checkedAssets.length > 0) {
            // Get the first checked asset to determine the coordinate system type
            const firstCheckedAsset = jQuery(checkedAssets[0]).closest(".asset-line-item");
            const isGeoreferenced = firstCheckedAsset.attr("data-georeferenced") === "true";

            if (isGeoreferenced) {
                // Hide all local CRS assets since georeferenced assets are still selected
                this._elements.jqAllAssetsList.find(".asset-line-item").each(function () {
                    const jqItem = jQuery(this);
                    const itemGeoreferencedAttr = jqItem.attr("data-georeferenced");
                    const itemIsGeoreferenced = itemGeoreferencedAttr === "true";

                    if (!itemIsGeoreferenced) {
                        jqItem.hide();
                    }
                });
            } else {
                // Hide all georeferenced assets since local CRS assets are still selected
                this._elements.jqAllAssetsList.find(".asset-line-item").each(function () {
                    const jqItem = jQuery(this);
                    const itemGeoreferencedAttr = jqItem.attr("data-georeferenced");
                    const itemIsGeoreferenced = itemGeoreferencedAttr === "true";

                    if (itemIsGeoreferenced) {
                        jqItem.hide();
                    }
                });
            }
        }
    }

    private _reapplySearchFilter(): void {
        const jQuery = window.jQuery;
        const searchInput = this._elements.jqAllAssetsList.find('input[name="project-assets-search"]');
        const searchTerm = searchInput.val() as string;

        if (searchTerm && searchTerm.trim() !== "") {
            const assetItems = this._elements.jqAllAssetsList.find(".asset-line-item:visible");

            assetItems.each(function () {
                const jqItem = jQuery(this);
                const title = jqItem.find("h5").text().toLowerCase();
                const shouldShow = title.includes(searchTerm.toLowerCase());
                jqItem.css("display", shouldShow ? "flex" : "none");
            });
        }
    }

    saveSelectedAssets(): void {
        // Prevent multiple simultaneous saves
        if (this._elements.jqUpdateBtn.prop("disabled")) {
            return;
        }

        // Disable the button and show spinner
        this._elements.jqUpdateBtn.prop("disabled", true).html('<i class="icon-loading"></i>');

        const selectedAssets = AssetManager._getSelectedAssets();
        const formData = {
            action: "update_project_assets",
            project_id: this._CONSTRUKTED_AJAX.post_id,
            assets: selectedAssets
        };

        const jQuery = window.jQuery;
        jQuery.ajax({
            url: this._CONSTRUKTED_AJAX.ajaxurl,
            type: "POST",
            data: formData,
            success: (response: AjaxResponse) => {
                if (response.success) {
                    // Show success message and reload
                    alert("Assets updated successfully!");
                    window.location.reload();
                } else {
                    // Show error and restore button
                    alert(response.data || "Error updating assets");
                    this._elements.jqUpdateBtn.prop("disabled", false).html('<i class="icon-save"></i> Save Changes');
                }
            },
            error: () => {
                // Show error and restore button
                alert("Error updating assets");
                this._elements.jqUpdateBtn.prop("disabled", false).html('<i class="icon-save"></i> Save Changes');
            }
        });
    }

    private static _getSelectedAssets(): number[] {
        const jQuery = window.jQuery;
        const jqCheckedAssets = jQuery("#all-assets-list .asset-select:checked");
        return jqCheckedAssets
            .map(function (this: HTMLElement) {
                return jQuery(this).val();
            })
            .get() as number[];
    }
}

export default AssetManager;
