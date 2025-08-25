/* qeslint-disable */
// q@ts-nocheck
import * as JQuery from "jquery";

// @ts-ignore
import { AssetInfo } from "./types/common";
import { georeferenceTileset } from "./core/georeferencing";
import { saveDepthTestAgainstTerrain } from "./construkted_ajax";

let jQAssetSearchRadiusText: any = null;
let jQSearchedAssetList: any = null;
let jQAssetSearchRadiusButton: any = null;
let jQShowHideAllSearchedAssetsCheckbox: any = null;
let jQGoogleSatellite: any = null;
let jQGoogleHybrid: any = null;
let jQGoogleRoad: any = null;
let jqCompareAssetsSpansContainer: any = null;
let jqCheckboxTerrainImageryContainer: any = null;
let jqCheckboxTerrainImagery: any = null;
let jqBaseLayerSelectButtonContainer: any = null;
let jqBackgroundColorSelectorContainer: any = null;

export default class LayersPopup {
    constructor() {
        this._init();
    }

    // eslint-disable-next-line class-methods-use-this
    _init1() {
        // enable tab activation logic
        jQuery(document).on("click", ".ck-layers-tab", function (e) {
            e.preventDefault();

            const clickedItem = jQuery(this);
            const index = clickedItem.index() + 1;
            const tabContainer = clickedItem.parents(".ck-tabs");

            clickedItem.addClass("active").siblings().removeClass("active");
            tabContainer
                .find(`.ck-tabs-container > div:nth-child(${index})`)
                .addClass("active")
                .siblings()
                .removeClass("active");
        });

        const jqLayersPanel = jQuery("#layers-panel");

        // Start the draggable functionality
        // @ts-ignore
        if (jQuery.ui && typeof jQuery.ui.draggable === "function") {
            // @ts-ignore
            jqLayersPanel.draggable({ handle: ".drag-tab" });
        }

        // Start the resizable functionality but only for the height
        // @ts-ignore
        if (jQuery.ui && typeof jQuery.ui.draggable === "function") {
            // @ts-ignore
            jqLayersPanel.resizable({
                handles: "s",
                minHeight: 200,
                maxHeight: 600
            });
        }

        jqLayersPanel.on("click", ".hide-tab", () => {
            jqLayersPanel.toggleClass("hidden");
        });

        if (!window.Construkted.isProject() && jQuery(".ck-layers-tab")[0]) {
            jQuery(".ck-layers-tab")[0].style.borderRightStyle = "solid";
        }
    }

    // eslint-disable-next-line class-methods-use-this
    _init() {
        const jQuery = window.jQuery;
        jQAssetSearchRadiusText = jQuery("#asset-search-radius-text");
        jQSearchedAssetList = jQuery("#searched-assets-list");
        jQAssetSearchRadiusButton = jQuery("#asset-search-radius-button");
        jQShowHideAllSearchedAssetsCheckbox = jQuery("#show-hide-all-searched-assets-checkbox");

        let lastSearchedAssetsData: any = null;
        let doingRequest: any = null;

        jQGoogleSatellite = jQuery("#base-layer-select-button-google-satellite");
        jQGoogleHybrid = jQuery("#base-layer-select-button-google-hybrid");
        jQGoogleRoad = jQuery("#base-layer-select-button-google-roads");
        jqCompareAssetsSpansContainer = jQuery("#compare-assets-spans-container");
        jqCheckboxTerrainImageryContainer = jQuery("#enable-terrain-imagery-container");
        jqCheckboxTerrainImagery = jQuery("#enable-terrain-imagery");
        jqBaseLayerSelectButtonContainer = jQuery("#base-layer-select-button-container");
        jqBackgroundColorSelectorContainer = jQuery("#background-selector-container");

        this._init1();

        this.update();

        jqCompareAssetsSpansContainer.hide();
        jQuery(".right-asset-list-activator").hide();

        const construkted = window.Construkted;

        const self = this;

        jqCheckboxTerrainImagery.change(function (this: HTMLInputElement) {
            const enabled = this.checked;

            self.showHideTerrainImageryUI(enabled);

            construkted.showHideSceneBackground(enabled);

            self.setSceneBackgroundColor();
            construkted.viewer!.construktedAjax.terrain_imagery_enabled = enabled;
            window.CONSTRUKTED_AJAX.terrain_imagery_enabled = enabled;

            if (construkted.isTilesetAsset()) {
                construkted.assetViewer.visualPositionEditor?.ui.update();
                self._showHideDisableDepthTestAgainstTerrainUI(enabled);
            }
        });

        jqBackgroundColorSelectorContainer.find(".ck-color-option").click(function (this: JQuery) {
            jQuery(this).addClass("selected").siblings().removeClass("selected");
            const cssColor = jQuery(this).attr("data-value") as string;

            construkted.setSceneBackgroundColor(cssColor);

            if (construkted.currentUserIsAuthor()) {
                construkted.saveSceneBackgroundColor(cssColor);
            }
        });

        jQAssetSearchRadiusButton.click(() => {
            jQAssetSearchRadiusButton.attr("disabled", "disabled");
            if (doingRequest) return;
            if (lastSearchedAssetsData) {
                lastSearchedAssetsData.forEach((assetData: any) => {
                    construkted.removeTileset(assetData.tileset);
                });
            }

            let searchRadius = jQAssetSearchRadiusText.val();
            jQSearchedAssetList.empty();
            jQuery("#layers-nearby-assets").addClass("hidden");

            searchRadius = parseFloat(searchRadius);

            if (Number.isNaN(searchRadius)) {
                alert("Invalid search radius!");
                return;
            }

            doingRequest = construkted.projectViewer.searchNearAssets(searchRadius).then((data) => {
                const nearAssetsData: any = data;

                if (nearAssetsData.length === 0) {
                    // alert("No result!");
                    jQSearchedAssetList.append(
                        '<div class="no-results" style="font-weight:600;">No assets found in searched radius.</div>'
                    );
                    jQuery("#save-nearby-assets").addClass("hidden");
                    return;
                }

                jQShowHideAllSearchedAssetsCheckbox.prop("checked", false);

                jQAssetSearchRadiusButton.prop("disabled", true);
                // jQuery('*').css('cursor', 'wait');

                jQuery(".ck-processing-loader").addClass("shown");

                let resolvedAssetCount = 0;

                for (let i = 0; i < nearAssetsData.length; i++) {
                    const assetData = nearAssetsData[i];
                    const tileset = assetData.tileset;

                    tileset.readyPromise
                        // eslint-disable-next-line no-loop-func
                        .then(() => {
                            resolvedAssetCount++;

                            if (resolvedAssetCount === nearAssetsData.length) {
                                jQAssetSearchRadiusButton.prop("disabled", false);
                                // jQuery('*').css('cursor', 'default');
                                jQuery(".ck-processing-loader").removeClass("shown");
                                if (nearAssetsData.length > 0) {
                                    jQuery("#layers-nearby-assets").removeClass("hidden");
                                    jQuery("#save-nearby-assets").removeClass("hidden");
                                }
                            }

                            const assetGeoLocationData = assetData.asset_geo_location;

                            georeferenceTileset(tileset, assetGeoLocationData);

                            const id = assetData.post_slug;

                            const label = `${assetData.post_title} ( ${parseInt(assetData.distance, 10)} m)`;

                            const assetCheckbox = `<div class="make-flex asset-line-item make-align-center make-gap-8 make-flex-row make-gap-8 mb-2"><input class="asset-list-activator" data-post-id="${
                                assetData.post_id
                            }" id="${id}" data-url="${
                                assetData.tileset._url
                            }" type="checkbox"><div class="asset-list-viewer make-flex  make-flex-row make-align-center make-gap-8" id="${id}-zoom-icon"><div style="background: #ccc url(${
                                assetData.image ? assetData.image : ""
                            }) no-repeat;aspect-ratio:16/9;border-radius:4px;width: 70px;min-width:70px;background-size:cover;"></div><span>${label}</span></div></div>`;

                            jQSearchedAssetList.append(assetCheckbox);

                            jQuery(`[id=${id}]`).change(function () {
                                // @ts-ignore
                                assetData.tileset.show = this.checked;

                                construkted.cesiumViewer.scene.requestRender();
                            });

                            jQuery(`[id=${id}-zoom-icon]`).click(() => {
                                construkted.cesiumViewer.camera.flyToBoundingSphere(tileset.boundingSphere);
                            });

                            jQAssetSearchRadiusButton.prop("disabled", false);
                            jQAssetSearchRadiusButton.removeAttr("disabled");
                        })
                        // eslint-disable-next-line no-loop-func
                        .catch((error: any) => {
                            console.error(error);

                            resolvedAssetCount++;

                            if (resolvedAssetCount === nearAssetsData.length) {
                                jQAssetSearchRadiusButton.prop("disabled", false);
                                // jQuery('*').css('cursor', 'default');
                                jQuery(".ck-processing-loader").removeClass("shown");
                            }
                        });
                    doingRequest = null;
                }

                lastSearchedAssetsData = nearAssetsData;
            });
        });

        jQuery(document).on("click", "#save-nearby-assets", (e: any) => {
            e.preventDefault();
            jQuery(".ck-processing-loader").addClass("shown");

            const selectedAssets = jQuery("#searched-assets-list input:checked");
            const nonce = jQuery('[name="ck_get_annotation_nonce"]').val();

            const selectedAssetIds: any[] = [];

            Object.keys(selectedAssets).forEach((index, asset) => {
                if (
                    jQuery(selectedAssets[asset]).attr("data-post-id") !== "" &&
                    jQuery(selectedAssets[asset]).attr("data-post-id") !== "undefined" &&
                    typeof jQuery(selectedAssets[asset]).attr("data-post-id") !== "undefined"
                ) {
                    selectedAssetIds.push(jQuery(selectedAssets[asset]).attr("data-post-id"));
                }
            });

            const data = {
                action: "add_project_assets",
                assets: selectedAssetIds.join(","),
                project: window.CONSTRUKTED_AJAX.post_id,
                nonce: nonce
            };

            jQuery.post(window.gowatch.ajaxurl, data, (res: any) => {
                if (res.status === 200) {
                    // alert('Added:', res.msg)
                    res.data.forEach((asset: any) => {
                        if (asset) {
                            const newAssetObject = {
                                post_title: asset.post_title,
                                post_id: asset.post_id,
                                image: asset.image,
                                tileset: asset.tileset
                            };

                            // Asset line item generation is now handled by AssetManagerPopup
                            jQuery(`#searched-assets-list .asset-list-activator[data-post-id="${asset.post_id}"]`)
                                .parents(".make-flex")
                                .remove();
                            // Add the selected assets into the window.assets object
                            // let selectedAssetsObject = CONSTRUKTED_AJAX.assets.filter(item => {
                            //     if (selectedAssetIds.includes(item.post_id.toString())) return true;
                            // })
                            // @ts-ignore
                            window.assets = window.assets.concat(newAssetObject as AssetInfo);
                        }
                    });
                } else {
                    alert("There was an error:");
                }

                jQuery(".ck-processing-loader").removeClass("shown");
            });
        });

        jQuery(".nearby-assets-option").on("change", function () {
            if (
                !jQuery("#include-public-assets").prop("checked") &&
                !jQuery("#include-private-assets").prop("checked")
            ) {
                jQAssetSearchRadiusButton.prop("disabled", true).addClass("disabled");
                jQuery(".nearby-assets-alert").remove();

                // @ts-ignore
                jQuery(this)
                    .parents(".nearby-assets-options")
                    .after(
                        '<div class="nearby-assets-alert mb-1" style="color: red;">Either public or private needs to be selected. Please choose at least one option.</div>'
                    );
            } else {
                jQAssetSearchRadiusButton.prop("disabled", false).removeClass("disabled");
                jQuery(".nearby-assets-alert").remove();
            }
        });

        jQShowHideAllSearchedAssetsCheckbox.change(function (this: HTMLInputElement) {
            const checked = this.checked;

            if (!lastSearchedAssetsData) return;

            lastSearchedAssetsData.forEach((assetData: any) => {
                assetData.tileset.show = checked;

                const id = assetData.post_slug;

                jQuery(`[id=${id}]`).prop("checked", checked);
            });

            construkted.scene.requestRender();
        });

        const deactivateAllButtons = function () {
            $("*[id*=base-layer-select-button]").each(function (this: HTMLElement) {
                this.classList.remove("active");
            });
        };

        jQGoogleSatellite.click(function (this: HTMLElement) {
            if (this.classList.contains("active")) return;

            construkted.addGoogleSatelliteMap();
            deactivateAllButtons();
            this.classList.add("active");
        });

        jQGoogleHybrid.click(function (this: HTMLElement) {
            if (this.classList.contains("active")) return;

            construkted.addGoogleHybridMap();
            deactivateAllButtons();

            this.classList.add("active");
        });

        jQGoogleRoad.click(function (this: HTMLElement) {
            if (this.classList.contains("active")) return;

            construkted.addGoogleRoadMap();
            deactivateAllButtons();
            this.classList.add("active");
        });

        jQuery(document).on("click", ".asset-list-viewer", function (this: JQuery) {
            const postId = jQuery(this).siblings("input").attr("data-post-id");
            const asset = construkted.projectViewer.projectAssetGroup.getAsset(postId);

            construkted.zoomToAsset(asset!);
        });

        jQuery(document).on("click", ".asset-list-activator", function (this: JQuery) {
            const postId = jQuery(this).attr("data-post-id");

            const asset = construkted.getAsset(postId);
            asset!.toggle();
        });

        if (window.Construkted.isTilesetAsset()) {
            this._showHideDisableDepthTestAgainstTerrainUI(window.CONSTRUKTED_AJAX.terrain_imagery_enabled);
        } else {
            this._showHideDisableDepthTestAgainstTerrainUI(false);
        }

        const jqDisableDepthTestAgainstTerrain = jQuery("#disable-depth-test-against-terrain");

        jqDisableDepthTestAgainstTerrain.prop("checked", !window.CONSTRUKTED_AJAX.depth_test_against_terrain);

        jqDisableDepthTestAgainstTerrain.change(function (this: HTMLInputElement) {
            construkted.scene.globe.depthTestAgainstTerrain = !this.checked;
            saveDepthTestAgainstTerrain(construkted.scene.globe.depthTestAgainstTerrain);
        });

        // hovering logic

        jQuery(document).on("mouseover", ".asset-list-viewer", function (this: JQuery) {
            const leftCheckbox = jQuery(this).parent().children(":first");
            const postId = leftCheckbox.attr("data-post-id");

            const assets = construkted.tilesetAssets;

            assets.forEach((asset) => {
                if (asset.postId === postId) {
                    asset.showHideBox(true);
                } else {
                    asset.showHideBox(false);
                }
            });
        });

        jQuery(document).on("mouseleave", ".asset-list-viewer", () => {
            const assets = construkted.tilesetAssets;

            assets.forEach((asset) => {
                asset.showHideBox(false);
            });
        });

        jQuery("#hull-clip-checkbox").change(function (this: HTMLInputElement) {
            if (this.checked) {
                construkted.computeHullAndClipTerrain();
            } else {
                construkted.cesiumViewer.scene.globe.clippingPlanes.removeAll();
            }
        });

        if (window.Construkted.isAssetExplorer()) {
            jqCheckboxTerrainImageryContainer.hide();
            jqBackgroundColorSelectorContainer.hide();
        }
    }

    // eslint-disable-next-line class-methods-use-this
    setSceneBackgroundColor() {
        if (window.CONSTRUKTED_AJAX.bg_color_css_string) {
            // already set in AssetViewer

            const selected = jqBackgroundColorSelectorContainer.find(".ck-color-option.selected");

            selected.removeClass("selected");
            jqBackgroundColorSelectorContainer
                .find(`[data-value='${window.CONSTRUKTED_AJAX.bg_color_css_string}']`)
                .addClass("selected");

            return;
        }

        const cssColor = jqBackgroundColorSelectorContainer.find(".ck-color-option.selected").attr("data-value");
        const construkted = window.Construkted;

        construkted.setSceneBackgroundColor(cssColor);
    }

    showHideCheckboxTerrainImagery(show: boolean) {
        if (show) {
            jqCheckboxTerrainImageryContainer.show();
            jqCheckboxTerrainImagery.prop("checked", true);
            jqBaseLayerSelectButtonContainer.show();
            jqBackgroundColorSelectorContainer.hide();
        } else {
            jqCheckboxTerrainImageryContainer.hide();
            jqBaseLayerSelectButtonContainer.hide();
            jqBackgroundColorSelectorContainer.show();

            this.setSceneBackgroundColor();
        }
    }

    // eslint-disable-next-line class-methods-use-this
    showHideTerrainImageryUI(show: boolean) {
        if (show) {
            jqBaseLayerSelectButtonContainer.show();
            jqBackgroundColorSelectorContainer.hide();
        } else {
            jqBaseLayerSelectButtonContainer.hide();
            jqBackgroundColorSelectorContainer.show();
        }
    }

    // eslint-disable-next-line class-methods-use-this
    _showHideDisableDepthTestAgainstTerrainUI(show: boolean) {
        const jqDisableDepthTestAgainstTerrainContainer = jQuery("#disable-depth-test-against-terrain-container");

        if (show) {
            jqDisableDepthTestAgainstTerrainContainer.show();
        } else {
            jqDisableDepthTestAgainstTerrainContainer.hide();
        }
    }

    // eslint-disable-next-line class-methods-use-this
    update() {
        const construkted = window.Construkted;

        if (construkted.isProject()) {
            // Asset list generation is now handled by AssetManagerPopup
            const assetGroup = construkted.projectAssetGroup;

            assetGroup?.readEvt.addEventListener(() => {
                this.showHideCheckboxTerrainImagery(assetGroup.containsGeoreferencedAsset());
            });
        } else if (construkted.isProject() || construkted.isTilesetAsset()) {
            construkted.assetViewer.initialized.addEventListener(() => {
                let enabled = construkted.assetViewer?.construktedAjax?.terrain_imagery_enabled;

                if (!enabled) {
                    const scene = construkted.assetViewer?.cesiumViewer.scene;

                    if (scene.globe.show) {
                        enabled = true;
                    }
                }

                jqCheckboxTerrainImagery.prop("checked", enabled);
                this.showHideTerrainImageryUI(enabled);

                this._showHideDisableDepthTestAgainstTerrainUI(enabled);
            });
        }
    }

    // eslint-disable-next-line class-methods-use-this
    toggle() {
        const jqLayersPanel = jQuery("#layers-panel");

        jqLayersPanel.toggleClass("hidden");
    }

    // eslint-disable-next-line class-methods-use-this
    show() {
        const jqLayersPanel = jQuery("#layers-panel");

        jqLayersPanel.removeClass("hidden");
    }

    // eslint-disable-next-line class-methods-use-this
    hide() {
        const jqLayersPanel = jQuery("#layers-panel");

        jqLayersPanel.addClass("hidden");
    }
}
