/* qeslint-disable */

import {
    Cartesian2,
    Cartesian3,
    Cartographic,
    Math as CesiumMath,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    Viewer
} from "cesium";

import "./StatusBar.css";
import { ConstruktedAjaxType, ConstruktedTransformEditors } from "./types";
import { getAngleFractionDigits, getWorldPosition, MeasureUnits, SRSType } from "./core";

interface StatusBarConstructorOptions {
    viewer: Viewer;
    measureUnit: MeasureUnits;
}

export class StatusBar {
    private _viewer: Viewer;
    private _measureUnit: MeasureUnits;
    private _distancePrecision: number;

    private _longitudeSpan: HTMLSpanElement | undefined;
    private _latitudeSpan: HTMLSpanElement | undefined;
    private _altitudeSpan: HTMLSpanElement | undefined;
    private _cameraAltitudeSpan: HTMLSpanElement | undefined;
    private _progressImg: HTMLImageElement | undefined;

    constructor(options: StatusBarConstructorOptions) {
        const viewer = options.viewer;

        this._viewer = viewer;
        this._measureUnit = options.measureUnit;
        this._distancePrecision = 3;

        this._createContainer();

        (document.getElementsByClassName("cesium-viewer-bottom")[0] as HTMLElement).style.zIndex = "1";

        this._connect();

        const jQuery = window.jQuery;

        jQuery(document).on("click", ".server-change-trigger", (e: Event) => {
            e.preventDefault();

            jQuery("#construkted-popup-settings-btn").trigger("click");

            jQuery("#construkted-popup-settings .content-wrapper").scrollTop(
                jQuery("#construkted-popup-settings .content-wrapper")[0].scrollHeight
            );
        });

        jQuery(window).on("load", () => {
            if (jQuery("#coordinateContainer").length > 0) {
                jQuery("#coordinateContainer").append(
                    `<span class="server-change-trigger">${jQuery(
                        "#storage-server-select option:selected"
                    ).text()}</span>`
                );
            }
        });
    }

    _createContainer() {
        const bottomBarContainer = document.createElement("div");

        bottomBarContainer.className = "bottomBar";

        this._viewer.container.appendChild(bottomBarContainer);

        const scaleCoordinateContainer = document.createElement("div");

        scaleCoordinateContainer.id = "coordinateContainer";

        bottomBarContainer.appendChild(scaleCoordinateContainer);

        const progressSpan = document.createElement("span");

        progressSpan.style.display = "inline-block";
        progressSpan.style.width = "40px";

        scaleCoordinateContainer.appendChild(progressSpan);
        const progressImg = document.createElement("img");

        progressSpan.appendChild(progressImg);

        this._progressImg = progressImg;

        const percentOfLoadingProgressSpan = document.createElement("span");
        scaleCoordinateContainer.appendChild(percentOfLoadingProgressSpan);

        const longitudeSpan = document.createElement("span");
        scaleCoordinateContainer.appendChild(longitudeSpan);
        this._longitudeSpan = longitudeSpan;

        const latitudeSpan = document.createElement("span");
        scaleCoordinateContainer.appendChild(latitudeSpan);
        this._latitudeSpan = latitudeSpan;

        const altitudeSpan = document.createElement("span");
        scaleCoordinateContainer.appendChild(altitudeSpan);
        this._altitudeSpan = altitudeSpan;

        const cameraAltitudeSpan = document.createElement("span");
        scaleCoordinateContainer.appendChild(cameraAltitudeSpan);
        this._cameraAltitudeSpan = cameraAltitudeSpan;

        if (
            window.CONSTRUKTED_AJAX.ajax_type &&
            window.CONSTRUKTED_AJAX.ajax_type === ConstruktedAjaxType.AssetViewer
        ) {
            setInterval(() => {
                const existsRequests = window.Construkted.existsPendingRequests();
                const imageRootUrl = window.Construkted.imageRootUrl();

                const gifPath = `${imageRootUrl}/progress_dots.gif`;
                const pngPath = `${imageRootUrl}/progress_dots_static.png`;

                if (existsRequests) {
                    if (this._progressImg!.src !== gifPath) {
                        this._progressImg!.src = gifPath;
                    }
                } else if (this._progressImg!.src !== pngPath) {
                    this._progressImg!.src = pngPath;
                }
            }, 500);
        }
    }

    _connect() {
        const scene = this._viewer.scene;

        scene.preRender.addEventListener(() => {
            this._cameraAltitudeSpan!.innerText = `Camera ${MeasureUnits.distanceToString(
                this._viewer.camera.positionCartographic.height,
                this._measureUnit.distanceUnits,
                undefined,
                this._distancePrecision,
                this._distancePrecision
            )}`;
        }, this);

        const handler = new ScreenSpaceEventHandler(scene.canvas);

        handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
            const pickedPosition = getWorldPosition(scene, movement.endPosition, new Cartesian3());

            if (!pickedPosition) {
                this._clear();
                return;
            }

            if (!this._shownGeolocation()) {
                this._clear();
                return;
            }

            const cartographic = Cartographic.fromCartesian(pickedPosition);

            const construkted = window.Construkted;
            const crsInfo = construkted.project.crsInfo;
            const coord = construkted.getCoordinate(cartographic, crsInfo);
            const srsType = crsInfo.srs_type;

            if (srsType === SRSType.Geographic2d) {
                const angleUnit = this._measureUnit.angleUnits;
                const angleFractionDigits = getAngleFractionDigits(angleUnit);

                this._longitudeSpan!.innerText = `Long:${MeasureUnits.longitudeToString(
                    CesiumMath.toRadians(coord[0]),
                    this._measureUnit.angleUnits,
                    undefined,
                    angleFractionDigits
                )}`;

                this._latitudeSpan!.innerText = `Lat:${MeasureUnits.latitudeToString(
                    CesiumMath.toRadians(coord[1]),
                    this._measureUnit.angleUnits,
                    undefined,
                    angleFractionDigits
                )}`;
            } else {
                const fractionDigits = 3;
                this._longitudeSpan!.innerText = `E:${coord[0].toFixed(fractionDigits)}`;

                this._latitudeSpan!.innerText = `N:${coord[1].toFixed(fractionDigits)}`;
            }

            this._altitudeSpan!.innerText = `Elevation:${MeasureUnits.distanceToString(
                cartographic.height,
                this._measureUnit.distanceUnits,
                undefined,
                this._distancePrecision,
                this._distancePrecision
            )}`;
        }, ScreenSpaceEventType.MOUSE_MOVE);

        window.Construkted.assetViewerCreated.addEventListener(() => {
            const masterAsset = window.Construkted.masterAsset;

            masterAsset.geolocationChanged.addEventListener(() => {
                this._clear();
            });

            masterAsset.geoRefChanged.addEventListener(() => {
                this._clear();
            });
        });
    }

    _clear() {
        this._longitudeSpan!.innerText = "";
        this._latitudeSpan!.innerText = "";
        this._altitudeSpan!.innerText = "";
        this._cameraAltitudeSpan!.innerText = "";
    }

    // eslint-disable-next-line class-methods-use-this
    _shownGeolocation() {
        const construkted = window.Construkted;

        if (construkted.isTilesetAsset()) {
            const construktedAjax = window.CONSTRUKTED_AJAX;

            let show = false;

            if (construktedAjax.active_editor === ConstruktedTransformEditors.VisualPositionEditor) {
                if (construktedAjax.terrain_imagery_enabled) {
                    show = true;
                } else {
                    show = false;
                }
            } else {
                show = true;
            }

            return show;
        }

        if (construkted.isProject()) {
            const projectAssetGroup = construkted.projectViewer.projectAssetGroup;

            if (!projectAssetGroup.ready) {
                return false;
            }

            return projectAssetGroup.containsGeoreferencedAsset();
        }

        return true;
    }
}
