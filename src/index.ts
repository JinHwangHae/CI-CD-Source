/* qeslint-disable */
/* eslint-disable complexity */
// q@ts-nocheck

import { GroundPrimitive, Ion, HomeButton } from "cesium";

import { initSidebar } from "./initSidebar";
import { initNavigationHelpPopup } from "./initNavigationHelpPopup";
import { overrideCesiumCamera } from "./overrideCesiumCamera";
import { isGw4, isLocal } from "./construkted";
import initInfoPopup from "./initInfoPopup";
import { initAnnotationTools } from "./annotationTools";
import initAnnotaionsPopup from "./initAnnotationsPopup";
import initViewPopup from "./initViewPopup";
import initSettingsPopup from "./initSettingsPopup";
import { initAssetManagerPopup } from "./initAssetManagerPopup";
import { GlobeDisplayStatus } from "./global";
import { custom } from "./custom";
import initFilterPopup from "./initFilterPopup";

import mobileActions from "./mobile";
import {
    AssetGeoLocation,
    ConstruktedAjax,
    ConstruktedAssetType,
    ConstruktedTransformEditors,
    ParsedConstruktedAjax
} from "./types/common";

import { parseGeolocaton } from "./parseAjax";
import Construkted from "./Construkted1";
import { initLocalTests } from "./initLocalTests";
import { AngleUnits, AreaUnits, DistanceUnits, VolumeUnits } from "./core";
import { fetchLocalData } from "./fetchLocalData";
import pkg from "../package.json";

// ajax parameter from WP

const jQuery = window.jQuery;

/*
    for example
    https://construkted.com/asset/arkcnfuk9fw/
*/

function validAssetGeolocation(geolocation: AssetGeoLocation) {
    if (geolocation.longitude === 0 && geolocation.latitude === 0) {
        return false;
    }

    return true;
}

function getParsedConstruktedAjax() {
    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX as unknown as ConstruktedAjax;
    const parsedConstruktedAjax = { ...CONSTRUKTED_AJAX } as unknown as ParsedConstruktedAjax;

    if (CONSTRUKTED_AJAX.asset_geo_location && CONSTRUKTED_AJAX.asset_geo_location !== "") {
        parsedConstruktedAjax.asset_geo_location = parseGeolocaton(CONSTRUKTED_AJAX.asset_geo_location);
    } else {
        parsedConstruktedAjax.asset_geo_location = undefined;
    }

    if (CONSTRUKTED_AJAX.asset_geo_location_by_pre && CONSTRUKTED_AJAX.asset_geo_location_by_pre !== "") {
        parsedConstruktedAjax.asset_geo_location_by_pre = parseGeolocaton(CONSTRUKTED_AJAX.asset_geo_location_by_pre);
    } else {
        parsedConstruktedAjax.asset_geo_location_by_pre = undefined;
    }

    if (CONSTRUKTED_AJAX.asset_geo_location_by_gcps && CONSTRUKTED_AJAX.asset_geo_location_by_gcps !== "") {
        parsedConstruktedAjax.asset_geo_location_by_gcps = parseGeolocaton(CONSTRUKTED_AJAX.asset_geo_location_by_gcps);
    } else {
        parsedConstruktedAjax.asset_geo_location_by_gcps = undefined;
    }

    parsedConstruktedAjax.is_owner = Boolean(CONSTRUKTED_AJAX.is_owner);

    const defaultBackgroundColorStringOfNonGeoReferencedAsset = "#333333";

    if (!CONSTRUKTED_AJAX.bg_color_css_string || CONSTRUKTED_AJAX.bg_color_css_string === "") {
        parsedConstruktedAjax.bg_color_css_string = defaultBackgroundColorStringOfNonGeoReferencedAsset;
    }

    if (
        CONSTRUKTED_AJAX.asset_is_underground === "" ||
        CONSTRUKTED_AJAX.asset_is_underground === "false" ||
        CONSTRUKTED_AJAX.asset_is_underground === undefined
    ) {
        parsedConstruktedAjax.asset_is_underground = false;
    } else {
        parsedConstruktedAjax.asset_is_underground = true;
    }

    if (
        CONSTRUKTED_AJAX.ignore_original_transform === "" ||
        CONSTRUKTED_AJAX.ignore_original_transform === "false" ||
        CONSTRUKTED_AJAX.ignore_original_transform === undefined
    ) {
        parsedConstruktedAjax.ignore_original_transform = false;
    } else {
        parsedConstruktedAjax.ignore_original_transform = Boolean(CONSTRUKTED_AJAX.ignore_original_transform);
    }

    if (
        CONSTRUKTED_AJAX.globe_display_status === "unknown" ||
        CONSTRUKTED_AJAX.globe_display_status === "" ||
        CONSTRUKTED_AJAX.globe_display_status === undefined
    ) {
        parsedConstruktedAjax.globe_display_status = GlobeDisplayStatus.Unknown;
    } else if (CONSTRUKTED_AJAX.globe_display_status === GlobeDisplayStatus.Submitted) {
        parsedConstruktedAjax.globe_display_status = GlobeDisplayStatus.Submitted;
    } else if (CONSTRUKTED_AJAX.globe_display_status === GlobeDisplayStatus.Approved) {
        parsedConstruktedAjax.globe_display_status = GlobeDisplayStatus.Approved;
    } else {
        throw new Error("unexpected globe_display_status");
    }

    if (CONSTRUKTED_AJAX.gcp && CONSTRUKTED_AJAX.gcp !== "") {
        parsedConstruktedAjax.gcp = JSON.parse(CONSTRUKTED_AJAX.gcp);
    } else {
        parsedConstruktedAjax.gcp = undefined;
    }

    if (
        CONSTRUKTED_AJAX.default_camera_position_direction &&
        CONSTRUKTED_AJAX.default_camera_position_direction !== ""
    ) {
        parsedConstruktedAjax.default_camera_position_direction = JSON.parse(
            CONSTRUKTED_AJAX.default_camera_position_direction
        );
    } else {
        parsedConstruktedAjax.default_camera_position_direction = undefined;
    }

    parsedConstruktedAjax.active_editor = CONSTRUKTED_AJAX.active_editor;

    if (CONSTRUKTED_AJAX.asset_geo_location && !CONSTRUKTED_AJAX.gcp && !parsedConstruktedAjax.active_editor) {
        parsedConstruktedAjax.active_editor = ConstruktedTransformEditors.VisualPositionEditor;
    }

    if (!CONSTRUKTED_AJAX.asset_geo_location && CONSTRUKTED_AJAX.gcp && !parsedConstruktedAjax.active_editor) {
        parsedConstruktedAjax.active_editor = ConstruktedTransformEditors.MultiGCPsEditor;
    }

    if (!parsedConstruktedAjax.active_editor) {
        parsedConstruktedAjax.active_editor = ConstruktedTransformEditors.VisualPositionEditor;
    }

    parsedConstruktedAjax.terrain_imagery_enabled = CONSTRUKTED_AJAX.terrain_imagery_enabled === "true";

    // in case assets created by old verson, CONSTRUKTED_AJAX will not have terrain_imagery_enabled property

    if (
        parsedConstruktedAjax.asset_geo_location &&
        validAssetGeolocation(parsedConstruktedAjax.asset_geo_location) &&
        CONSTRUKTED_AJAX.terrain_imagery_enabled === undefined
    ) {
        parsedConstruktedAjax.terrain_imagery_enabled = true;
    }

    if (
        parsedConstruktedAjax.asset_geo_location &&
        validAssetGeolocation(parsedConstruktedAjax.asset_geo_location) &&
        CONSTRUKTED_AJAX.terrain_imagery_enabled === ""
    ) {
        parsedConstruktedAjax.terrain_imagery_enabled = true;
    }

    if (CONSTRUKTED_AJAX.asset_type) {
        parsedConstruktedAjax.asset_type = <ConstruktedAssetType>CONSTRUKTED_AJAX.asset_type;
    } else {
        parsedConstruktedAjax.asset_type = ConstruktedAssetType.Unknown;
    }

    if (CONSTRUKTED_AJAX.depth_test_against_terrain) {
        parsedConstruktedAjax.depth_test_against_terrain = CONSTRUKTED_AJAX.depth_test_against_terrain === "true";
    } else {
        parsedConstruktedAjax.depth_test_against_terrain = false;
    }

    if (
        CONSTRUKTED_AJAX.new_style_url === "" ||
        CONSTRUKTED_AJAX.new_style_url === "false" ||
        CONSTRUKTED_AJAX.new_style_url === undefined
    ) {
        parsedConstruktedAjax.new_style_url = false;
    } else {
        parsedConstruktedAjax.new_style_url = Boolean(CONSTRUKTED_AJAX.new_style_url);
    }

    parsedConstruktedAjax.length_unit = DistanceUnits.METERS;
    parsedConstruktedAjax.area_unit = AreaUnits.SQUARE_METERS;
    parsedConstruktedAjax.volume_unit = VolumeUnits.CUBIC_METERS;
    parsedConstruktedAjax.angle_unit = AngleUnits.DEGREES;

    if (CONSTRUKTED_AJAX.length_unit && CONSTRUKTED_AJAX.length_unit !== "") {
        parsedConstruktedAjax.length_unit = CONSTRUKTED_AJAX.length_unit as unknown as DistanceUnits;
    }

    if (CONSTRUKTED_AJAX.area_unit && CONSTRUKTED_AJAX.area_unit !== "") {
        parsedConstruktedAjax.area_unit = CONSTRUKTED_AJAX.area_unit as unknown as AreaUnits;
    }

    if (CONSTRUKTED_AJAX.volume_unit && CONSTRUKTED_AJAX.volume_unit !== "") {
        parsedConstruktedAjax.volume_unit = CONSTRUKTED_AJAX.volume_unit as unknown as VolumeUnits;
    }

    if (CONSTRUKTED_AJAX.angle_unit && CONSTRUKTED_AJAX.angle_unit !== "") {
        parsedConstruktedAjax.angle_unit = CONSTRUKTED_AJAX.angle_unit as unknown as AngleUnits;
    }

    if (
        CONSTRUKTED_AJAX.originally_georeferenced === "" ||
        CONSTRUKTED_AJAX.originally_georeferenced === "false" ||
        CONSTRUKTED_AJAX.originally_georeferenced === undefined
    ) {
        parsedConstruktedAjax.originally_georeferenced = false;
    } else {
        parsedConstruktedAjax.originally_georeferenced = Boolean(CONSTRUKTED_AJAX.originally_georeferenced);
    }

    return parsedConstruktedAjax;
}

function runViewer() {
    initNavigationHelpPopup();

    overrideCesiumCamera();

    const parsedConstruktedAjax = getParsedConstruktedAjax();

    window.CONSTRUKTED_AJAX = parsedConstruktedAjax;

    window.Construkted = new Construkted({
        ajax: parsedConstruktedAjax
    });

    if (isLocal() && window.location.port !== "") {
        initLocalTests();
    }

    jQuery(document).on("click", ".construkted-viewer-controlbar-button", function () {
        jQuery(".construkted-viewer-controlbarContainer").toggleClass("shown");
        jQuery(".ck-view-mobile-selector")
            .addClass("active")
            // @ts-ignore
            .html(`${jQuery(this).html()}<i class="icon-down"></i>`);
    });

    initSidebar();
    initAnnotationTools();
    initAnnotaionsPopup();
    initInfoPopup();
    initViewPopup();
    initSettingsPopup();
    initAssetManagerPopup();
    initFilterPopup();
    custom(jQuery);
    mobileActions(jQuery);
}

jQuery(document).ready(async () => {
    window.$ = jQuery;
    console.info("ConstruktedJs version", pkg.version);

    jQuery.fn.doubletap =
        jQuery.fn.doubletap ||
        function (handler: any, delay: any) {
            // eslint-disable-next-line no-param-reassign
            delay = delay == null ? 300 : delay;
            // @ts-ignore
            this.bind("touchend", function (event: any) {
                const now = new Date().getTime();
                // The first time this will make delta a negative number.
                // @ts-ignore
                const lastTouch = $(this).data("lastTouch") || now + 1;
                const delta = now - lastTouch;
                if (delta < delay && delta > 0) {
                    // After we detect a doubletap, start over.
                    // @ts-ignore
                    $(this).data("lastTouch", null);
                    if (handler !== null && typeof handler === "function") {
                        handler(event);
                    }
                } else {
                    // @ts-ignore
                    $(this).data("lastTouch", now);
                }
            });
        };

    if (isLocal()) {
        console.info("original CONSTRUKTED_AJAX", window.CONSTRUKTED_AJAX);
        console.info(JSON.stringify(window.CONSTRUKTED_AJAX));

        console.info("original project_assets", window.project_assets);
        console.info(JSON.stringify(window.project_assets));

        if (window.CONSTRUKTED_AJAX === undefined) {
            window.CONSTRUKTED_AJAX = await fetchLocalData("construktedAjax.json");
            console.warn("app is using configured ConstruktedAjax");
        }

        const config = await fetchLocalData("config.json");

        window.localConfig = config;

        if (config && config.useLocalData) {
            window.CONSTRUKTED_AJAX = await fetchLocalData("construktedAjax.json");
            console.warn("app is using configured CONSTRUKTED_AJAX", window.CONSTRUKTED_AJAX);

            if (window.CONSTRUKTED_AJAX.post_slug[0] === "p") {
                window.project_assets = await fetchLocalData("projectAssets.json");
                console.warn("app is using configured project_assets", window.project_assets);

                window.annotations = await fetchLocalData("annotations.json");
                console.warn("app is using configured annotations", window.annotations);
            }
        }
    }

    if (isGw4()) {
        console.info("original CONSTRUKTED_AJAX", window.CONSTRUKTED_AJAX);
        console.info(JSON.stringify(window.CONSTRUKTED_AJAX));

        console.info("original project_assets", window.project_assets);
        console.info(JSON.stringify(window.project_assets));
    }

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    Ion.defaultAccessToken = CONSTRUKTED_AJAX.cesium_access_token;

    if (!Ion.defaultAccessToken) console.warn("default access token is null!");

    if (!CONSTRUKTED_AJAX.is_embed) {
        GroundPrimitive.initializeTerrainHeights().then(() => {
            runViewer();
        });
    } else {
        jQuery("#loadThisUp").click(() => {
            runViewer();
            jQuery("#embedFeaturedImage").remove();
            jQuery("#loadThisUp").remove();

            const container = document.getElementsByClassName("cesium-viewer-fullscreenContainer")[0];
            const scene = window.construktedAssetViewer?.viewer?.scene;

            if (scene) {
                // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
                const homeButton = new HomeButton(container, scene, 1.5);
            }
        });
    }
});
