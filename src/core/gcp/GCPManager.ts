/* qeslint-disable */
// q@ts-nocheck

import * as JQuery from "jquery";
import { Cartesian3, Color, Matrix3, Matrix4, Scene, Viewer } from "cesium";

import GCPMouseHandler from "./GCPMouseHandler";
import { calcRotationMatrix, getCentroid, getTranslatedPositions } from "./Kabsch";
import { MultiGCPEditorUI } from "./MultiGCPEditorUI";
import { GCPData } from "../../types/common";
import { TilesetAsset } from "../TilesetAsset";

let jQPlaceGCP1Button: JQuery;
let jQClearGCP1Button: JQuery;
let jQPlaceGCP2Button: JQuery;
let jQClearGCP2Button: JQuery;
let jQPlaceGCP3Button: JQuery;
let jQClearGCP3Button: JQuery;
let jqAltitudeOffset: JQuery;

interface GCPManagerConstructorOptions {
    scene: Scene;
    tilesetAsset: TilesetAsset;
    gcp: any;
}

export class GCPManager {
    private _ui: MultiGCPEditorUI;
    // eslint-disable-next-line no-use-before-define
    private static _instance: GCPManager;
    private _gcpMouseHandler: GCPMouseHandler;
    private _tilesetAsset: TilesetAsset;
    private _GCPCount: number;
    private _calculated: boolean;
    private _debug: boolean;

    constructor(options: GCPManagerConstructorOptions) {
        GCPManager._instance = this;

        const tilesetAsset = options.tilesetAsset;

        this._gcpMouseHandler = new GCPMouseHandler(options.scene, tilesetAsset.tileset);

        this._gcpMouseHandler.GCPPlaced.addEventListener((gcpIndex: number) => {
            const gcpPlaceButton = window.jQuery(`#place_gcp${gcpIndex + 1}_button`);

            gcpPlaceButton.removeClass("gcp-active");

            this._gcpMouseHandler.deactivate();
        });

        this._tilesetAsset = tilesetAsset;
        this._GCPCount = 3;
        this._calculated = false;
        this._debug = false;

        this._jQInitialize();

        if (options && options.gcp && window.CONSTRUKTED_AJAX.is_owner) {
            this._init(options.gcp);
        }

        this._ui = new MultiGCPEditorUI({ editor: this });

        this._gcpMouseHandler.hideAllPoints();
    }

    // eslint-disable-next-line class-methods-use-this
    activate() {
        const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

        const assetGeolocation = CONSTRUKTED_AJAX.asset_geo_location_by_gcps;

        if (assetGeolocation) {
            const assetViewer = window.Construkted.assetViewer;

            assetViewer.masterAsset.georeference(assetGeolocation);
            assetViewer.cesiumViewer.camera.flyToBoundingSphere(assetViewer.masterAsset.tileset.boundingSphere);
        }

        this._gcpMouseHandler.showAllPoints();
    }

    reset() {
        this.clear();
    }

    cancel() {
        const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

        this.clear();

        if (!CONSTRUKTED_AJAX.gcp) {
            return;
        }

        this._init(CONSTRUKTED_AJAX.gcp);
    }

    hideAllGCPs() {
        this._gcpMouseHandler.hideAllPoints();
    }

    _jQInitialize() {
        const jQuery = window.jQuery;

        jQPlaceGCP1Button = jQuery("#place_gcp1_button");
        jQClearGCP1Button = jQuery("#clear_gcp1_button");

        jQPlaceGCP2Button = jQuery("#place_gcp2_button");
        jQClearGCP2Button = jQuery("#clear_gcp2_button");

        jQPlaceGCP3Button = jQuery("#place_gcp3_button");
        jQClearGCP3Button = jQuery("#clear_gcp3_button");

        jqAltitudeOffset = jQuery("#gcp_altitude_offset");

        jQPlaceGCP1Button.click(() => {
            this._activateGCPMouseHandler(0, jQPlaceGCP1Button);
        });

        jQPlaceGCP2Button.click(() => {
            this._activateGCPMouseHandler(1, jQPlaceGCP2Button);
        });

        jQPlaceGCP3Button.click(() => {
            this._activateGCPMouseHandler(2, jQPlaceGCP3Button);
        });

        const gcpMouseHandler = this._gcpMouseHandler;

        jQClearGCP1Button.click(() => {
            gcpMouseHandler.hideGCP(0);
        });

        jQClearGCP2Button.click(() => {
            gcpMouseHandler.hideGCP(1);
        });

        jQClearGCP3Button.click(() => {
            gcpMouseHandler.hideGCP(2);
        });

        jqAltitudeOffset.change(() => {
            this.ignoreWorkingResult();
        });
    }

    _init(gcp: GCPData) {
        const newGCPCount = gcp.points.length - 3;

        for (let i = 0; i < newGCPCount; i++) {
            this._newGCPInterface();
        }

        const jQuery = window.jQuery;

        for (let i = 1; i <= this._GCPCount; i++) {
            const jQGCPLatitude = jQuery(`#gcp${i}_latitude`);
            const jQGCPLongitude = jQuery(`#gcp${i}_longitude`);
            const jQGCAltitude = jQuery(`#gcp${i}_altitude`);

            const textField = gcp.textFields[i - 1];

            jQGCPLongitude.val(textField[0]);
            jQGCPLatitude.val(textField[1]);
            jQGCAltitude.val(textField[2]);

            const point = gcp.points[i - 1];

            const position = new Cartesian3(point[0], point[1], point[2]);

            this._gcpMouseHandler.insertNew(position, i - 1);
        }

        jqAltitudeOffset.val(gcp.altitudeOffset);
    }

    _newGCPInterface() {
        const jQuery = window.jQuery;

        const GCPListUI = jQuery("#gcp-list");

        this._GCPCount++;

        const GCPNumber = this._GCPCount;

        const html = `<div id="gcp${GCPNumber}" class="ck-toolbar-toggle">
            <label>Ground Control Point 0${GCPNumber} <span id="gcp${GCPNumber}-remove" class="gcp-remove-btn">×</span> <i class="icon-down"></i></label>
            <div class="toolbar-toggle-content ">
                <div class="make-flex make-flex-row make-gap-4  mb-1">
                    <div class="make-inline-flex make-flex-1 make-flex-column make-gap-4">
                        <span>Latitude</span>
                        <input type="text" id="gcp${GCPNumber}_latitude" value="" class="gcp-input ck-smaller-input">
                    </div>

                    <div class="make-inline-flex make-flex-1 make-flex-column make-gap-4">
                        <span>Longitude</span>
                        <input type="text" id="gcp${GCPNumber}_longitude" value="" class="gcp-input ck-smaller-input">
                    </div>

                    <div class="make-inline-flex make-flex-1 make-flex-column make-gap-4">
                        <span>Altitude</span>
                        <input type="text" id="gcp${GCPNumber}_altitude" value="" class="gcp-input ck-smaller-input">
                    </div>
                </div>
                <label id="gcp${GCPNumber}-error" class="mb-1">GCP Error: N/A</label>
                <div class="make-flex make-gap-4 form-group">
                    <button type="button" id="place_gcp${GCPNumber}_button" class="ck-smaller-button make-flex-1 blue">Place GCP ${GCPNumber}</button>
                    <button type="button" id="clear_gcp${GCPNumber}_button" class="ck-smaller-button make-flex-1 red">Clear GCP</button>
                </div>
            </div>
        </div>`;

        GCPListUI.append(html);

        const self = this;

        jQuery(`#gcp${GCPNumber}-remove`).click(function () {
            self._GCPCount--;
            // @ts-ignore
            jQuery(this).closest("div").remove();
        });

        const placeGCPButton = jQuery(`#place_gcp${GCPNumber}_button`);

        placeGCPButton.click(() => {
            this._activateGCPMouseHandler(GCPNumber - 1, placeGCPButton);
        });

        jQuery(`#clear_gcp${GCPNumber}_button`).click(() => {
            this._gcpMouseHandler.hideGCP(GCPNumber - 1);
        });
    }

    _activateGCPMouseHandler(gcpIndex: number, placeGCPButton: JQuery) {
        const gcpMouseHandler = this._gcpMouseHandler;

        gcpMouseHandler.setActiveGCPIndex(gcpIndex);

        if (!gcpMouseHandler.activated) {
            placeGCPButton.addClass("gcp-active");

            gcpMouseHandler.activate();
        }
    }

    _checkGCP() {
        const pointCollection = this._gcpMouseHandler.pointCollection;

        if (pointCollection.length < 3) {
            alert("You have to specify three gcps at least!");
            return false;
        }

        if (pointCollection.length < this._GCPCount) {
            alert("You have to specify more gcps!");
            return false;
        }

        if (pointCollection.length !== this._GCPCount) {
            alert("The count of GCPs should be the same as text fields!");
            return false;
        }

        const checkLongitudeText = (jQInput: JQuery, gcpIndex: number) => {
            const val = (jQInput.val() as string).trim();

            if (val === "") {
                alert(`please input longitude in GCP${gcpIndex}!`);
                return false;
            }

            const longitude = parseFloat(val);

            if (Number.isNaN(longitude) || longitude > 180 || longitude < -180) {
                jQInput.val("");
                alert(`invalid longitude: ${longitude} in GCP${gcpIndex}`);
                return false;
            }

            return true;
        };

        const checkLatitudeText = (jQInput: JQuery, gcpIndex: number) => {
            const val = (jQInput.val() as string).trim();

            if (val === "") {
                alert(`please input latitude in GCP${gcpIndex}!`);
                return false;
            }

            const latitude = parseFloat(val);

            if (Number.isNaN(latitude) || latitude > 90 || latitude < -90) {
                jQInput.val("");
                alert(`invalid latitude: ${latitude} in GCP${gcpIndex}`);
                return false;
            }

            return true;
        };

        const checkAltitude = (jQInput: JQuery, gcpIndex: number) => {
            const val = (jQInput.val() as string).trim();

            if (val === "") {
                alert(`please input altitude in GCP${gcpIndex}!`);
                return false;
            }

            const altitude = parseFloat(val);

            if (Number.isNaN(altitude) || altitude > 15000 || altitude < -1000) {
                jQInput.val("");
                alert(`invalid altitude: ${altitude} in GCP${gcpIndex}`);
                return false;
            }

            return true;
        };

        const jQuery = window.jQuery;

        for (let i = 1; i <= this._GCPCount; i++) {
            const jQGCPLatitude = jQuery(`#gcp${i}_latitude`);
            const jQGCPLongitude = jQuery(`#gcp${i}_longitude`);
            const jQGCAltitude = jQuery(`#gcp${i}_altitude`);

            if (!checkLatitudeText(jQGCPLatitude, i)) return false;

            if (!checkLongitudeText(jQGCPLongitude, i)) return false;

            if (!checkAltitude(jQGCAltitude, i)) return false;
        }

        return true;
    }

    _collectRawQ() {
        let altitudeOffset = parseFloat(jqAltitudeOffset.val() as string);

        if (Number.isNaN(altitudeOffset)) altitudeOffset = 0;

        const ret = [];

        const jQuery = window.jQuery;

        for (let i = 1; i <= this._GCPCount; i++) {
            const jQGCPLatitude = jQuery(`#gcp${i}_latitude`);
            const jQGCPLongitude = jQuery(`#gcp${i}_longitude`);
            const jQGCAltitude = jQuery(`#gcp${i}_altitude`);

            const cartesian = Cartesian3.fromDegrees(
                parseFloat(jQGCPLongitude.val()),
                parseFloat(jQGCPLatitude.val()),
                parseFloat(jQGCAltitude.val()) + altitudeOffset
            );

            ret.push([cartesian.x, cartesian.y, cartesian.z]);
        }

        return ret;
    }

    _collectRawP() {
        const pointCollection = this._gcpMouseHandler.pointCollection;

        const rawP = [];

        for (let i = 0; i < pointCollection.length; i++) {
            const position = pointCollection.get(i).position;

            rawP.push([position.x, position.y, position.z]);
        }

        return rawP;
    }

    // eslint-disable-next-line class-methods-use-this
    _calcMatrix4(rawP: number[][], rawQ: number[][]) {
        console.assert(rawP.length === rawQ.length, "error");

        const centerOfP = getCentroid(rawP);
        const centerOfQ = getCentroid(rawQ);

        const P = getTranslatedPositions(rawP, [-centerOfP[0], -centerOfP[1], -centerOfP[2]]);
        const Q = getTranslatedPositions(rawQ, [-centerOfQ[0], -centerOfQ[1], -centerOfQ[2]]);

        const rotation = calcRotationMatrix(P, Q);

        // const rotatedP = multiply(P, rotation);
        // const movedP = getTranslatedPositions(rotatedP, centerOfQ);

        const rotationMatrix3 = new Matrix3();

        // @ts-ignore
        rotationMatrix3[0] = rotation[0][0];
        // @ts-ignore
        rotationMatrix3[1] = rotation[0][1];
        // @ts-ignore
        rotationMatrix3[2] = rotation[0][2];
        // @ts-ignore
        rotationMatrix3[3] = rotation[1][0];
        // @ts-ignore
        rotationMatrix3[4] = rotation[1][1];
        // @ts-ignore
        rotationMatrix3[5] = rotation[1][2];
        // @ts-ignore
        rotationMatrix3[6] = rotation[2][0];
        // @ts-ignore
        rotationMatrix3[7] = rotation[2][1];
        // @ts-ignore
        rotationMatrix3[8] = rotation[2][2];

        const inverseMatrixCenterP = Matrix4.fromTranslation(
            new Cartesian3(-centerOfP[0], -centerOfP[1], -centerOfP[2])
        );
        const rotationMatrix = Matrix4.fromRotationTranslation(rotationMatrix3);
        const matrixCenterQ = Matrix4.fromTranslation(new Cartesian3(centerOfQ[0], centerOfQ[1], centerOfQ[2]));

        // step1 apply rotation matrix to inverseMatrixCenterP
        const matrix = Matrix4.multiply(rotationMatrix, inverseMatrixCenterP, new Matrix4());

        // step2 apply matrixCenterQ to matrix
        return Matrix4.multiply(matrixCenterQ, matrix, new Matrix4());
    }

    _updateAssetLocation() {
        const rawP = this._collectRawP();
        const rawQ = this._collectRawQ();
        const matrix = this._calcMatrix4(rawP, rawQ);

        const tileset = this._tilesetAsset.tileset;

        if (tileset.modelMatrix.equals(matrix)) {
            return;
        }

        this._tilesetAsset.georeferenceByMatrix4(matrix);

        const error = this._calcError(rawP, rawQ, matrix);

        this._displayError(error);

        const viewer = window.Construkted.cesiumViewer;

        if (this._debug) this._addDebugBallsForRawQ(viewer, rawQ, 5);

        this._gcpMouseHandler.modelMatrix = tileset.modelMatrix;
        this._gcpMouseHandler.forceUpdate();
        this._gcpMouseHandler.deactivate();

        viewer.flyTo(this._tilesetAsset.tileset);

        if (!this._calculated) this._calculated = true;
    }

    // eslint-disable-next-line class-methods-use-this
    _calcError(rawP: number[][], rawQ: number[][], matrix4: Matrix4) {
        console.assert(rawQ.length === rawP.length, "error");

        const ret = [];

        for (let i = 0; i < rawQ.length; i++) {
            const cartesian3P = new Cartesian3(rawP[i][0], rawP[i][1], rawP[i][2]);
            const cartesian3Q = new Cartesian3(rawQ[i][0], rawQ[i][1], rawQ[i][2]);
            const errorValue = Cartesian3.distance(
                cartesian3Q,
                Matrix4.multiplyByPoint(matrix4, cartesian3P, new Cartesian3())
            );

            ret.push(errorValue.toFixed(4));
        }

        return ret;
    }

    // eslint-disable-next-line class-methods-use-this
    _addDebugBallsForRawQ(viewer: Viewer, rawQ: number[][], radius: number) {
        viewer.entities.removeAll();

        for (let i = 0; i < rawQ.length; i++) {
            viewer.entities.add({
                position: new Cartesian3(rawQ[i][0], rawQ[i][1], rawQ[i][2]),
                ellipsoid: {
                    radii: new Cartesian3(radius, radius, radius),
                    material: Color.RED.withAlpha(0.5),
                    outline: true,
                    outlineColor: Color.BLACK
                }
            });
        }
    }

    _displayError(error: string[]) {
        console.assert(error.length === this._GCPCount, "error");

        for (let i = 1; i <= this._GCPCount; i++) {
            const jqLabel = window.jQuery(`#gcp${i}-error`);

            jqLabel.text(`GCP Error: ${error[i - 1]}m`);
        }
    }

    workingResultAsJson() {
        const pointCollection = this._gcpMouseHandler.pointCollection;

        const points = [];

        for (let i = 0; i < pointCollection.length; i++) {
            const position = pointCollection.get(i).position;

            points.push([position.x, position.y, position.z]);
        }

        const textFields = [];

        const jQuery = window.jQuery;

        for (let i = 1; i <= this._GCPCount; i++) {
            const jQGCPLatitude = jQuery(`#gcp${i}_latitude`);
            const jQGCPLongitude = jQuery(`#gcp${i}_longitude`);
            const jQGCAltitude = jQuery(`#gcp${i}_altitude`);

            textFields.push([jQGCPLongitude.val(), jQGCPLatitude.val(), jQGCAltitude.val()]);
        }

        let altitudeOffset = parseFloat(jqAltitudeOffset.val() as string);

        if (Number.isNaN(altitudeOffset)) altitudeOffset = 0;

        return JSON.stringify({
            altitudeOffset: altitudeOffset,
            points: points,
            textFields: textFields
        });
    }

    get GCPCount() {
        return this._GCPCount;
    }

    ignoreWorkingResult() {
        this._calculated = false;
    }

    get calculated() {
        return this._calculated;
    }

    clear() {
        const jQuery = window.jQuery;

        for (let i = 0; i < this._GCPCount; i++) {
            jQuery(`#gcp${i + 1}_latitude`).val("");
            jQuery(`#gcp${i + 1}_longitude`).val("");
            jQuery(`#gcp${i + 1}_altitude`).val("");
        }

        for (let i = 3; i < this._GCPCount; i++) {
            jQuery(`#gcp${i}`).remove();
        }

        jqAltitudeOffset.val(0);

        this._GCPCount = 3;
        this._calculated = false;

        this._gcpMouseHandler.clear();
        this._gcpMouseHandler.deactivate();
    }

    isEmpty() {
        if (this._gcpMouseHandler.count() > 0) {
            return false;
        }

        return true;
    }

    static instance() {
        if (!GCPManager._instance) {
            console.error("oop");
        }

        return GCPManager._instance;
    }
}
