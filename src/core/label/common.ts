export enum DimensionLabelTypes {
    HTML = 1,
    EDITOR = 2,
    TEXT = 0
}

export enum LabelAlignments {
    leading = "leading",
    trailing = "trailing"
}

export function setMarginLeftFloat(element: HTMLElement, labelAlignment: LabelAlignments) {
    const { style: n } = element;

    if (labelAlignment === LabelAlignments.trailing) {
        n.marginLeft = "-100%";
        n.float = "left";
    } else {
        n.marginLeft = "";
        n.float = "";
    }
}
