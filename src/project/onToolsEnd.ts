/* qeslint-disable */
// q@ts-nocheck

import { AnnotationData, ConstruktedAnnotationTypes } from "./common";
import { initAnnotaionFieldsUI } from "./initAnnotaionFieldsUI";

const hasAnnotationPermissions = () => {
    // If current user does not have access to project/asset - do not save annotations
    if (!window.currentUser || !(window.currentUser.has_access === "true")) {
        return false;
    }

    return true;
};

const setAnnotationChangesAndShowNewAnnotationPopup = (type: ConstruktedAnnotationTypes) => {
    const jQuery = window.jQuery;
    const currentUser = window.currentUser;
    const project = window.Construkted.project;

    // currentUser available at only project
    if (currentUser && currentUser.has_access === "true") {
        // Would be used to check if changes are made before closing sidebar
        project.setAnnotationModified(true);

        // Check if it's not first load
        if (!jQuery("#side-menu-bar-wrapper").hasClass("not-loaded")) {
            jQuery("#sidebar-new-annotation").show().siblings(".popup-wrapper").hide();
        }
    } else {
        jQuery("#sidebar-new-annotation").show().siblings(".popup-wrapper").hide();

        if (type === ConstruktedAnnotationTypes.ClippingBox || type === ConstruktedAnnotationTypes.ClippingPlane) {
            project.setAnnotationModified(true);
        }
    }
};

// invoked when
// 1 new measurement or drawing is finished
// 2 clipping is activated
// 3 once user draw outline of volume

function onToolsEnd(data: AnnotationData) {
    const construkted = window.Construkted;

    if (construkted.isProject()) {
        if (!hasAnnotationPermissions()) {
            return;
        }
    }

    // Check if we should open or not the sidebar
    setAnnotationChangesAndShowNewAnnotationPopup(data.type);

    const annotation = {
        title: data.title,
        post_id: 0,
        color: "rgba(255,255,0,0.5)",
        type: data.type as unknown as string,
        linewidth: "2",
        clamp_to_ground: "false",
        entity_id: data.id,
        details: JSON.stringify(data.details),
        show_note_pin: "n",
        show_note_text: "y",
        show_note_leader: "y",
        description: "",
        attachments: [],
        view: false,
        image: false,
        image_plane_image: "",
        comments: "0",
        author: {
            id: 0,
            name: ""
        },
        date: "",
        asset: "",
        capture: ""
    };

    initAnnotaionFieldsUI(annotation);

    const jQuery = window.jQuery;

    jQuery("#add-annotation").text("Create annotation");

    window.Construkted.startEditingAnnotation(data.id, "create");
}

export { onToolsEnd };
