import * as JQuery from "jquery";
import { Annotation } from "../types/common";
import { ConstruktedAnnotationCategories, ConstruktedAnnotationTypes } from "./common";
import onAnnotationSaved from "./onAnnotationSaved";
import { Project } from "./Project";
import { AnnotationTreeView } from "./annotationTreeView";

export type CreateAnnotaionAjaxResponse = {
    status: number;
    msg: string;
    data: {
        id: string;
        type: "update" | "add";
        changed: Annotation;
    };
};

function moveAnnotationAsset(id: string, annotationAsset: string) {
    const oldAsset = jQuery(`#form-check-${id}`);
    const oldAssetId = oldAsset.parents(".asset-container").attr("id");
    if (oldAssetId) {
        oldAssetId.replace("asset-", "");
    }
    if (oldAssetId && oldAssetId !== annotationAsset) {
        // Move the annotation to the new asset container
        const oldItem = jQuery(`#annotation-list #asset-${oldAssetId} #form-check-${id}`).clone();
        jQuery(`#annotation-list #asset-${oldAssetId} #form-check-${id}`).remove();
        if (annotationAsset === "") {
            jQuery("#annotation-list #asset-null .asset-container-inner").prepend(oldItem);
        } else {
            jQuery(`#annotation-list #asset-${annotationAsset} .asset-container-inner`).prepend(oldItem);
        }
    }
}

function updateAnnotationTreeNode(treeView: any, annotation: Annotation) {
    const node = treeView._nodes && treeView._nodes.get(annotation.entity_id);
    if (node) {
        // Update title
        const titleEl = node.querySelector(".node-title");
        if (titleEl) {
            titleEl.textContent = annotation.title;
        }
        // Update icon
        const iconEl = node.querySelector(".node-info i:not(.collapse-toggle)");
        if (iconEl) {
            try {
                const iconClass = Project.getIconFromAnnotationType(
                    annotation.type as unknown as ConstruktedAnnotationTypes
                );
                iconEl.className = iconClass;
            } catch (e) {
                // fallback: do not update icon
            }
        }
    }
}

function saveTreeStructureIfNeeded(isAssetView: boolean, res: CreateAnnotaionAjaxResponse) {
    if (!isAssetView) {
        const treeContainer = document.querySelector("#annotation-tree-container");
        if (treeContainer) {
            const treeView = (treeContainer as any)._treeView as AnnotationTreeView;
            if (treeView && res.data.type === "update" && res.data.changed) {
                updateAnnotationTreeNode(treeView, res.data.changed);
            }
            if (treeView) {
                treeView.saveTree().catch((error: Error) => {
                    console.error("Failed to save tree structure after creating/updating annotation:", error);
                });
            }
        }
    }
}

function handleAnnotationTypeSpecificLogic(annotationType: ConstruktedAnnotationTypes, id: string, construkted: any) {
    if (annotationType === ConstruktedAnnotationTypes.ClippingBox) {
        const clippingBox = construkted.clippingTools.clippingBoxTool.getClippingBoxById(id);
        clippingBox?.showEditControls(false);
    } else if (annotationType === ConstruktedAnnotationTypes.ClippingPlane) {
        const clippingPlane = construkted.clippingTools.clippingPlaneTool.getClippingPlaneById(id);
        if (clippingPlane) {
            clippingPlane.editable = false;
        }
    }
}

function doCreateAnnontation(form: JQuery, res: CreateAnnotaionAjaxResponse) {
    let editedAnnotation: Annotation | undefined;

    const construkted = window.Construkted;
    const project = construkted.project;
    const id = form.find("#annotation-entity-id").val() as string;
    const postId = form.find("#annotation_id").length ? (form.find("#annotation_id").val() as number) : 0;

    project.annotations.map((item: Annotation) => {
        if (item.entity_id === id || item.post_id === postId) {
            editedAnnotation = item;
        }
        return item;
    });

    form.find("#annotation-line-width").parents(".ck-option-line").removeClass("hidden");

    const annotationType = form.find("#annotation-type").val() as unknown as ConstruktedAnnotationTypes;
    const annotationCategory = project.getAnnotationCategoryFromAnnotationType(annotationType);
    const annotationTitle = form.find("#annotation-title").val() as string;
    const annotationAsset = form.find("#annotation-asset").val() as string;

    if (res.data.type === "update") {
        if (annotationCategory === ConstruktedAnnotationCategories.Drawing) {
            jQuery(`.annotation-line-item[data-entity-id="${id}"] .annotation-title`).text(annotationTitle);
        } else if (editedAnnotation) {
            jQuery("#annotation-list")
                .find(`div[data-post-id="${editedAnnotation.post_id}"] .annotation-title`)
                .text(annotationTitle);
        }
    } else {
        project.createAnnotationLineItem({
            type: annotationType as unknown as string,
            entity_id: id,
            post_id: parseInt(res.data.id, 10),
            title: annotationTitle,
            comments: "",
            asset: annotationAsset
        } as Annotation);

        jQuery(document).on("change", `#annotation-list [id=${id}]`, function (this: HTMLInputElement) {
            project.showHideAnnotation(id, annotationCategory, jQuery(this).prop("checked"));
        });
    }

    handleAnnotationTypeSpecificLogic(annotationType, id, construkted);

    if (res.data.changed && res.data.type === "update") {
        project.updateAnnotation(parseInt(res.data.id, 10), res.data.changed);
    } else if (res.data.changed && res.data.type === "add") {
        project.addNewAnnotation(res.data.changed);
    }

    moveAnnotationAsset(id, annotationAsset);

    // Save the tree structure only if not in asset view
    const isAssetView = window.location.pathname.includes("/asset/");
    saveTreeStructureIfNeeded(isAssetView, res);

    window.filesToUpload = [];
    onAnnotationSaved(form);
    jQuery("#annotation-processing-loader").addClass("hidden");
    jQuery("#sidebar-new-annotation").removeClass("edit-mode");
    construkted.finishedEditingAnnotation(true);
}

export default function createAnnotation(createAnnotationButton: JQuery) {
    const jQuery = window.jQuery;
    const form = createAnnotationButton.parents(".add-annotation");

    const construkted = window.Construkted;
    const project = construkted.project;

    if (!project.canCreateAnnotation()) {
        onAnnotationSaved(form);
        return;
    }

    jQuery(".ck-processing-loader").addClass("shown");

    const id = form.find("#annotation-entity-id").val() as string;

    if (!id || !id.trim()) {
        console.error("empty id");
        jQuery(".ck-processing-loader").removeClass("shown");
        return;
    }

    const annotationType = form.find("#annotation-type").val() as unknown as ConstruktedAnnotationTypes;

    if (!annotationType) {
        console.error(`invalid annotationType ${annotationType}`);
        jQuery(".ck-processing-loader").removeClass("shown");
        return;
    }

    project.fetchAnnotationDetailsToUI(id, annotationType);

    const annotationTitle = form.find("#annotation-title").val() as string;
    const annotationImage = (<HTMLInputElement>form.find("#annotation-image")[0]).files![0];
    const annotationAsset = form.find("#annotation-asset").val() as string;
    const imagePlaneImage = (<HTMLInputElement>form.find("#annotation-image-plane-image")[0]).files![0];
    const annotationDesc = form.find("#annotation-description").val() as string;
    const annotationView = form.find("#annotation-view-location").val() as string;
    const nonce = form.find('[name="ck_create_annotation_nonce"]').val() as string;
    const annotationColor = form.find("#annotation-color").val() as string;
    const annotationProject = form.find("#annotation-project").val() as string;
    const annotationLineWidth = form.find("#annotation-line-width").val();
    const annotationClampToground = form.find("#annotation-drape-over-geometry").prop("checked");
    const annotationDetails = form.find("#annotation-details").val() as string;
    const annotationCapture = form.find("#annotation-capture").val() as string;
    const annotationShowNotePin = form.find("#annotation-show-note-pin").prop("checked") === true ? "y" : "n";
    const annotationShowNoteText = form.find("#annotation-show-note-text").prop("checked") === true ? "y" : "n";
    const annotationShowNoteLeader = form.find("#annotation-show-note-leader").prop("checked") === true ? "y" : "n";
    const postId = form.find("#annotation_id").length ? (form.find("#annotation_id").val() as number) : 0;

    if (construkted.isTilesetAsset()) {
        // create annotation without sending to backend
        const type = jQuery("#sidebar-new-annotation").hasClass("edit-mode") ? "update" : "add";

        const res = {
            data: {
                changed: {
                    asset: annotationAsset,
                    attachments: [],
                    author: { id: 0, name: "" },
                    clamp_to_ground: annotationClampToground,
                    color: annotationColor,
                    comments: "0",
                    date: new Date().toString(),
                    description: annotationDesc,
                    details: annotationDetails,
                    entity_id: id,
                    image: {
                        id: 0,
                        url: ""
                    },
                    image_plane_image: "",
                    linewidth: annotationLineWidth as string,
                    post_id: postId,
                    show_note_leader: annotationShowNoteLeader,
                    show_note_pin: annotationShowNotePin,
                    show_note_text: annotationShowNoteText,
                    title: annotationTitle,
                    type: annotationType as unknown as string,
                    view: false,
                    capture: ""
                },
                id: "",
                type: type as "update" | "add"
            },
            status: 200,
            msg: "Annotation save successfully"
        };

        doCreateAnnontation(form, res);
        return;
    }

    const formData = new FormData();

    formData.append("image", annotationImage);
    formData.append("image-plane-image", imagePlaneImage);
    formData.append("action", "add_annotation");
    formData.append("nonce", nonce);
    formData.append("title", annotationTitle);
    formData.append("asset", annotationAsset);
    formData.append("type", annotationType as unknown as string);
    formData.append("color", annotationColor);
    formData.append("line_width", annotationLineWidth as string);
    formData.append("clamp_to_ground", annotationClampToground);
    formData.append("project_id", annotationProject);
    formData.append("details", annotationDetails);
    formData.append("entity", id);
    formData.append("annotation_id", postId!.toString());
    formData.append("show_note_pin", annotationShowNotePin);
    formData.append("show_note_text", annotationShowNoteText);
    formData.append("show_note_leader", annotationShowNoteLeader);
    formData.append("description", annotationDesc);
    formData.append("view", annotationView);
    formData.append("capture", annotationCapture);

    const fileList = window.filesToUpload;

    if (fileList && fileList.length > 0) {
        jQuery.each(fileList, (j: any, file: any) => {
            formData.append(`attachments[${j}]`, file.file);
        });
    }

    const prevHtmlOfCreateAnnotationButton = createAnnotationButton.html();
    createAnnotationButton.html("Processing...");

    jQuery.ajax({
        url: window.gowatch.ajaxurl,
        type: "post",
        data: formData,
        contentType: false,
        processData: false,
        success: function (res: CreateAnnotaionAjaxResponse) {
            if (res.status === 200) {
                doCreateAnnontation(form, res);
            } else {
                jQuery("#annotation-processing-loader").addClass("hidden");
                jQuery(".ck-processing-loader").addClass("hidden");
                construkted.finishedEditingAnnotation(false);
                createAnnotationButton.html(prevHtmlOfCreateAnnotationButton);

                if (res.data) {
                    alert(res.data);
                } else {
                    alert("There was an error");
                }
            }
        }
    });
}
