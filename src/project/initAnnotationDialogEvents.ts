import { Color } from "cesium";

import { NoteDrawing, PaintDrawing, PolylineDrawing, PolygonDrawing } from "../tools";

import { ConstruktedDrawingTypes, getDrawing, toggleAnnotationDetailsWindowPosition } from "./common";

import createAnnotation from "./createAnnotation";
import { DrawingType } from "../tools/annotation/drawing/common";
import { initClippingBoxRelativeEvents } from "./initClippingBoxRelativeEvents";
import { initPlaceImageRelativeEvents } from "./initPlaceImageRelativeEvents";

export default function initAnnotationDialogEvents() {
    const jQuery = window.jQuery;

    const generateAnnotationDetailsTooltip = (annotationId: string) => {
        const annotation = window.Construkted.project.getAnnotationById(annotationId);
        if (!annotation || !annotation.author || annotation.author.name.length === 0) return "";
        const author = annotation.author.name;
        const date = annotation.date;

        return `<div class="annotation-info-box"><span>Created by <strong>${author}</strong></span> on <em>${date}</em></div>`;
    };

    jQuery(document)
        .on("mouseenter", ".annotation-line-item .annotation-title", function (this: HTMLElement) {
            const hoveredItem = jQuery(this).parent();

            if (hoveredItem.find(".annotation-info-box").length !== 0 || hoveredItem.hasClass("hovered")) return;

            hoveredItem.addClass("hovered");

            const currentAnnotationId = jQuery(hoveredItem).attr("data-entity-id");
            const tooltip = generateAnnotationDetailsTooltip(currentAnnotationId as string);

            hoveredItem.append(tooltip);
        })
        .on("mouseleave", ".annotation-line-item .annotation-title", function (this: HTMLElement) {
            const hoveredItem = jQuery(this).parent();
            jQuery(".annotation-info-box").remove();
            hoveredItem.removeClass("hovered");
        });

    jQuery(document).on("keyup", "#annotation-title", function (this: HTMLElement) {
        const title = jQuery(this).val() as string;
        const annotationType = jQuery("#annotation-type").val();

        if (annotationType === ConstruktedDrawingTypes.Note) {
            const drawing = getDrawing();

            if (drawing) {
                (drawing as NoteDrawing).label.text = title;
            }
        }
    });

    const hex2rgba = (hex: string, opacity: number) => {
        let c;

        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            c = hex.substring(1).split("");

            if (c.length === 3) {
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }

            // eslint-disable-next-line prefer-template
            c = ("0x" + c.join("")) as any;

            // eslint-disable-next-line prefer-template, no-bitwise
            return "rgba(" + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(",") + "," + opacity + ")";
        }

        throw new Error("Bad Hex");
    };

    const changeAnnotationColor = () => {
        const drawing = getDrawing();

        if (!drawing) {
            return;
        }

        // ex rgba(255,255,0,1)
        let colorString = jQuery(".add-annotation").find(".ck-color-option.selected").attr("data-value") as string;
        const opacity = jQuery("#annotation-color-opacity").val() as number;
        colorString = hex2rgba(colorString, opacity / 100);
        const color = Color.fromCssColorString(colorString);
        drawing.setColor(color);

        jQuery("#color-picker-activator").css("background", colorString);
    };

    jQuery(".add-annotation")
        .find(".ck-color-option")
        .click(function (this: HTMLElement) {
            jQuery(this).addClass("selected").siblings().removeClass("selected");

            // Get the selected opacity
            const opacity = jQuery("#annotation-color-opacity").val() as number;

            jQuery("#annotation-color")
                .val(hex2rgba(jQuery(this).attr("data-value") as string, opacity / 100))
                .trigger("change");

            jQuery("#color-picker-activator").css(
                "background",
                hex2rgba(jQuery(this).attr("data-value") as string, opacity / 100)
            );
        });

    jQuery(document).on("change", "#annotation-color", () => {
        changeAnnotationColor();
    });

    jQuery(document).on("input change", "#annotation-color-opacity", () => {
        let color = jQuery(".ck-color-option.selected").attr("data-value") as string;
        const opacity = jQuery("#annotation-color-opacity").val() as number;
        color = hex2rgba(color, opacity / 100);

        jQuery("#annotation-color").val(color);
        changeAnnotationColor();
    });

    jQuery(document).on("change", "#annotation-line-width", function (this: HTMLElement) {
        const value = jQuery(this).val() as string;
        const annotationType = jQuery("#annotation-type").val();

        const drawing = getDrawing();

        if (!drawing) {
            return;
        }

        if (annotationType === ConstruktedDrawingTypes.Polyline) {
            (drawing as PolylineDrawing).polylinePrimitive.width = parseInt(value, 10);
        } else if (annotationType === ConstruktedDrawingTypes.Paint) {
            (drawing as PaintDrawing).polylinePrimitive.width = parseInt(value, 10);
        }
    });

    jQuery(document).on("change", "#annotation-drape-over-geometry", function (this: HTMLInputElement) {
        const annotationType = jQuery("#annotation-type").val();
        const drawing = getDrawing();

        if (!drawing) {
            return;
        }

        const checked = this.checked;

        if (annotationType === ConstruktedDrawingTypes.Polyline) {
            (drawing as PolylineDrawing).polylinePrimitive.clampToGround = checked;
        }

        if (annotationType === ConstruktedDrawingTypes.Polygon) {
            (drawing as PolygonDrawing).polylinePrimitive.clampToGround = checked;
            (drawing as PolygonDrawing).polygon.polygonPrimitive.clampToGround = checked;

            window.Construkted.drawingTools.updateDrawings();
        }
    });

    jQuery(document).on("change", "#annotation-show-note-pin", function (this: HTMLElement) {
        const drawing = getDrawing();

        if (drawing && drawing.type === DrawingType.Note) {
            (drawing as NoteDrawing).showHideBillboard(jQuery(this).prop("checked"));
        }
    });

    jQuery(document).on("change", "#annotation-show-note-text", function (this: HTMLElement) {
        const drawing = getDrawing();

        if (drawing && drawing.type === DrawingType.Note) {
            (drawing as NoteDrawing).showHideLabel(jQuery(this).prop("checked"));
        }
    });

    jQuery(document).on("change", "#annotation-show-note-leader", function (this: HTMLElement) {
        const drawing = getDrawing();

        if (drawing && drawing.type === DrawingType.Note) {
            (drawing as NoteDrawing).showHideLeader(jQuery(this).prop("checked"));
        }
    });

    jQuery(document).on("change", "#annotation-image", function (this: HTMLElement) {
        const items = jQuery(this);

        jQuery.each(items, (i: any, obj: any) => {
            jQuery.each(obj.files, (j: any, file: any) => {
                jQuery(items)
                    .prev()
                    .before(
                        `<div class="ck-featimg-line-item px-2 py-2 make-flex make-rounded mb-1 make-bg-gray-50">${file.name}</div>`
                    );
            });
        });

        jQuery("#annotation-capture").val("");
    });

    jQuery(() => {
        jQuery('[name="ck-modal-position"]').on("change", function (this: HTMLElement) {
            // Set the cookie for the modal position
            jQuery.cookie("ck-modal-position", jQuery(this).val(), { expires: 365 });
        });

        jQuery(document).on("click", ".pin-note-left", () => {
            jQuery('[name="ck-modal-position"][value="left"]').trigger("click");
            jQuery.cookie("ck-modal-position", "left", { expires: 365 });
            toggleAnnotationDetailsWindowPosition("left");
        });
        jQuery(document).on("click", ".make-note-floating", () => {
            jQuery('[name="ck-modal-position"][value="floating"]').trigger("click");
            jQuery.cookie("ck-modal-position", "floating", { expires: 365 });
            toggleAnnotationDetailsWindowPosition("floating");
        });
        jQuery(document).on("click", "#color-picker-activator", () => {
            jQuery(".floating-color-picker").toggleClass("hidden");
        });
        jQuery(document).on("click", ".floating-color-picker .icon-close", () => {
            jQuery(".floating-color-picker").addClass("hidden");
        });
    });

    jQuery(document).on("click", ".capture-annotation-view", () => {
        const viewer = window.Construkted.cesiumViewer;
        viewer.scene.requestRender();
        viewer.render();
        const mediumQuality = viewer.canvas.toDataURL("image/jpeg", 0.5);
        if (jQuery(".annotation-image-holder img").length) {
            jQuery(".annotation-image-holder img").attr("src", mediumQuality);
        } else {
            jQuery(".ck-featimg-line-item").remove();
            jQuery("label.file-uploader-label[for='annotation-image']")
                .parents(".line-value")
                .prepend(
                    `<div class="annotation-image-holder"><img src="${mediumQuality}" /><a href="#" class="delete-annotation-image">Delete</a></div>`
                );
        }
        jQuery("#annotation-capture").val(mediumQuality);
    });

    jQuery(document).on("click", ".delete-annotation-image", () => {
        const r = window.confirm("Are you sure you want do delete the image?");
        if (r) {
            jQuery(".annotation-image-holder").remove();
            jQuery("#annotation-capture").val("delete");
        }
    });

    jQuery(document).on("change", "#annotation-attachments", function (this: HTMLElement) {
        const items = jQuery(this);
        // let filesToUpload = items.next().val().length > 0 && JSON.parse(items.next().val()).length > 0 ? filesToUpload : [];
        // Loop through each data and create an array file[] containing our files data.
        jQuery.each(items, (i: any, obj: any) => {
            jQuery.each(obj.files, (j: any, file: any) => {
                const fileName = obj.files[j];
                // @ts-ignore
                const fileId = file.name + j;

                window.filesToUpload.push({
                    id: fileId,
                    file: fileName
                });
                jQuery("#annotation-attachments-list").append(
                    // eslint-disable-next-line prefer-template
                    '<div class="ck-attachment-line-item make-flex attachment-remove" data-file-id="' +
                        fileId +
                        '" data-index="' +
                        // @ts-ignore
                        j +
                        '">' +
                        file.name +
                        '<i class="icon-close"></i></div>'
                );
            });
        });
    });

    jQuery(document).on("click", ".attachment-remove > i.icon-close", function (this: HTMLElement) {
        const sure = window.confirm("Are you sure? This cannot be undone.");

        if (!sure) return;
        const clicked = jQuery(this).parent();
        const items = jQuery("#annotation-attachments");
        const fileId = clicked.attr("data-file-id");
        // Loop through each data and create an array file[] containing our files data.
        // @ts-ignore
        if (items.length && items[0].files.length) {
            jQuery.each(items, (i: any, obj: any) => {
                // @ts-ignore
                jQuery.each(obj.files, (j) => {
                    // fd.append('files[' + j + ']', file);
                    if (clicked.attr("data-index") === j) {
                        // console.log(obj.files[j])
                    }
                    for (let k = 0; k < window.filesToUpload.length; ++k) {
                        if (window.filesToUpload[k].id === fileId) window.filesToUpload.splice(k, 1);
                    }
                    clicked.remove();
                });
            });
        } else {
            jQuery(".ck-processing-loader").addClass("shown");

            const annotation = jQuery("#annotation_id").val();
            const attachment = clicked.attr("data-annotation");

            const data = {
                action: "annotation_delete_attachment",
                attachment_id: attachment,
                annotation_id: annotation
            };

            jQuery.post(window.gowatch.ajaxurl, data, (res: any) => {
                if (res.status === 200) {
                    clicked.remove();
                } else {
                    alert(`There was an error: ${res.msg}`);
                }
                jQuery(".ck-processing-loader").removeClass("shown");
            });
        }
    });

    jQuery(document).on("click", "#annotation-set-view", function (this: HTMLElement) {
        const clicked = jQuery(this);
        const rect = window.Construkted.projectViewer.getCurrentCameraPositionOrientationJsonString();

        jQuery("#annotation-view-location").val(rect).trigger("change");
        jQuery("#annotation-reset-view").removeAttr("disabled");
        clicked.attr("disabled", "disabled");
        jQuery(this).html('<i class="icon-plus"></i> Change view');
        jQuery(this)
            .parents(".line-value")
            .after(
                '<div id="annotation-view-saved" class="ck-toolbar-alert"><i class="icon-tick"></i> Saved new view!</div>'
            );

        setTimeout(() => {
            clicked.removeAttr("disabled");
            jQuery("#annotation-view-saved").remove();
        }, 3000);
    });

    jQuery(document).on("click", "#annotation-reset-view", function (this: HTMLElement) {
        jQuery(this).attr("disabled", "disabled");
        jQuery("#annotation-view-location").val("").trigger("change");
        jQuery("#annotation-set-view").html('<i class="icon-plus"></i> Set view');

        jQuery(this)
            .parents(".line-value")
            .after(
                '<div id="annotation-view-reset-alert" class="ck-toolbar-alert"><i class="icon-tick"></i> View reset successfully!</div>'
            );

        setTimeout(() => {
            jQuery("#annotation-view-reset-alert").remove();
        }, 3000);
    });

    // eslint-disable-next-line prefer-arrow-callback
    jQuery(document).on("click", ".add-annotation button.add", function (this: HTMLElement) {
        createAnnotation(jQuery(this));
    });

    jQuery(document).on("click", ".cancel-sidebar", () => {
        const project = window.Construkted.project;

        if (project.annotationModified()) {
            project.tryCancelAnnotation();
        }
    });

    jQuery(document).on("change", "#annotation-asset", () => {
        const tilesetAssets = window.Construkted.tilesetAssets;

        if (tilesetAssets.length === 1) {
            return;
        }

        const annotationId = jQuery("#annotation-entity-id").val() as string;

        if (!annotationId) {
            console.error("invalid annotation id");
            return;
        }

        const annotation = window.Construkted.project.getAnnotation(annotationId);
        const postId = jQuery("#annotation-asset").val() as string;

        if (annotation) {
            annotation.asset = postId;
        }

        const clipping = window.Construkted.clippingTools.getClipping(annotationId);

        if (clipping) {
            if (postId) {
                clipping.setTargetAsset(postId);
            } else {
                clipping.setTargetAsset(undefined);
            }
        }
    });

    initClippingBoxRelativeEvents();
    initPlaceImageRelativeEvents();
}
