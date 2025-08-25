import { createCancelButton, createFinishButton, deleteFinishCancelButtons } from "../project";

export function addFinishButton(cb: () => void) {
    const cesiumContainer = document.getElementById("cesiumContainer");

    if (cesiumContainer) {
        const finishButton = createFinishButton();
        cesiumContainer.appendChild(finishButton);

        finishButton.addEventListener("click", cb);
    }
}

export function removeActiveClassFromAllAnnotationToolButtons() {
    $("*[id*=drawing-tool-button]").each(function () {
        this.classList.remove("active");
    });

    $("*[id*=measurement-tool-button]").each(function () {
        this.classList.remove("active");
    });

    jQuery("#clipping-box-tool-button").removeClass("active");
    jQuery("#construkted-popup-create-clipping-plane-btn").removeClass("active");
    jQuery("#construkted-popup-create-image-plane-btn").removeClass("active");
}

function onCancelClicked() {
    const construkted = window.Construkted;
    const project = construkted.project;

    if (!project.askIgnoreAnnotationModified()) {
        return;
    }

    removeActiveClassFromAllAnnotationToolButtons();
    construkted.deactivateCurrentMapTool();
    deleteFinishCancelButtons();
    project.setAnnotationModified(false);
}

export function addCancelButton() {
    const cesiumContainer = document.getElementById("cesiumContainer");

    if (cesiumContainer) {
        const cancelButton = createCancelButton();
        cesiumContainer.appendChild(cancelButton);
        cancelButton.addEventListener("click", onCancelClicked);
    }
}

export function hideAllPopup() {
    jQuery(".popup-wrapper").hide();
    jQuery(".popup-wrapper").removeClass("is-shown");
    jQuery(".transform-has-modal-next").next().addClass("hidden");
}
