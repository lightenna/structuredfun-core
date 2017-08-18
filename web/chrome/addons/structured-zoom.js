/**
 * Structured Library
 * @param {object} $ object reference
 */
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD (Register as an anonymous module)
        define(['jquery', 'sfun'], factory);
    } else if (typeof exports === 'object') {
        // Node/CommonJS
        module.exports = factory(require('jquery'), require('sfun'));
    } else {
        // Browser globals
        factory(jQuery, sfun);
    }
}(function ($, sfun) {

    var zoom = {

        // STATE

        viewer: null,

        // FUNCTIONS

        'create': function (options) {
            // create viewer based on options
            this.viewer = OpenSeadragon(options);
            // as soon the the viewer is open, move to the hash-defined coords
            this.viewer.addHandler('open', function (target) {
                // read hash and pan/zoom
                var initial_hash = sfun.api_getAndParseHash();
                // but default to 0,0 if unset (otherwise will centre which is weird)
                if (initial_hash.cx == undefined) {
                    initial_hash.cx = 0;
                }
                if (initial_hash.cy == undefined) {
                    initial_hash.cy = 0;
                }
                var v_centre = target.eventSource.viewport.imageToViewportCoordinates(
                    new OpenSeadragon.Point(initial_hash.cx, initial_hash.cy)
                );
                target.eventSource.viewport.panTo(v_centre);
                if (initial_hash.z !== undefined) {
                    var v_zoom = initial_hash.z / 1000;
                    target.eventSource.viewport.zoomTo(v_zoom);
                }
            });
            // add event handlers
            this.viewer.addHandler('canvas-click', function (target) {
                if (target.quick === true) {
                    var v_point = target.eventSource.viewport.pointFromPixel(target.position);
                    var im_point = target.eventSource.viewport.viewportToImageCoordinates(v_point.x, v_point.y);
                    console.log(parseInt(im_point.x), parseInt(im_point.y));
                }
            });
            this.viewer.addHandler('viewport-change', function (target) {
                var v_bounds = target.eventSource.viewport.getBounds(true);
                // get native pixel coordinates
                var im_rect = target.eventSource.viewport.viewportToImageRectangle(v_bounds);
                var v_zoom = target.eventSource.viewport.getZoom();
                if ((im_rect.x > -1) && (im_rect.y > -1) && (v_zoom > -1)) {
                    // buffer hash update, but process only last one, drop rest
                    sfun.api_buffer('viewport-change', function () {
                        sfun.api_fireHashUpdate({
                            'cx': Math.round(im_rect.x + (im_rect.width / 2)),
                            'cy': Math.round(im_rect.y + (im_rect.height / 2)),
                            'z': Math.round(v_zoom * 1000)
                        });
                    }, function () {
                    }, sfun.explicitScrollBUFFER, sfun.bufferExecLAST);
                }
            });
            return this.viewer;
        },

        'panCornerTo': function (which, x, y) {
            // use viewport bounds to convert x,y to [centred] cx,cy
            var v_bounds = this.viewer.viewport.getBounds(true);
            var im_rect = this.viewer.viewport.viewportToImageRectangle(v_bounds);
            var cx, cy;
            switch (which) {
                default:
                case sfun.cornerTOPLEFT :
                    // cx/cy is down and right from top left
                    cx = Math.round(x + (im_rect.width / 2));
                    cy = Math.round(y + (im_rect.height / 2));
                    break;
                case sfun.cornerBOTTOMRIGHT :
                    // cx/cy is up and left from bottom right
                    cx = Math.round(x - (im_rect.width / 2));
                    cy = Math.round(y - (im_rect.height / 2));
                    break;
            }
            var v_centre = this.viewer.viewport.imageToViewportCoordinates(
                new OpenSeadragon.Point(cx, cy)
            );
            this.viewer.viewport.panTo(v_centre);
        },

        lastEntry: null
    };

    sfun.api_apiExtend({

        'api_zoomCreateViewer': function (options) {
            zoom.create(options);
            return zoom;
        },

        'api_zoomPanCornerTo': function (which, x, y, eventContext) {
            zoom.panCornerTo(which, x, y);
        },

        lastEntry: null
    });
}));
