import { BoundingSphere } from "cesium";
import { Annotation } from "../types";

import { ConstruktedAnnotationCategories, generateAttachmentsHTML, animateAnnotationDetailWindow } from "./common";

// eslint-disable-next-line arrow-body-style
const generateAnnotaionDetailHtml = (annotation: Annotation) => {
    const jQuery = window.jQuery;

    // Get the annotation position from "ck-modal-position" cookie
    const position = jQuery.cookie("ck-modal-position");

    return `<div class="ck-note-details ${position !== "left" ? "floating" : ""}">
                <article>
                    ${
                        typeof annotation.image !== "boolean"
                            ? `<figure>
                            <img src="${annotation.image.url}" alt="${annotation.title}" />
                        </figure>`
                            : ``
                    }
                    <header>
                        <i class="icon-close close-note"></i>
                        <svg class="dragger" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15" fill="none"><path d="M9.5 3a.5.5 0 110-1 .5.5 0 010 1zm0 5a.5.5 0 110-1 .5.5 0 010 1zm0 5a.5.5 0 110-1 .5.5 0 010 1zm-4-10a.5.5 0 110-1 .5.5 0 010 1zm0 5a.5.5 0 110-1 .5.5 0 010 1zm0 5a.5.5 0 110-1 .5.5 0 010 1z" stroke="currentColor"></path></svg>

                        <svg class="note-move-modal pin-note-left " viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.9938 21.9931C13.3071 21.998 14.6083 21.7423 15.8221 21.2407C17.0359 20.7391 18.138 20.0017 19.0648 19.0711C22.9628 15.1721 22.9628 8.8281 19.0648 4.9291C17.1798 3.0441 14.6688 2.0061 11.9938 2.0061C9.31878 2.0061 6.80678 3.0441 4.92278 4.9291C1.02478 8.8271 1.02478 15.1711 4.92278 19.0711C5.84955 20.0016 6.95174 20.739 8.1655 21.2406C9.37926 21.7422 10.6805 21.9979 11.9938 21.9931ZM6.33678 6.34409C7.84378 4.83709 9.85378 4.0071 11.9938 4.0071C14.1338 4.0071 16.1438 4.83709 17.6508 6.34409C20.7688 9.46309 20.7688 14.5381 17.6508 17.6571C16.1438 19.1641 14.1348 19.9931 11.9938 19.9931C9.85278 19.9931 7.84378 19.1641 6.33678 17.6571C3.21878 14.5381 3.21878 9.46309 6.33678 6.34409Z" fill="currentColor"/><path d="M12.5331 12.875L15.7471 9.661L14.3331 8.247L11.1191 11.461L8.99407 9.337V15H14.6571L12.5331 12.875Z" fill="currentColor"/></svg>


                        <svg class="note-move-modal make-note-floating " xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="none" viewBox="0 0 24 24"><path d="M12.006 2.007a9.927 9.927 0 0 0-7.071 2.922c-3.898 3.899-3.898 10.243 0 14.142 1.885 1.885 4.396 2.923 7.071 2.923s5.187-1.038 7.071-2.923c3.898-3.898 3.898-10.242 0-14.142a9.928 9.928 0 0 0-7.071-2.922zm5.657 15.649c-1.507 1.507-3.517 2.337-5.657 2.337s-4.15-.83-5.657-2.337c-3.118-3.119-3.118-8.194 0-11.313 1.507-1.507 3.516-2.336 5.657-2.336s4.15.829 5.657 2.336c3.118 3.119 3.118 8.194 0 11.313z"></path><path d="m11.467 11.125-3.214 3.214 1.414 1.414 3.214-3.214 2.125 2.124V9H9.343z"></path></svg>

                        <h3>${annotation.title}</h3>
                        <div class="entry-meta mb-1">Created by ${annotation.author.name} on ${annotation.date}</div>
                        <div class="note-description">
                            ${annotation.description}
                        </div>
                    </header>
                    ${
                        annotation.attachments.length > 0
                            ? `<footer>
                            <h5>Attachments</h5>
                            ${generateAttachmentsHTML(annotation, false)}
                        </footer>`
                            : ""
                    }
                </article>
            </div>`;
};

export const showAnnotationDetailAndFly = (id: string) => {
    const construkted = window.Construkted;
    const project = construkted.project;
    const annotation = project.getAnnotationById(id);

    if (!annotation) {
        return;
    }

    const annotationType = annotation.category;

    if (annotationType === ConstruktedAnnotationCategories.Drawing || ConstruktedAnnotationCategories.Measurement) {
        const html = generateAnnotaionDetailHtml(annotation);

        animateAnnotationDetailWindow(html);
    } else if (annotationType === ConstruktedAnnotationCategories.Clipping) {
        const boundingSphere = new BoundingSphere();

        const clippingBox = construkted.clippingTools.clippingBoxTool.getClippingBoxById(id);

        clippingBox?.getBoundingSphere(boundingSphere);
        construkted.camera.flyToBoundingSphere(boundingSphere);
    }

    if (annotation.view) {
        project.goToSavedAnnotationView(annotation);
    } else {
        project.flyToAnnotation(annotation);
    }
};
