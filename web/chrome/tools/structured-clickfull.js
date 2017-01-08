/**
 * StructuredFun javascript
 * clickfull: click image to fullscreen tool
 */
(function ($, sfun, undefined) {

    // ---------
    // CONSTANTS
    // ---------

    var debug = true;
    var $document = $(document);

    // ---------
    // FUNCTIONS
    // ---------

    var init = function () {
        var obj = {
            'context': this,
            'key': 'clickfull',
            'receiverRegistered': cf_receiverRegistered,
            'receiverImageClicked': cf_receiverImageClicked,
            'receiverKeyPressed': cf_receiverKeyPressed,
        };
        // not sure of init order, so push async
        sfun.push('registerTool', obj);
    };

    /**
     * called by sfun when ready
     */
    var cf_receiverRegistered = function () {
        // bind to video hover
        var that = this;
        // be very careful with code in here as :hover is a very frequent event
        sfun.api_get$sfun().on('mousemove', '.selectablecell a.video-container', function (event) {
            // pull ent using shared cached copy
            var seq = $(this).parent().data('seq');
            var $ent = sfun.api_$cell(seq);
            if ($ent.hasClass('video-ready')) {
                // work out image and cursor positions on x axis (always)
                var image_pos = $ent.offset();
                var cursor_pos = event.pageX - image_pos.left;
                var player = $ent.cachedGet('player');
                // test to see if the video is paused (!playing)
                if (player.paused()) {
                    if (false) {
                        // skip video position forward as cursor floats over it
                        var cursor_sec = sfun.api_round(cursor_pos * player.duration() / $ent.width(), 0);
                        if (debug && true) {
                            console.log('cursor_pos[' + cursor_pos + '] player.duration[' + player.duration() + '] $ent.width[' + $ent.width() + '] cursor_sec[' + cursor_sec + ']');
                        }
                        player.currentTime(cursor_sec);
                    }
                }
            } else {
                // turn into video on hover
                _toggleVideo(seq, null, $ent);
            }
        });
        sfun.api_get$sfun().on('mouseover', '.selectablecell a.video-container', function (event) {
            var seq = $(this).parent().data('seq');
            var $ent = sfun.api_$cell(seq);
            // attempt to load player
            var player = $ent.cachedGet('player');
            if (player == undefined) {
                return;
            }
            // if player is playing
            if (player.paused() == false) {
                // push player volume up to 100% when mouse enters
                if (player.volume != 1.0) {
                    player.volume(1.0);
                }
            }
        });
        sfun.api_get$sfun().on('mouseout', '.selectablecell a.video-container', function (event) {
            var seq = $(this).parent().data('seq');
            var $ent = sfun.api_$cell(seq);
            // attempt to load player
            var player = $ent.cachedGet('player');
            if (player == undefined) {
                return;
            }
            // if player is playing
            if (player.paused() == false) {
                // push player volume up to 100% when mouse enters
                if (player.volume != 0.1) {
                    player.volume(0.1);
                }
            }
        });
    };

    /**
     * process a click on an image
     * downstream of: EVENT image click, HANDLER image click
     * @param {object} event raw DOM event
     * @param {object} $ent jQuery object
     * @param {string} selector (type.class) for the click target
     */
    var cf_receiverImageClicked = function (event, $ent, selector) {
        switch (selector) {
            case 'input':
            case 'textarea':
            case 'span.editable':
                break;
            default:
                var seq = $ent.data('seq');
                // select image, then toggle
                _imageToggleFullscreen(seq);
                // stop the event from bubbling up, leave active
                event.preventDefault();
                break;
        }
    };

    /**
     * process events generated by key presses
     * downstream of: EVENT key pressed, HANDLER key pressed
     * @return {object} jQuery deferred
     */
    var cf_receiverKeyPressed = function (event, eventContext) {
        // process key press
        switch (event.which) {
            case sfun.KEY_RETURN:
                var seq = sfun.api_getSeq();
                // stop the event from bubbling up, leave active
                event.preventDefault();
                return _imageToggleFullscreen(seq, eventContext);
        }
        return null;
    }


    //
    // FUNCTIONS: Helpers
    // begin _
    //

    /**
     * switch between the default breadth and fullscreen
     * @param {int} seq image to make fullscreen
     * @param {object} eventContext optional event context for decorating an existing deferred
     * @return {object} jQuery deferred
     */
    var _imageToggleFullscreen = function (seq, eventContext) {
        var $ent = sfun.api_$cell(seq);
        switch (sfun.api_getType($ent)) {
            case 'image':
                var offseq = sfun.api_imageCentreOffseq(sfun.api_getDirection(), seq);
                // toggle using hash change
                if (sfun.api_getBreadth() == 1) {
                    return sfun.api_fireHashUpdate(sfun.api_overwritePreviousState({'seq': seq}), false, eventContext);
                } else {
                    // update offseq (to what it should be already) before going fullscreen
                    var outgoing_offseq = sfun.api_imageStillShiftOffseq(seq);
                    sfun.api_setOffseq(outgoing_offseq);
                    // store state for return journey
                    sfun.api_storeStateAsPrevious();
                    // update URL to go to fullscreen (b=1)
                    return sfun.api_fireHashUpdate({'breadth': 1, 'seq': seq, 'offseq': offseq}, false, eventContext);
                }
                break;
            case 'directory':
                // warning: directory clicks don't seem to use this
                var $clickable = $ent.cachedFind('.clickable');
                if ($clickable.length) {
                    window.location = $clickable.attr('href');
                }
                break;
            case 'video':
                _toggleVideo(seq, eventContext, $ent);
                // work out cell and viewport's positions on major axis
                var offseq = sfun.api_imageStillShiftOffseq(seq);
                // select video using hash update
                return sfun.api_fireHashUpdate({'seq': seq, 'offseq': offseq}, false, eventContext);
                break;
        }
        return sfun.api_getEventQueue().resolve(eventContext);
    };

    var _toggleVideo = function (seq, eventContext, $ent) {
        var $cont = $ent.cachedFind('.video-container');
        var $img = $ent.cachedFind('.boundable');
        var meta = $ent.cachedGet('meta');
        if ($ent.hasClass('video-ready')) {
            // don't do anything if the video has already been turned into a video
        } else {
            var id = 'video-' + seq;
            // flag as video-ready
            $ent.addClass('video-ready');
            // insert relevant video element
            var video_obj = {
                id: id,
                width: '100%',
                poster: $img.attr('src'),
                source: $img.data('video-src'),
                type: $img.data('video-type'),
                // classes: 'videocell',
            };
            var html, player;
            switch (video_obj.type) {
                case 'mp4':
                case 'm4v':
                case 'flv':
                case 'wmv':
                    player = 'video.js';
                    html = sfun.api_substitute(_getVideoJSTemplate(), video_obj);
                    break;
                // case 'flv':
                // player = 'flowplayer';
                // html = sfun.api_substitute(_getFlowplayerTemplate(), video_obj);
                // break;
            }
            $cont.append(html);
            // initialise player
            switch (player) {
                case 'video.js' :
                    videojs(id, {"controls": true, "autoplay": false, "preload": "auto"}, function () {
                        // player (this) is initialized and ready, store in $img cache
                        $ent.cachedSet('player', this);
                        // bind to player play/pause events
                        this.on('play', function () {
                            $ent.addClass('video-playing');
                            $ent.removeClass('video-paused');
                        });
                        this.on('pause', function () {
                            $ent.addClass('video-paused');
                            $ent.removeClass('video-playing');
                        });
                    });
                    break;
            }
            // hide image it's replacing
            $img.hide();
        }
    };

    // TEMPLATES
    // for different embedded video players

    var _getVideoJSTemplate = function () {
        var str = '<video id="{{ id }}" class="video-js vjs-default-skin {{ classes }}" controls preload="none" width="{{ width }}" height="{{ height }}" poster="{{ poster }}">';
        str += '<source src="{{ source }}" type="video/{{ type }}" />';
        str += '</video>';
        return str;
    };

    var _getFlowplayerTemplate = function () {
        var str = '<video id="{{ id }}" class="video-js vjs-default-skin {{ classes }}" controls preload="none" width="{{ width }}" height="{{ height }}" poster="{{ poster }}">';
        str += '<source src="{{ source }}" type="video/{{ type }}" />';
        str += '</video>';
        return str;
    };

    // call init function
    init();

})(jQuery, window.sfun, undefined);
