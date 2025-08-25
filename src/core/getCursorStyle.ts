import { isLocal } from "../construkted";

export default function getCursorStyle(centerX = 12, centerY = 12) {
    let imageUrl;

    if (!isLocal()) {
        imageUrl = `/wp-content/themes/gowatch-child/images/gcp.svg`;
    } else {
        imageUrl = `/images/gcp.svg`;
    }

    return `url('${imageUrl}') ${centerX} ${centerY}, auto`;
}
