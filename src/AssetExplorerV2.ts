/* qeslint-disable */
// q@ts-nocheck

import {
    Cartesian2,
    Cartesian3,
    Color,
    CustomDataSource,
    defined,
    Entity,
    Event,
    HorizontalOrigin,
    LabelStyle,
    Matrix4,
    PinBuilder,
    SceneMode,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    viewerCesium3DTilesInspectorMixin,
    VerticalOrigin
} from "cesium";

import { AbstractViewerConstructorOptions } from "./AbstractViewer";
import { AbstractAssetExplorer } from "./AbstractAssetExplorer";
import { PopupMenu } from "./PopupMenu";
import { decodeEntities, showHideTilesInspector } from "./construkted";
import { customizeCesiumViewer } from "./customizeCesiumViewer";
import { StatusBar } from "./StatusBar";
import { MeasureUnits } from "./core";
import { ParsedGlobeAssetInfo } from "./types";

class AssetExplorerV2 extends AbstractAssetExplorer {
    private readonly _bottomBar: StatusBar;
    private readonly _popupMenu: PopupMenu;

    constructor(options: AbstractViewerConstructorOptions) {
        super(options);

        const viewer = this.cesiumViewer;

        viewer.extend(viewerCesium3DTilesInspectorMixin);

        // @ts-ignore
        viewer.cesium3DTilesInspector.viewModel.picking = false;

        showHideTilesInspector(false);

        viewer.selectedEntityChanged.addEventListener((newEntity) => {
            if (newEntity) {
                viewer.selectedEntity = undefined;
            }
        });

        const scene = viewer.scene;

        const handler = new ScreenSpaceEventHandler(scene.canvas);

        handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
            const pickedObject = scene.pick(movement.endPosition);

            // user selects non clustered
            if (scene.mode !== SceneMode.MORPHING && defined(pickedObject) && pickedObject.id) {
                const asset = pickedObject.id;

                if (defined(asset) && asset.show) {
                    this._assetsData.forEach((assetData) => {
                        const entity = assetData.entity;

                        if (!entity) {
                            return;
                        }

                        if (entity.id === asset.id) {
                            // @ts-ignore
                            entity.label.show = true;
                        } else {
                            // @ts-ignore
                            entity.label.show = false;
                        }
                    });
                }
            } else {
                this._assetsData.forEach((assetData) => {
                    if (!assetData.entity) {
                        return;
                    }

                    // @ts-ignore
                    assetData.entity.label.show = false;
                });
            }
        }, ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction((movement: { position: Cartesian2 }) => {
            const pickedObject = scene.pick(movement.position);

            // user selects non clustered

            if (defined(pickedObject) && pickedObject.id && pickedObject.id && !Array.isArray(pickedObject.id)) {
                // pickedObject.id.label.show = !pickedObject.id.label.show.getValue();

                // this._assetsData.forEach((assetData) => {
                //     if (parseInt(assetData.ID, 10) === parseInt(pickedObject.id.assetData.ID, 10)) {
                //         assetData.entity.label.show = true;
                //     } else {
                //         assetData.entity.label.show = false;
                //     }
                // });
                this.getAssetInfoThroughAjax(pickedObject.id.assetData.ID);

                scene.requestRender();
            } else if (defined(pickedObject) && pickedObject.id && pickedObject.id && Array.isArray(pickedObject.id)) {
                // user selects cluster
                this._popupMenu.clear();
                this._popupMenu.populate(pickedObject.id);
                this._popupMenu.show(movement.position);
            } else {
                this._popupMenu.hide();
            }
        }, ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction((movement: { position: Cartesian2 }) => {
            const pickedObject = scene.pick(movement.position);

            // user selects non clustered
            if (defined(pickedObject) && pickedObject.id && pickedObject.id && !Array.isArray(pickedObject.id)) {
                this.flyToAsset(pickedObject.id);
            }
        }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

        this.parseAssetsData();

        this._popupMenu = new PopupMenu(this);

        this._createNavigationControlbar();
        customizeCesiumViewer(viewer);

        this._bottomBar = new StatusBar({
            viewer: viewer,
            measureUnit: new MeasureUnits({
                distanceUnits: window.CONSTRUKTED_AJAX.length_unit,
                areaUnits: window.CONSTRUKTED_AJAX.area_unit,
                volumeUnits: window.CONSTRUKTED_AJAX.volume_unit,
                angleUnits: window.CONSTRUKTED_AJAX.angle_unit
            })
        });

        const jQuery = window.jQuery;

        const self = this;

        jQuery(document).on("click", ".flyToAsset", function () {
            // @ts-ignore
            const assetId = jQuery(this).attr("data-asset");
            const assetExplorer = self;

            const globeAssetInfo = assetExplorer._assetsData.filter((asset) => asset.ID.toString() === assetId).pop();

            assetExplorer.flyToAsset(globeAssetInfo!.entity!);
        });
    }

    parseAssetsData() {
        super.parseAssetsData();

        const dataSource = new CustomDataSource("myData");

        this.cesiumViewer.dataSources.add(dataSource);

        dataSource.clustering.enabled = true;
        dataSource.clustering.pixelRange = 15;
        dataSource.clustering.minimumClusterSize = 3;

        const pinBuilder = new PinBuilder();

        const pin10 = pinBuilder.fromText("10+", Color.BLUE, 48).toDataURL();

        const singleDigitPins = new Array(8);
        const svg =
            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjkiIGhlaWdodD0iMzQiIHZpZXdCb3g9IjAgMCAyOSAzNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgZmlsdGVyPSJ1cmwoI2ZpbHRlcjBfZF8xMjM5XzE3MzcpIj4KPHBhdGggZD0iTTE0LjM5MTMgM0M5LjMzNjY2IDMgNCA2LjkxMDYxIDQgMTMuMzkxM0M0IDE1LjAwMTIgNC41OTk1NCAxNi43MzA4IDUuNDE0ODEgMTguMzYxM0M2LjIzODQ3IDIwLjAwODcgNy4zMjkwOCAyMS42NDU5IDguNDEyMTYgMjMuMDk0NUMxMC41Nzg3IDI1Ljk5MjEgMTIuNzgxMSAyOC4yMjE0IDEyLjk1MzggMjguMzk0MUMxMy4xMTcxIDI4LjU1NzQgMTMuMzIwMyAyOC43MTk3IDEzLjU4MDggMjguODM1NkMxMy44NDU3IDI4Ljk1MzMgMTQuMTE4MSAyOSAxNC4zOTEzIDI5QzE0LjY2NDUgMjkgMTQuOTM2OSAyOC45NTMzIDE1LjIwMTggMjguODM1NkMxNS40NjIzIDI4LjcxOTcgMTUuNjY1NSAyOC41NTc0IDE1LjgyODggMjguMzk0MUMxNi4wMDE1IDI4LjIyMTQgMTguMjAzOSAyNS45OTIxIDIwLjM3MDQgMjMuMDk0NUMyMS40NTM1IDIxLjY0NTkgMjIuNTQ0MSAyMC4wMDg3IDIzLjM2NzggMTguMzYxM0MyNC4xODMxIDE2LjczMDggMjQuNzgyNiAxNS4wMDEyIDI0Ljc4MjYgMTMuMzkxM0MyNC43ODI2IDYuOTEwNjEgMTkuNDQ2IDMgMTQuMzkxMyAzWk0xNC4zOTEzIDE1LjUyMTdDMTMuMTY5NyAxNS41MjE3IDEyLjI2MDkgMTQuNjEyOSAxMi4yNjA5IDEzLjM5MTNDMTIuMjYwOSAxMi4xNjk3IDEzLjE2OTcgMTEuMjYwOSAxNC4zOTEzIDExLjI2MDlDMTUuNjEyOSAxMS4yNjA5IDE2LjUyMTcgMTIuMTY5NyAxNi41MjE3IDEzLjM5MTNDMTYuNTIxNyAxNC42MTI5IDE1LjYxMjkgMTUuNTIxNyAxNC4zOTEzIDE1LjUyMTdaIiBmaWxsPSIjMjY5REUxIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9nPgo8ZGVmcz4KPGZpbHRlciBpZD0iZmlsdGVyMF9kXzEyMzlfMTczNyIgeD0iMCIgeT0iMCIgd2lkdGg9IjI4Ljc4MjIiIGhlaWdodD0iMzQiIGZpbHRlclVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgY29sb3ItaW50ZXJwb2xhdGlvbi1maWx0ZXJzPSJzUkdCIj4KPGZlRmxvb2QgZmxvb2Qtb3BhY2l0eT0iMCIgcmVzdWx0PSJCYWNrZ3JvdW5kSW1hZ2VGaXgiLz4KPGZlQ29sb3JNYXRyaXggaW49IlNvdXJjZUFscGhhIiB0eXBlPSJtYXRyaXgiIHZhbHVlcz0iMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMTI3IDAiIHJlc3VsdD0iaGFyZEFscGhhIi8+CjxmZU9mZnNldCBkeT0iMSIvPgo8ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIxLjUiLz4KPGZlQ29tcG9zaXRlIGluMj0iaGFyZEFscGhhIiBvcGVyYXRvcj0ib3V0Ii8+CjxmZUNvbG9yTWF0cml4IHR5cGU9Im1hdHJpeCIgdmFsdWVzPSIwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwLjA4IDAiLz4KPGZlQmxlbmQgbW9kZT0ibm9ybWFsIiBpbjI9IkJhY2tncm91bmRJbWFnZUZpeCIgcmVzdWx0PSJlZmZlY3QxX2Ryb3BTaGFkb3dfMTIzOV8xNzM3Ii8+CjxmZUJsZW5kIG1vZGU9Im5vcm1hbCIgaW49IlNvdXJjZUdyYXBoaWMiIGluMj0iZWZmZWN0MV9kcm9wU2hhZG93XzEyMzlfMTczNyIgcmVzdWx0PSJzaGFwZSIvPgo8L2ZpbHRlcj4KPC9kZWZzPgo8L3N2Zz4K";

        for (let i = 0; i < singleDigitPins.length; ++i) {
            singleDigitPins[i] = pinBuilder.fromText(`${i + 2}`, Color.VIOLET, 48).toDataURL();
        }

        this._assetsData.forEach((assetData) => {
            if (!assetData.asset_geo_location) {
                return;
            }

            const { longitude, latitude, height } = assetData.asset_geo_location;

            const pinImg = new Image();
            pinImg.src = svg;

            const insertBillboard = {
                image: svg,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                width: 32,
                height: 41,
                pixelOffset: new Cartesian2(0, 0),
                show: true
            };

            const entity = dataSource.entities.add({
                name: assetData.post_slug,
                position: Cartesian3.fromDegrees(longitude, latitude, height),
                label: {
                    text: decodeEntities(assetData.post_title),
                    show: false,
                    outlineWidth: 5,
                    scale: 0.6,
                    pixelOffset: new Cartesian2(0, -40),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    style: LabelStyle.FILL_AND_OUTLINE,
                    backgroundColor: new Color(0, 0, 0, 0.55),
                    backgroundPadding: new Cartesian2(20, 16),
                    showBackground: true
                },
                billboard: insertBillboard
            });

            // @ts-ignore
            entity.assetData = assetData;

            assetData.entity = entity;
        });

        let removeListener: Event.RemoveCallback | undefined;

        function customStyle() {
            if (removeListener) {
                removeListener();
                removeListener = undefined;
            } else {
                removeListener = dataSource.clustering.clusterEvent.addEventListener((clusteredEntities, cluster) => {
                    cluster.label.show = true;
                    cluster.label.pixelOffset = new Cartesian2(0, 0);
                    cluster.label.eyeOffset = new Cartesian3(0, 0, -1);
                    // cluster.label.style = LabelStyle.FILL_AND_OUTLINE;
                    cluster.label.outlineWidth = 8;
                    cluster.label.scale = 0.6;
                    cluster.label.disableDepthTestDistance = Number.POSITIVE_INFINITY;
                    cluster.label.horizontalOrigin = HorizontalOrigin.CENTER;
                    cluster.label.verticalOrigin = VerticalOrigin.CENTER;
                    cluster.label.fillColor = Color.fromCssColorString("#269DE1");
                    // cluster.billboard.show = true;
                    // cluster.billboard.id = cluster.label.id;
                    // cluster.billboard.verticalOrigin = VerticalOrigin.BOTTOM;
                    // cluster.billboard.horizontalOrigin = HorizontalOrigin.CENTER;
                    // cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;

                    cluster.point.show = true;
                    cluster.point.pixelSize = 48;
                    cluster.point.color = Color.WHITE;
                    cluster.point.outlineColor = Color.fromCssColorString("#269DE1");
                    cluster.point.outlineWidth = 2;
                    // cluster.point.disableDepthTestDistance = Number.POSITIVE_INFINITY;

                    if (clusteredEntities.length >= 10) {
                        cluster.billboard.image = pin10;
                    } else {
                        cluster.billboard.image = singleDigitPins[clusteredEntities.length - 2];
                    }
                });
            }

            // force a re-cluster with the new styling
            const pixelRange = dataSource.clustering.pixelRange;

            dataSource.clustering.pixelRange = 0;
            dataSource.clustering.pixelRange = pixelRange;
        }

        customStyle();
    }

    flyToAsset(entity: Entity) {
        // @ts-ignore
        const assetData = entity.assetData;

        const { longitude, latitude, height } = assetData.asset_geo_location;

        const offset = 300;

        const viewer = this.cesiumViewer;

        viewer.camera.flyTo({
            destination: Cartesian3.fromDegrees(longitude, latitude, height + offset),
            complete: () => {
                viewer.trackedEntity = undefined;

                this._tryAddAsset(assetData);
            },
            endTransform: Matrix4.IDENTITY
        });
    }

    getAssetInfoThroughAjax(assetId: string) {
        // Do an ajax request to get asset info
        const data = {
            action: "get_asset_info",
            asset_id: assetId
        };

        const url = this._construktedAjax.ajaxurl;

        // Show the preloader
        jQuery(".ck-processing-loader").addClass("shown");

        // Remove old content
        jQuery("#construkted-popup-info .content-wrapper").replaceWith(
            '<div class="content-wrapper">Loading asset data...</div>'
        );

        jQuery.post(url, data, (response) => {
            // Get only the .content-wrapper from the response
            const content = jQuery(response).find(".content-wrapper");

            jQuery("#construkted-popup-info .content-wrapper").replaceWith(content);

            // Wait for 100ms just to make sure the content is changed then trigger to show the popup
            setTimeout(() => {
                jQuery("#construkted-popup-info-btn").trigger("click");
                jQuery(".ck-processing-loader").removeClass("shown");
            }, 100);
        });
    }

    filter() {
        const assetsData = this._assetsData;

        // Iterate through the assets and check if they are in the filtered assets array
        assetsData.forEach((asset) => {
            if (!asset.entity) {
                return;
            }

            const entity = asset.entity;

            if (this._filtered(asset)) {
                entity.show = true;
            } else {
                entity.show = false;
            }
        });
    }

    _filtered(asset: ParsedGlobeAssetInfo) {
        const assetType = jQuery("#globe-asset-source").val();
        const startDate = jQuery("#globe-asset-start-date").val() as string;
        const endDate = jQuery("#globe-asset-end-date").val() as string;
        const onlyMyAssets = jQuery("#globe-asset-user-only").is(":checked");

        const typeMatch = assetType === "all" || asset.type === assetType;

        const dateValid = (() => {
            if (startDate || endDate) {
                const assetDate = new Date(asset.date);
                const start = startDate ? new Date(startDate) : null;
                const end = endDate ? new Date(endDate) : null;

                // Validate both dates before comparison
                if (Number.isNaN(assetDate)) {
                    return false;
                }

                return (!start || assetDate >= start) && (!end || assetDate <= end);
            }

            return true; // No date filters applied
        })();

        const currentUserID = this._construktedAjax.current_user?.ID;

        const authorMatch = !onlyMyAssets || (currentUserID && asset.author === currentUserID);

        return typeMatch && dateValid && authorMatch;
    }
}

export { AssetExplorerV2 };
