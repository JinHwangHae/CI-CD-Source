/* qeslint-disable */

import { Viewer } from "cesium";

import { TilesetAsset } from "./core";
import { ConstruktedTransformEditors } from "./types/common";

/**
 * @param viewData example '{"offsetX":-320.85048515722156,"offsetY":410.6698936629109,"offsetZ":-63.89644116954878,"heading":3.205999118915225e-12,"pitch":-45.00333354841172,"roll":360}'
 */
export function saveCurrentView(viewData: string) {
    const jQuery = window.jQuery;

    const jqSaveCurrentViewButton = jQuery("#save_current_view");

    jqSaveCurrentViewButton.prop("disabled", true);
    jQuery(".ck-processing-loader").addClass("shown");

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    jQuery.ajax({
        url: CONSTRUKTED_AJAX.ajaxurl,
        type: "post",
        data: {
            action: "post_set_current_view",
            post_id: CONSTRUKTED_AJAX.post_id,
            view_data: viewData
        },
        success: function (/* response: any */) {
            jqSaveCurrentViewButton.prop("disabled", false);
            jQuery(".ck-processing-loader").removeClass("shown");
        },
        error: function () {
            jqSaveCurrentViewButton.prop("disabled", false);
            jQuery(".ck-processing-loader").removeClass("shown");
            alert("error");
        }
    });
}

/**
 * Save the default viewpoint ID
 * @param viewpointId The ID of the viewpoint to set as default
 */
export function saveDefaultViewpointId(viewpointId: string) {
    const jQuery = window.jQuery;
    jQuery(".ck-processing-loader").addClass("shown");

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    return jQuery.ajax({
        url: CONSTRUKTED_AJAX.ajaxurl,
        type: "post",
        data: {
            action: "post_set_default_viewpoint_id",
            post_id: CONSTRUKTED_AJAX.post_id,
            viewpoint_id: viewpointId
        },
        success: function () {
            jQuery(".ck-processing-loader").removeClass("shown");
        },
        error: function () {
            jQuery(".ck-processing-loader").removeClass("shown");
            alert("Error saving default viewpoint");
        }
    });
}

export function resetCameraView() {
    const jQuery = window.jQuery;

    const jqResetCameraViewButton = jQuery("#reset_camera_view");

    jqResetCameraViewButton.prop("disabled", true);
    jQuery(".ck-processing-loader").addClass("shown");

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    jQuery.ajax({
        url: CONSTRUKTED_AJAX.ajaxurl,
        type: "post",
        data: {
            action: "post_reset_current_view",
            post_id: CONSTRUKTED_AJAX.post_id
        },
        success: function (/* response: any */) {
            jqResetCameraViewButton.prop("disabled", false);
            jQuery(".ck-processing-loader").removeClass("shown");
        },
        error: function () {
            jqResetCameraViewButton.prop("disabled", false);
            jQuery(".ck-processing-loader").removeClass("shown");
            alert("error");
        }
    });
}

export function captureThumbnail(viewer: Viewer, button: any) {
    const jQuery = window.jQuery;

    const jqCaptureThumbnailButton = jQuery(button);

    jQuery(".ck-processing-loader").addClass("shown");

    viewer.scene.requestRender();
    viewer.render();

    const mediumQuality = viewer.canvas.toDataURL("image/jpeg", 0.5);

    jqCaptureThumbnailButton.prop("disabled", true);
    jqCaptureThumbnailButton.addClass("disabled");
    const postId = jqCaptureThumbnailButton.attr("data-post-id");
    const nonce = jqCaptureThumbnailButton.attr("data-nonce");

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    jQuery
        .ajax({
            url: CONSTRUKTED_AJAX.ajaxurl,
            type: "post",
            data: {
                action: "post_set_thumbnail",
                post_id: postId,
                nonce: nonce,
                capturedJpegImage: mediumQuality
            },
            success: function (response: any) {
                jqCaptureThumbnailButton.prop("disabled", false);
                jQuery(".ck-processing-loader").removeClass("shown");

                if (!response.success) {
                    alert(response);
                } else {
                    // eslint-disable-next-line no-lonely-if
                    if (jQuery(button).attr("id") === "capture-annotation-view") {
                        if (jQuery(".annotation-image-holder img").length) {
                            jQuery(".annotation-image-holder img").attr("src", response.data);
                        } else {
                            jQuery(".ck-featimg-line-item").remove();
                            jQuery("label.file-uploader-label[for='annotation-image']").before(
                                `<div class="annotation-image-holder"><img src="${response.data}" /></div>`
                            );
                        }
                    } else {
                        const removeButton = `<a href="#" data-post-id="${postId}" data-nonce="${response.nonce}" class="remove-capture">Delete</a>`;
                        if (
                            jQuery("#post-featured-image").length > 0 &&
                            jQuery("#post-featured-image img").length > 0
                        ) {
                            jQuery("#post-featured-image").append(removeButton);
                            jQuery("#post-featured-image img").attr("src", response.data);
                        } else {
                            jQuery(button).before(
                                `<div id="post-featured-image"><img src="${response.data}" />${removeButton}</div>`
                            );
                        }

                        jQuery(button)
                            .parent()
                            .append(
                                `<div id="thumnails-saved" class="ck-toolbar-alert"><i class="icon-tick"></i> View saved successfully!</div>`
                            );

                        setTimeout(() => {
                            jQuery("#thumnails-saved").remove();
                        }, 3000);
                    }
                }
            },
            error: function () {
                // jqCaptureThumbnailButton.prop('disabled', false);
                // jQuery('.ck-processing-loader').removeClass('shown');
                alert("There was an error");
            }
        })
        .done(() => {
            jqCaptureThumbnailButton.prop("disabled", false);
            jqCaptureThumbnailButton.removeClass("disabled");
            jQuery(".ck-processing-loader").removeClass("shown");
        });
}

export function removeThumbnail(button: any) {
    const jQuery = window.jQuery;

    jQuery(".ck-processing-loader").addClass("shown");

    jQuery(button).prop("disabled", true);
    jQuery(button).addClass("disabled");
    const postId = jQuery(button).attr("data-post-id");
    const nonce = jQuery(button).attr("data-nonce");

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    jQuery
        .ajax({
            url: CONSTRUKTED_AJAX.ajaxurl,
            type: "post",
            data: {
                action: "post_delete_capture",
                post_id: postId,
                nonce: nonce
            },
            success: function (response: any) {
                button.prop("disabled", false);
                jQuery(".ck-processing-loader").removeClass("shown");

                if (!response.success) {
                    alert(response);
                } else {
                    // eslint-disable-next-line no-lonely-if
                    if (jQuery(button).attr("id") === "capture-annotation-view") {
                        jQuery(".annotation-image-holder").remove();
                        jQuery(".ck-featimg-line-item").remove();
                    } else {
                        jQuery("#post-featured-image").remove();
                        jQuery(button)
                            .parent()
                            .append(
                                `<div id="thumnails-removed" class="ck-toolbar-alert"><i class="icon-tick"></i> Capture deleted successfully!</div>`
                            );

                        setTimeout(() => {
                            jQuery("#thumnails-removed").remove();
                        }, 3000);
                    }
                }
            },
            error: function () {
                alert("There was an error");
            }
        })
        .done(() => {
            jQuery(button).prop("disabled", false);
            jQuery(button).removeClass("disabled");
            jQuery(".ck-processing-loader").removeClass("shown");
        });
}

function disableControls(jqControls: any[]) {
    jqControls.forEach((jqControl) => {
        jqControl.prop("disabled", true);
    });
}

function enableControls(jqControls: any[]) {
    jqControls.forEach((jqControl) => {
        jqControl.prop("disabled", false);
    });
}

export async function saveActiveEditor(activeEditor: string, successCb: () => void) {
    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;
    const jQuery = window.jQuery;

    const data = {
        action: "set_asset_active_editor",
        post_id: CONSTRUKTED_AJAX.post_id,
        active_editor: activeEditor
    };

    jQuery(".ck-processing-loader").addClass("shown");

    await jQuery.ajax({
        url: CONSTRUKTED_AJAX.ajaxurl,
        type: "post",
        data: data,
        success: function (response: { success: boolean; message: string }) {
            jQuery(".ck-processing-loader").removeClass("shown");

            if (response.success === false) {
                jQuery(".ck-error-loader").addClass("shown");
                alert(response.message);
                return;
            }

            successCb();
        }
    });
}

export interface SaveGeolocationOptions {
    activeEditor: ConstruktedTransformEditors;
    asset: TilesetAsset;
    GCPJSONString: string | undefined;
    isUnderground: boolean;
    terrainImageryEnabled: boolean;
    jqControls: any[];
}

export async function saveGeolocation(options: SaveGeolocationOptions, successCb: () => void) {
    const asset = options.asset;
    const geolocation = asset.calculateGeolocation(true);

    let ret = false;
    const jQuery = window.jQuery;
    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    const data = {
        action: "set_asset_geo_location",
        post_id: CONSTRUKTED_AJAX.post_id,
        active_editor: options.activeEditor,
        asset_geo_location_json: JSON.stringify(geolocation),
        terrain_imagery_enabled: options.terrainImageryEnabled,
        asset_is_underground: options.isUnderground,
        asset_gcp_json: options.GCPJSONString
    };

    const jqControls = options.jqControls;

    disableControls(jqControls);

    jQuery(".ck-processing-loader").addClass("shown");

    await jQuery.ajax({
        url: CONSTRUKTED_AJAX.ajaxurl,
        type: "post",
        data: data,
        success: function (response: { success: boolean; message: string }) {
            enableControls(jqControls);
            jQuery(".ck-processing-loader").removeClass("shown");

            if (response.success === false) {
                alert(response.message);
                return false;
            }

            CONSTRUKTED_AJAX.active_editor = options.activeEditor;

            if (options.activeEditor === ConstruktedTransformEditors.VisualPositionEditor) {
                CONSTRUKTED_AJAX.asset_geo_location = geolocation;
            } else if (options.activeEditor === ConstruktedTransformEditors.PredefinedGeoreference) {
                CONSTRUKTED_AJAX.asset_geo_location_by_pre = geolocation;
            } else if (options.activeEditor === ConstruktedTransformEditors.MultiGCPsEditor) {
                if (options.GCPJSONString) {
                    CONSTRUKTED_AJAX.asset_geo_location_by_gcps = geolocation;
                    CONSTRUKTED_AJAX.gcp = JSON.parse(options.GCPJSONString);
                } else {
                    CONSTRUKTED_AJAX.asset_geo_location_by_gcps = undefined;
                    CONSTRUKTED_AJAX.gcp = undefined;
                }
            }

            CONSTRUKTED_AJAX.terrain_imagery_enabled = options.terrainImageryEnabled;
            CONSTRUKTED_AJAX.asset_is_underground = options.isUnderground;

            successCb();

            ret = true;

            return ret;
        },
        error: function () {
            enableControls(jqControls);
            jQuery(".ck-processing-loader").removeClass("shown");

            successCb();
            alert("error");
        },
        done: function () {
            return ret;
        }
    });

    return ret;
}

export function saveIgnoreOriginalTransform(ignoreOriginalTransform: boolean) {
    const jQuery = window.jQuery;

    jQuery(".ck-processing-loader").addClass("shown");

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    jQuery.ajax({
        url: CONSTRUKTED_AJAX.ajaxurl,
        type: "post",
        data: {
            action: "set_asset_ignore_original_transform",
            post_id: CONSTRUKTED_AJAX.post_id,
            ignore_original_transform: ignoreOriginalTransform
        },
        success: function (/* response: any */) {
            jQuery(".ck-processing-loader").removeClass("shown");
        },
        error: function () {
            jQuery(".ck-processing-loader").removeClass("shown");
            alert("error");
        }
    });
}

export function submitAssetGlobeStatusDisplay(successCb: any, errorCb: any) {
    const jQuery = window.jQuery;

    jQuery(".ck-processing-loader").addClass("shown");

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    jQuery.ajax({
        url: CONSTRUKTED_AJAX.ajaxurl,
        type: "post",
        data: {
            action: "submit_asset_globe_display_status",
            post_id: CONSTRUKTED_AJAX.post_id
        },
        success: function (response: any) {
            jQuery(".ck-processing-loader").removeClass("shown");

            // eslint-disable-next-line no-param-reassign
            response = JSON.parse(response);

            if (response.ret) {
                if (successCb) successCb();
            } else {
                alert("Failed to submit!");

                if (errorCb) errorCb();
            }
        },
        error: function () {
            if (errorCb) errorCb();

            jQuery(".ck-processing-loader").removeClass("shown");
            alert("error");
        }
    });
}

export function removeAssetFromGlobe(successCb: any, errorCb: any) {
    const jQuery = window.jQuery;

    jQuery(".ck-processing-loader").addClass("shown");

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    jQuery.ajax({
        url: CONSTRUKTED_AJAX.ajaxurl,
        type: "post",
        data: {
            action: "remove_asset_from_globe",
            post_id: CONSTRUKTED_AJAX.post_id
        },
        success: function (response: any) {
            jQuery(".ck-processing-loader").removeClass("shown");

            // eslint-disable-next-line no-param-reassign
            response = JSON.parse(response);

            if (response.ret) {
                if (successCb) successCb();
            } else {
                alert("Failed to remove!");

                if (errorCb) errorCb();
            }
        },
        error: function () {
            if (errorCb) errorCb();

            jQuery(".ck-processing-loader").removeClass("shown");
            alert("error");
        }
    });
}

export function saveSceneBackgroundColor(cssColor: string) {
    const jQuery = window.jQuery;

    jQuery(".ck-processing-loader").addClass("shown");

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    jQuery.ajax({
        url: CONSTRUKTED_AJAX.ajaxurl,
        type: "post",
        data: {
            action: "set_bg_color",
            post_id: CONSTRUKTED_AJAX.post_id,
            bg_color: cssColor
        },
        success: function (/* response: any */) {
            window.CONSTRUKTED_AJAX.bg_color_css_string = cssColor;
            jQuery(".ck-processing-loader").removeClass("shown");
        },
        error: function () {
            jQuery(".ck-processing-loader").removeClass("shown");
            alert("error");
        }
    });
}

export function saveDepthTestAgainstTerrain(val: boolean) {
    const jQuery = window.jQuery;

    jQuery(".ck-processing-loader").addClass("shown");

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    jQuery.ajax({
        url: CONSTRUKTED_AJAX.ajaxurl,
        type: "post",
        data: {
            action: "set_depth_test_against_terrain",
            post_id: CONSTRUKTED_AJAX.post_id,
            depth_test_against_terrain: val
        },
        success: function (/* response: any */) {
            window.CONSTRUKTED_AJAX.depth_test_against_terrain = val;
            jQuery(".ck-processing-loader").removeClass("shown");
        },
        error: function () {
            jQuery(".ck-processing-loader").removeClass("shown");
            alert("error");
        }
    });
}

export function getOriginallyGeoreferenced(cb: (response: { originally_georeferenced: string }) => void) {
    const jQuery = window.jQuery;

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    jQuery.ajax({
        url: CONSTRUKTED_AJAX.ajaxurl,
        type: "post",
        data: {
            action: "get_originally_georeferenced",
            post_id: CONSTRUKTED_AJAX.post_id
        },
        success: function (responseJsonString: string) {
            cb(JSON.parse(responseJsonString));
        },
        error: function (e: any) {
            console.error(e);
        }
    });
}

export function setOriginallyGeoreferenced() {
    const jQuery = window.jQuery;

    const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;

    jQuery.ajax({
        url: CONSTRUKTED_AJAX.ajaxurl,
        type: "post",
        data: {
            action: "set_originally_georeferenced",
            post_id: CONSTRUKTED_AJAX.post_id
        },
        success: function (/* response: any */) {},
        error: function (e: any) {
            console.error(e);
        }
    });
}
