/* eslint-disable */
// q@ts-nocheck

function overrideCesiumCamera() {
    const Camera = Cesium.Camera;

    const scratchNormal = new Cesium.Cartesian3();

    Camera.prototype.moveUpEx = function (amount) {
        this.moveVertical(amount);
    };

    Camera.prototype.moveDownEx = function (amount) {
        this.moveVertical(-amount);
    };

    Camera.prototype.moveVertical = function (amount) {
        const position = this.position;

        const direction = Cesium.Cartesian3.normalize(position, scratchNormal);

        this.move(direction, amount);
    };
}

export { overrideCesiumCamera };
