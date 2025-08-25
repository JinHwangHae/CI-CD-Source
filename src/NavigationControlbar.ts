/* qeslint-disable */
// q@ts-nocheck

import { Event, HomeButton, Viewer } from "cesium";

import "./NavigationControlbar.css";
import { CesiumFPVCameraController } from "./CesiumFPVCameraController";
import { CesiumFLYCameraController } from "./CesiumFLYCameraController";

const testOnLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

function newButton(tooltipText: string, iconClass: string, text: string = "") {
    const button = document.createElement("button");
    const icon = document.createElement("i");

    icon.className = iconClass;

    button.type = "button";
    button.innerHTML = icon.outerHTML + text;
    button.className = "construkted-viewer-controlbar-button";
    button.setAttribute("title", tooltipText);

    return button;
}

function changeMainIcon(container: string, iconClass: string) {
    // Get the element that has the container class
    const element = document.getElementsByClassName(container)[0];
    const button = element.getElementsByClassName("construkted-viewer-controlbar-selectedElement")[0];

    button.innerHTML = `<i class="${iconClass}"></i>`;
}

function wrapInSelector(
    element: HTMLElement,
    selector: string,
    icon: string = "icon-layers",
    text: string = "",
    tooltip: string = ""
) {
    const wrapper = document.createElement("div");

    // Add the selected element (first argument) to the wrapper
    const selectedElement = document.createElement("button");
    selectedElement.className = "construkted-viewer-controlbar-selectedElement construkted-viewer-controlbar-button";

    selectedElement.innerHTML = `<i class="${icon}"></i> ${text}`;

    // Set the tooltip/title of the selected element
    if (tooltip !== "") selectedElement.setAttribute("title", tooltip);

    // Create the wrapper for the options
    const optionsWrapper = document.createElement("div");
    optionsWrapper.className = "construkted-viewer-controlbar-optionsWrapper";

    wrapper.className = selector;
    optionsWrapper.appendChild(element);

    wrapper.appendChild(selectedElement);
    wrapper.appendChild(optionsWrapper);

    return wrapper;
}

interface ConstructorOptions {
    container: HTMLElement;
    viewer: Viewer;
    fpvController: CesiumFPVCameraController;
    flyController: CesiumFLYCameraController;
}

class NavigationControlbar {
    private _fpvController: CesiumFPVCameraController;
    private _flyController: CesiumFLYCameraController;

    private readonly _fpvButtonClicked: Event;
    private readonly _flyButtonClicked: Event;
    private readonly _orbitButtonClicked: Event;

    private _container: HTMLElement;

    constructor(options: ConstructorOptions) {
        const container = options.container;
        const scene = options.viewer.scene;

        this._fpvController = options.fpvController;
        this._flyController = options.flyController;

        this._fpvButtonClicked = new Event();
        this._flyButtonClicked = new Event();
        this._orbitButtonClicked = new Event();

        const fpvButton = newButton("FPV", "gwicon-user");
        const flyButton = newButton("FLY", "gwicon-baloon");
        const orbitButton = newButton("ORBIT", "gwicon-orbit");
        orbitButton.classList.add("active");

        const viewContainer = document.createElement("div");
        viewContainer.className = "construkted-viewer-viewController";

        viewContainer.appendChild(fpvButton);
        viewContainer.appendChild(flyButton);
        viewContainer.appendChild(orbitButton);

        fpvButton.addEventListener("click", () => {
            fpvButton.classList.add("active");
            orbitButton.classList.remove("active");
            flyButton.classList.remove("active");

            if (!testOnLocal) {
                document.getElementsByClassName("fly-navigation")[0].classList.add("hidden");
            }

            if (this._fpvController.started()) return;

            if (this._flyController.started()) {
                this._flyController.stop();
            }

            this._fpvController.setAllowCheckingStart(true);

            changeMainIcon("navigation-options", "gwicon-user");
        });

        flyButton.addEventListener("click", () => {
            fpvButton.classList.remove("active");
            orbitButton.classList.remove("active");
            flyButton.classList.add("active");

            if (!testOnLocal) {
                document.getElementsByClassName("fly-navigation")[0].classList.toggle("hidden");
            }

            if (this._flyController.started()) {
                console.warn("already started");
                return;
            }

            if (this._fpvController.started()) {
                this._fpvController.exitFPV();
            }

            this._fpvController.setAllowCheckingStart(false);

            this._flyController.start();

            changeMainIcon("navigation-options", "gwicon-baloon");
        });

        orbitButton.addEventListener("click", () => {
            if (!testOnLocal) {
                document.getElementsByClassName("fly-navigation")[0].classList.add("hidden");
            }

            fpvButton.classList.remove("active");
            orbitButton.classList.add("active");

            flyButton.classList.remove("active");

            if (this._fpvController.started()) {
                this._fpvController.exitFPV();
            } else if (this._flyController.started()) {
                this._flyController.stop();
            } else {
                // do nothing
            }

            this._fpvController.setAllowCheckingStart(false);

            changeMainIcon("navigation-options", "gwicon-orbit");
        });

        const navOptions = wrapInSelector(
            viewContainer,
            "container-options navigation-options",
            "gwicon-orbit",
            "",
            "Navigation"
        );

        // Add the navigation buttons
        container.appendChild(navOptions);

        // Create and add the view mode buttons
        const button3d = newButton("3D Mode", "gwicon-3d-1");
        const button2d = newButton("2D Mode", "gwicon-2d");
        const button2dn = newButton("2DN Mode", "gwicon-2dn");

        button3d.classList.add("active");

        button3d.addEventListener("click", () => {
            button3d.classList.add("active");
            button2d.classList.remove("active");
            button2dn.classList.remove("active");
            const construkted = window.Construkted;
            construkted.set3DViewMode();
            changeMainIcon("view-options", "gwicon-3d-1");
        });

        button2d.addEventListener("click", () => {
            button2d.classList.add("active");
            button3d.classList.remove("active");
            button2dn.classList.remove("active");
            const construkted = window.Construkted;
            construkted.set2DViewMode();
            changeMainIcon("view-options", "gwicon-2d");
        });

        button2dn.addEventListener("click", () => {
            button2dn.classList.add("active");
            button3d.classList.remove("active");
            button2d.classList.remove("active");
            const construkted = window.Construkted;
            construkted.set2DViewNorthUpMode();
            changeMainIcon("view-options", "gwicon-2dn");
        });

        const viewModeContainer = document.createElement("div");
        viewModeContainer.className = "construkted-viewer-controlbar-viewmode-container";

        viewModeContainer.appendChild(button3d);
        viewModeContainer.appendChild(button2d);
        viewModeContainer.appendChild(button2dn);

        const viewOptions = wrapInSelector(
            viewModeContainer,
            "container-options view-options",
            "gwicon-3d-1",
            "",
            "View Mode"
        );

        document.getElementsByClassName("construkted-viewer-controlbarContainer")[0]?.appendChild(viewOptions);

        const modelWireframeButton = newButton("Model Wireframe", "gwicon-wireframe", "Model Wireframe");
        const modelShadedButton = newButton("Model Shaded", "gwicon-shaded", "Model Shaded");
        const modelTextureButton = newButton("Model Textured", "gwicon-textured", "Model Textured");

        modelTextureButton.classList.add("active");

        // Create the model shading buttons
        const modelModeContainer = document.createElement("div");
        modelModeContainer.className = "construkted-viewer-controlbar-modelmode-container";

        modelWireframeButton.addEventListener("click", () => {
            modelWireframeButton.classList.add("active");
            modelShadedButton.classList.remove("active");
            modelTextureButton.classList.remove("active");
            const construkted = window.Construkted;
            construkted.setWireframeShadingMode();
        });

        modelShadedButton.addEventListener("click", () => {
            modelShadedButton.classList.add("active");
            modelWireframeButton.classList.remove("active");
            modelTextureButton.classList.remove("active");
            const construkted = window.Construkted;
            construkted.setSolidShadingMode();
        });

        modelTextureButton.addEventListener("click", () => {
            modelTextureButton.classList.add("active");
            modelWireframeButton.classList.remove("active");
            modelShadedButton.classList.remove("active");
            const construkted = window.Construkted;
            construkted.setTextureShadingMode();
        });

        modelModeContainer.appendChild(modelWireframeButton);
        modelModeContainer.appendChild(modelShadedButton);
        modelModeContainer.appendChild(modelTextureButton);

        const modelOptions = wrapInSelector(
            modelModeContainer,
            "container-options model-options",
            "gwicon-desktop",
            "",
            "Model Shading"
        );

        document.getElementsByClassName("construkted-viewer-controlbarContainer")[0]?.appendChild(modelOptions);

        // Add the help and home buttons
        const helpButton = newButton("", "icon-help");

        helpButton.classList.remove("construkted-viewer-controlbar-button");
        helpButton.classList.add("active", "viewer-help-button");
        helpButton.setAttribute("title", "Help");

        helpButton.addEventListener("click", () => {
            jQuery(".ck-asset-modal").removeClass("hidden is-closed");
            jQuery(".ck-asset-modal").fadeIn(300);
        });

        container.appendChild(helpButton);

        // Add the home button
        // eslint-disable-next-line no-new
        new HomeButton(container, scene, 1.5);

        const layersPanelToggleButton = newButton("Layers", "gwicon-layers");

        layersPanelToggleButton.addEventListener("click", () => {
            window.Construkted.layersPanel.show();
        });

        container.appendChild(layersPanelToggleButton);

        this._container = container;
    }

    show() {
        this._container.style.display = "block";
    }

    hide() {
        this._container.style.display = "none";
    }

    get fpvButtonClicked() {
        return this._fpvButtonClicked;
    }

    get flyButtonClicked() {
        return this._flyButtonClicked;
    }

    get orbitButtonClicked() {
        return this._orbitButtonClicked;
    }
}

export { NavigationControlbar };
