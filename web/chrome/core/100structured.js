/**
 * StructuredFun javascript
 * @param {object} $ object reference, so polyfills apply to all jQuery objects
 */
window.sfun = (function ($, undefined) {

    var coreObject = {

        // ---------
        // CONSTANTS
        // and private variables
        // ---------

        // state variables (assume debug off as could be used before default set)
        'debug': 0,
        'imagesnap': null,
        // default values for view state
        'state_default': [],
        // the previous values for the view state (1 generation)
        'state_previous': [],
        // default selector used to select top-level container
        'container_selector': '#sfun',
        // list of metadata fields supported
        'metadata_fields': ['iptcCaption', 'iptcByline', 'iptcHeadline', 'iptcKeywords', 'iptcCopyright', 'iptcSource'],
        'metadata_flags': ['editable'],
        // last image maxwidth|height, to shortcut reres using thumb size; can disable where set in this.refreshResolution()
        'last_longest': null,
        // device detection
        'likely_fluidScroll': (navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i) ? true : false),

        /**
         * The layoutManager is used to store an indexed list of layout methods
         */
        'layoutManager': null,

        /**
         * The toolManager is used to store an indexed list of available tools
         */
        'toolManager': null,

        /**
         * The eventQueue is used:
         * - to stop the hashChanged listener from firing for certain hash changes
         * - to enable promises on certain event
         * - to bridge promises between fire_ and handler
         */
        'eventQueue': null,

        // jQuery cache
        '$document': $(document),
        '$window': $(window),
        '$html': $('html'),
        '$sfun': null,
        '$sfun_flow': null,
        '$sfun_selectablecell': null,
        '$sfun_selectablecell_first': null,
        '$sfun_selectedcell': [],
        '$sfun_selectablecell_img': [],
        '$sfun_yardx': $('#sfun-yardstick-x'),
        '$sfun_yardy': $('#sfun-yardstick-y'),

        // jQuery selector caching
        '$cell': function (seq) {
            // if we haven't yet cached the selector, or the last time it didn't exist
            if (this.$sfun_selectablecell_img[seq] == undefined || !this.$sfun_selectablecell_img[seq].length) {
                this.$sfun_selectablecell_img[seq] = $('#seq-' + seq);
            }
            // return cached jQuery object
            return this.$sfun_selectablecell_img[seq];
        },

        // ---------
        // FUNCTIONS
        // ---------

        'init': function () {
            var that = this;
            // no-js (js turned-off in browser), disabled-js (js turned off in sfun)
            if (this.$html.hasClass('disabled-js')) {
                // js not turned off, so browser will ignore noscript alternatives
                this.$document.ready(function () {
                    $('img[data-desrc!=""]').each(function () {
                        // manually swap in data-desrc to src
                        $(this).attr('src', $(this).data('desrc'));
                    });
                    console.log('Running in explicitly disabled-javascript mode.');
                });
            } else {
                this.$document.ready(function () {
                    that.documentReadyInit();
                });
            }
        },

        'documentReadyInit': function () {
            var that = this;
            // fill in jQuery cache
            this.$sfun = $(this.container_selector);
            this.$sfun_flow = $(this.container_selector + '.flow');
            this.$sfun_selectablecell = $(this.container_selector + ' > .selectablecell');
            this.$sfun_selectablecell_first = $(this.container_selector + ' > .selectablecell:first');
            // perform minimal operations on each cell
            this.$sfun_selectablecell.find('img').each(function () {
                // render Mustache templates
                var template = $(this).data('template-src');
                if (template != undefined) {
                    Mustache.parse(template);
                }
            });
            // initialise managers
            // queues and tables done after this file loaded, but pre-init()
            this.layoutManager = $.createHashTable('layoutManager');
            this.toolManager = $.createHashTable('toolManager');
            // process state in page HTML next
            this.state_previous['theme'] = this.state_default['theme'] = this.getTheme();
            this.state_previous['direction'] = this.state_default['direction'] = this.getDirection();
            this.state_previous['breadth'] = this.state_default['breadth'] = this.getBreadth();
            this.state_previous['seq'] = this.state_default['seq'] = 0;
            this.state_previous['offseq'] = this.state_default['offseq'] = 0;
            this.state_previous['debug'] = this.state_default['debug'] = this.debug = 0;
            this.state_previous['imagesnap'] = this.state_default['imagesnap'] = this.imagesnap = this.exp.imageSnapByScroll;
            // stick default timecode in here as a bit of a hack, until we use data-frame
            this.state_default['timecode'] = '00-00-10.0';
            // bind to page
            this.bindToWindow();
            this.bindToHeaderLinks();
            this.bindToHotKeys();
            this.bindToImageLinks();
            this.bindToDirectoryLinks();
            // this.bindToHover();
            // this.bindToVideoHover();
            // if we're sideways scrolling, bind to scroll event
            this.setDirection(this.getDirection());
            // execute queue of API calls
            this.exp.flush();
            // process state if set in URL (hash) first
            this.handlerHashChanged(this.getHash(), true);
            // don't bind to event handlers until we've started the initial hash (in its critical section)
            this.bindToHashChange();
            this.bindToScroll();
            // attach listener to window for resize (rare, but should update)
            this.$window.resize(function () {
                // this.buffer('init_resized',
                // // process event
                // function() {
                // flush cache
                that.getViewportWidth(true);
                that.getViewportHeight(true);
                // get current hash
                var hash = that.getHash();
                // update any parts of hash that are viewport-dependent
                if (hash.indexOf('offseq') != -1) {
                    var fromHash = that.hashParse(hash);
                    fromHash.offseq = that.imageCentreOffseq();
                    hash = that.hashGenerate(fromHash);
                    that.hashSetTo(hash, false);
                } else {
                    // process resize as forced hash change
                    that.handlerHashChanged(hash, true);
                }
                // },
                // // do nothing if dumped
                // function(){},
                // that.exp.implicitScrollBUFFER); // 50ms
            });
        },

        // ----------------
        // FUNCTIONS: cells
        // ----------------

        /**
         * check that ratio is set for each of the images
         * @param {object} range {first_1, last_n} range of sequence numbers
         * @todo optimise
         */
        'checkRatios': function (range) {
            var that = this;
            var deferred = this.getDeferred();
            var defs = [];
            var wrapUp = function () {
                deferred.resolve();
            }
            for (var i = range.first_1; i <= range.last_n; ++i) {
                var $ent = this.$cell(i);
                var $loadable = $ent.cachedFind('.loadable');
                var status = $loadable.data('status');
                if (status == this.exp.imageStatusMISSING || status == this.exp.imageStatusPENDING) {
                    // wait for image to be loaded in order to get ratio
                    defs[defs.length] = this.waitLoadedGetResolution($ent, true).done(function () {
                        that.setBound($ent, true);
                    });
                }
            }
            $.when.apply($, defs).always(wrapUp);
            return deferred;
        },

        /**
         * @param [object] optional range object
         * @return {object} jQuery deferred
         */
        'cellsResize': function (range) {
            var that = this;
            var deferred = this.getDeferred();
            // get current visible boundaries
            var vis = this.getVisibleBoundaries();
            if (range == undefined) {
                // set range as visible cells including visnear
                range = this.calcVisnear(vis.first, vis.last);
            }
            // create wrapUp function to manage visibility (table and status)
            var wrapUp = function () {
                // when layoutManager completes a resize, capture cell boundaries for altered cells
                // and invalidate those after last_n because they may have changed
                that.visTableMajor.updateRange(that.getDirection(), range.first_1, range.last_n);
                // see if resize means that different images are visible
                var aftervis = that.getVisibleBoundaries();
                if (vis.first == aftervis.first && vis.last == aftervis.last) {
                    // no need to reset visibles
                } else {
                    // use updated table to check visibles, but don't also tell then to reres yet
                    that.setVisibleAll(false);
                }
                deferred.resolve();
            }
            // add selected to range
            range.selected = this.$sfun_selectedcell.data('seq');
            // @todo maybe drop this.checkRatios() call
            // set ratio for images within range
            this.checkRatios(range).done(function () {
                // get the current layoutManager, if we have one
                var layout = that.layoutManager.select(0);
                if (layout != null) {
                    // tell it that we've resized cells
                    var laid = layout.receiverLayoutResized.call(layout.context, range);
                    // laid may be a deferred, but when can cope if it's not
                    $.when(laid).done(wrapUp);
                } else {
                    wrapUp();
                }
            });
            // return our deferred either way
            return deferred;
        },

        /**
         * clear previously assigned cell-specific width and height
         */
        'cellsClear': function () {
            var deferred = this.getDeferred();
            var wrapUp = function () {
                deferred.resolve();
            }    // get the current layoutManager, if we have one
            var layout = this.layoutManager.select(0);
            if (layout != null) {
                // tell it that we've resized cells
                var laid = layout.receiverLayoutCleared.call(layout.context);
                // laid may be a deferred, but when can cope if it's not
                $.when(laid).done(wrapUp);
            } else {
                wrapUp();
            }
            // return our deferred either way
            return deferred;
        },

        /**
         * check to see if we have ratios for all cells in minor, but haven't resized
         * @param {int} minor number (e.g. column number if direction x)
         */
        'cellsCheckMinor': function (minor) {
            var deferred = this.getDeferred();
            var wrapUp = function () {
                deferred.resolve();
            }    // get the current layoutManager, if we have one
            var layout = this.layoutManager.select(0);
            if (layout != null) {
                // tell it that we've resized cells
                var range = layout.receiverLayoutCellRatioChange.call(layout.context, minor);
                var laid = null;
                // if we get back a range, resize those cells (dump local deferred)
                if (range !== false) {
                    return this.cellsResize(range);
                }
                // laid may be a deferred, but when can cope if it's not
                $.when(laid).done(wrapUp);
            } else {
                wrapUp();
            }
            // return our deferred either way
            return deferred;
        },

        // ---------------------
        // FUNCTIONS: thumbnails
        // ---------------------

        /**
         * load thumbnail for principal image in cell, then recurse on subcells
         * @param {object}  $ent   jQuery cell
         * @param {boolean} recurse true to recurse
         */
        'loadThumb': function ($ent, recurse) {
            var that = this;
            // find principal images within this cell
            var $loadable = $ent.cachedFind('> .container > .loadable');
            if ($loadable.length) {
                // load thumbnail by swapping in src, if src not already set [async]
                var attr = $loadable.attr('src');
                if (typeof attr === 'undefined' || attr === false) {
                    // if we have already reres'd another image, use its size instead of the default thumbnail size
                    if ((this.last_longest != null) && $loadable.hasClass('reresable')) {
                        var highres = this.substitute($loadable.data('template-src'), {
                            'maxwidth': this.last_longest,
                            'maxheight': this.last_longest,
                            'timecode': this.state_default['timecode']
                        });
                        $loadable.attr('src', highres);
                    } else {
                        // otherwise just use desrc
                        $loadable.attr('src', $loadable.data('desrc'));
                    }
                }
            }
            // optionally recurse on sub-cells
            if (recurse) {
                $ent.cachedFind('.subcell').each(function () {
                    // only do 1 level of recursion
                    that.loadThumb($(this), false);
                });
            }
        },

        /**
         * update (x/y)-bound on boundable image in cell
         * @param jQuery cell that may have changed size
         * @return {object} $.Deferred
         */
        'loadThumbRefreshBounds': function ($ent) {
            var that = this;
            // find boundable entity
            var $boundable = $ent.cachedFind('.loadable');
            if ($boundable.length) {
                // 1. update loaded resolution if necessary first
                if ($boundable.data('loaded-width') == undefined || $boundable.data('loaded-height') == undefined) {
                    // if waitLoadedGetResolution succeeds, use loaded-width/height
                    return this.waitLoadedGetResolution($ent, true).done(function () {
                        // 2a. once we've got the loaded- dimensions, check bounds
                        that.setBound($ent, true);
                        // 3. once we know the ratio is set, check minor (column/cell) for resize
                        that.cellsCheckMinor(Math.floor($ent.data('seq') / that.getBreadth()));
                    });
                } else {
                    // 2b. as we've already got the loaded- dimensions, check bounds
                    this.setBound($ent, true);
                }
            }
            // return a resolved deferred
            return this.getDeferred().resolve();
        },

        // ------------------
        // FUNCTIONS: refresh
        // ------------------

        /**
         * Read data about the image and update metric display
         * @param {object} $ent jQuery object for image
         */
        'refreshMetric': function ($ent) {
            // find the imgmetric if it's set
            var $reresable = $ent.cachedFind('.reresable');
            var $metric = $ent.cachedFind('.imgmetric');
            var perc;
            if ($metric.length && $reresable.length) {
                var width_current = $reresable.width(), height_current = $reresable.height();
                var width_native = $reresable.data('native-width'), height_native = $reresable.data('native-height');
                // calculate percentage based on image area, or width [used currently]
                // perc = Math.round((width_current * height_current) * 100 / (width_native * height_native));
                perc = Math.round(width_current * 100 / width_native);
                if (this.debug && false) {
                    // show the size of the image that's been loaded into this img container
                    $metric.cachedFind('.width').html(Math.round($reresable.data('loaded-width')));
                    $metric.cachedFind('.height').html(Math.round($reresable.data('loaded-height')));
                    $metric.cachedFind('.size').show();
                } else {
                    // update with current image width and height
                    $metric.cachedFind('.width').html(Math.round(width_current));
                    $metric.cachedFind('.height').html(Math.round(height_current));
                }
                if (!isNaN(perc)) {
                    $metric.cachedFind('.perc').html(perc + '%').show();
                }
                // analyse to see if we're over/under the native res
                if (width_current > width_native || height_current > height_native) {
                    $metric.removeClass('super').addClass('sub');
                } else {
                    $metric.removeClass('sub').addClass('super');
                }
            }
            // no longer need to refresh the position of the metric, because don't after bounds before reres
            // this.refreshMetricPosition($ent);
            // 2s later, add the fade out class, which is almost instant because of mouseout
            $ent.delay(1000).queue(function (next) {
                $(this).addClass('reres-plus-2s');
                next();
            });
        },

        /**
         * check that the image metric is in the right place
         */
        'refreshMetricPosition': function ($ent) {
            // metric position is current determined using CSS
            return;

            var $metric = $ent.cachedFind('.imgmetric');
            if ($metric.length) {
                var $image = $ent.cachedFind('.reresable');
                if ($image.length) {
                    if ($image.hasClass('y-bound')) {
                        // move metric to image_x,50% for continuity with x-bound images
                        $metric.css({'left': $image[0].offsetLeft});
                    } else {
                        // no need to move the metric to the middle-left of an x-bound image
                        // $metric.css( { 'top': $image[0].offsetTop, 'left': $image[0].offsetLeft });
                    }
                }
            }
        },

        /**
         * refresh the cell.visible status on all/some of the entries
         * @param {int} scrolldir direction of scroll (+ve/-ve) or 0 for no scroll
         * @return {object} jQuery deferred
         */
        'refreshVisibility': function (scrolldir) {
            var that = this;
            // always test all images for visibility, reres, check selection
            return this.setVisibleAll(true).always(function () {
                that.refreshSelected(scrolldir);
            });
        },

        /**
         * refresh the selected entry after a visibility change
         * @param {int} scrolldir direction of scroll (+ve/-ve) or 0 for no scroll
         * @return {object} jQuery deferred
         */
        'refreshSelected': function (scrolldir) {
            var that = this;
            var $ent = this.$sfun_selectedcell;
            // if no selection, or the current selection isn't visible
            if (!$ent.length || !($ent.hasClass('visible') || $ent.hasClass('vispart'))) {
                if (this.debug && false) {
                    console.log('previously selected image ' + $ent.data('seq') + ' no longer visible');
                }
                // find the next visible one in the scroll direction
                $ent = $(this.container_selector + ' .selectablecell.visible:' + (scrolldir > 0 ? 'first' : 'last'));
                // if no fully visible images to select, use first partially visible
                if ($ent.length == 0) {
                    $ent = $(this.container_selector + ' .selectablecell.vispart:' + (scrolldir > 0 ? 'first' : 'last'));
                }
                if ($ent.length) {
                    // create a local context to allow us to numb listener
                    var localContext = this.eventQueue.push({
                        'key': 'selected:seq=' + $ent.data('seq'),
                        'comment': 'localContext for refreshSelected (image-' + $ent.data('seq') + ')',
                        'replaceEvent': true
                    });
                    // use hash to select new and deselect old, but numb listener and parent deferred
                    return this.imageAdvanceTo($ent.data('seq'), localContext);
                } else {
                    // if no visible/vispart images, don't try to select anything
                }
            } else {
                // the current selection is still visible, offseq may need updating
                var seq = $ent.data('seq');
                // work out image and viewport's positions on major axis
                var offseq = this.imageStillShiftOffseq(seq);
                // compare with current offseq to see if we need to refresh hash
                var coffseq = this.getOffseq();
                if (offseq != coffseq) {
                    // create a local context to allow us to numb listener
                    var localContext = this.eventQueue.push({
                        'key': 'setoff:offseq=' + offseq,
                        'comment': 'localContext for refreshSelected-nochange (image-' + seq + ' offseq-' + offseq + ')',
                        'replaceEvent': true
                    });
                    // select image using hash update
                    return this.fireHashUpdate({'seq': seq, 'offseq': offseq}, false, localContext).done(function () {
                        that.eventQueue.resolve(localContext);
                    });
                }
            }
            return this.getDeferred().resolve();
        },

        /**
         * Check the display resolution of the image and swap out src if higher res available
         * @param {object} $ent jQuery entity (shared cached copy)
         * @return {object} jQuery deferred
         */
        'refreshResolution': function ($ent) {
            var that = this;
            var $reresable = $ent.cachedFind('.reresable');
            // skip if nothing reresable
            if (!$reresable.length) {
                return this.getDeferred().resolve();
            }
            // skip if already reresing
            if ($ent.hasClass('reresing')) {
                return this.getDeferred().resolve();
            }
            // flag this cell's image as updating its resolution
            $ent.addClass('reresing');
            // [could] move the metric into position and show
            // this.refreshMetricPosition($ent);
            // create local deferred and local wrapUp
            var deferred = this.getDeferred();
            var wrapUp = function () {
                // remove reresing status
                $ent.removeClass('reresing');
                // resolve deferred
                deferred.resolve();
            };
            // loaded width/height should be set when thumbnail/last reres loaded
            var loadedWidth = $reresable.data('loaded-width');
            var loadedHeight = $reresable.data('loaded-height');
            var imageContainerWidth = $reresable.width() * window.devicePixelRatio;
            var imageContainerHeight = $reresable.height() * window.devicePixelRatio;
            // try and refresh the metadata
            this.refreshMetadata($ent)
                .done(function () {
                    // if successful, use metadata to make decision about reres
                    var nativeWidth = $reresable.data('native-width');
                    var nativeHeight = $reresable.data('native-height');
                    // analyse (Constantly::RESBRACKET)
                    var resbracket = 250, brackWidth, brackHeight;
                    var bigger = imageContainerWidth > loadedWidth || imageContainerHeight > loadedHeight;
                    var available = loadedWidth < nativeWidth || loadedHeight < nativeHeight;
                    // optional debugging
                    if (that.debug && false) {
                        console.log('image-' + $ent.data('seq') + ': checking resolution w[' + imageContainerWidth + '] h[' + imageContainerHeight + '] nativeWidth[' + nativeWidth + '] nativeHeight[' + nativeHeight + '] loadedWidth[' + loadedWidth + '] loadedHeight[' + loadedHeight + ']');
                    }
                    // test to see if we're displaying an image at more than 100%
                    if (bigger && available) {
                        var $metricperc = $ent.cachedFind('.imgmetric .perc');
                        $metricperc.html('Reresing...');
                        // only need to think about one dimension, because ratio of image is fixed
                        var majorw = (imageContainerWidth >= imageContainerHeight);
                        // but that dimension has to be the major dimension
                        // @todo could probably calculate both brackWidth and brackHeight, then combine these two
                        // find the smallest resbracket less than nativeWidth, but greater that loadedWidth
                        brackWidth = Math.min(Math.ceil(imageContainerWidth / resbracket) * resbracket, nativeWidth);
                        // same but pivot on height rather than width
                        brackHeight = Math.min(Math.ceil(imageContainerHeight / resbracket) * resbracket, nativeHeight);
                        if (majorw) {
                            // could have resized down, so only swap the image if the brackWidth is greater that the current loaded
                            if (brackWidth > loadedWidth) {
                                // don't store max longest to shortcut next thumb load; always load 200s
                                // this.last_longest = brackWidth;
                                // swap out image and wait for swap to complete
                                that.imageReres($ent, that.substitute($reresable.data('template-src'), {
                                    'maxwidth': brackWidth,
                                    'maxheight': brackHeight,
                                    'timecode': that.state_default['timecode']
                                })).always(wrapUp);
                            } else {
                                wrapUp();
                            }
                        } else {
                            if (brackHeight > loadedHeight) {
                                // don't store max longest to shortcut next thumb load; always load 200s
                                // this.last_longest = brackHeight;
                                // swap out image and wait for swap to complete
                                that.imageReres($ent, that.substitute($reresable.data('template-src'), {
                                    'maxheight': brackHeight,
                                    'maxwidth': brackWidth,
                                    'timecode': that.state_default['timecode']
                                })).always(wrapUp);
                            } else {
                                wrapUp();
                            }
                        }
                    } else {
                        wrapUp();
                    }
                })
                .fail(function () {
                    // if we can't refresh the metadata, try and manage without it
                    if (typeof($reresable.data('loaded-width')) != 'undefined' && typeof($reresable.data('loaded-height')) != 'undefined') {
                        if ((imageContainerWidth > loadedWidth) || (imageContainerHeight > loadedHeight)) {
                            // don't know native width, so just request at loadedWidth/Height
                            that.imageReres($ent, that.substitute($reresable.data('template-src'), {
                                'maxwidth': imageContainerWidth,
                                'maxheight': imageContainerHeight,
                                'timecode': that.state_default['timecode']
                            })).always(wrapUp);
                        } else {
                            wrapUp();
                        }
                    } else {
                        wrapUp();
                    }
                });
            return deferred;
        },

        /**
         * Request metadata about this image from the server if we don't have it
         * @param {object} $ent jQuery entity (shared cached copy)
         * @return {object} jQuery deferred
         */
        'refreshMetadata': function ($ent) {
            var that = this;
            var $reresable = $ent.cachedFind('.reresable');
            if ($reresable.length && $reresable.data('meta-src')) {
                // test to see if we have the metadata
                if (typeof($reresable.data('native-width')) == 'undefined' || typeof($reresable.data('native-height')) == 'undefined') {
                    var deferred = this.getDeferred();
                    // flag that we're loading metadata
                    var $metricperc = $ent.cachedFind('.imgmetric .perc');
                    $metricperc.html('Loading metadata...');
                    // only allow the request to fire once per image
                    if ($metricperc.data('loading') == undefined) {
                        $metricperc.data('loading', true);
                        // fire ajax request
                        $.ajax({
                            url: $reresable.data('meta-src'),
                            dataType: 'json',
                        })
                            .done(function (data, textStatus, jqXHR) {
                                that.refreshMetadataApplyToFields($ent, data);
                                // resolve the context
                                deferred.resolve();
                            })
                            .fail(function (jqXHR, textStatus, errorThrown) {
                                // resolve the context (as a failure)
                                deferred.reject();
                            });
                        if (this.debug && false) {
                            console.log('image-' + $ent.data('seq') + ': fired request for native width and height');
                        }
                    } else {
                        deferred.fail();
                    }
                    return deferred;
                } else {
                    // no need to update metadata
                    return this.getDeferred().resolve();
                }
            }
            // if we couldn't find a suitable candidate and get it's metadata, fail out the deferred
            return this.getDeferred().reject();
        },

        /**
         * Apply returned metadata to fields
         * @param {object} $ent jQuery entity (shared cached copy)
         * @param {object} data metadata from server
         */
        'refreshMetadataApplyToFields': function ($ent, data) {
            var $reresable = $ent.cachedFind('.reresable');
            if (typeof(data.metadata) != 'undefined') {
                // if we get a response, set the missing resolution data to the image
                $reresable.data('native-width', data.metadata.originalWidth);
                $reresable.data('native-height', data.metadata.originalHeight);
                if (this.debug && false) {
                    console.log('image-' + $ent.data('seq') + ': received native width[' + $reresable.data('native-width') + '] height[' + $reresable.data('native-height') + ']');
                }
                // set missing metadata fields to their DOM elements
                var fields = this.metadata_fields.concat(this.metadata_flags);
                for (var i = 0; i < fields.length; ++i) {
                    var value = data.metadata[fields[i]];
                    var $field = $ent.cachedFind('.' + fields[i]);
                    // test to see if this metadata field is the default
                    if (value == this.state_default[fields[i]]) {
                        if (this.debug && false) {
                            console.log('v[' + value + '] default[' + this.state_default[fields[i]] + '] is default');
                        }
                        // tag most as defaults (which tends to hide them)
                        switch (fields[i]) {
                            case 'iptcHeadline':
                                break;
                            case 'iptcByline':
                            case 'iptcCaption':
                            case 'iptcCopyright':
                            case 'iptcKeywords':
                            case 'iptcSource':
                            default:
                                $field.addClass('iptc_default');
                                break;
                        }
                    } else {
                        // if the values a non-default, show them
                        switch (fields[i]) {
                            case 'iptcHeadline':
                            case 'iptcByline':
                                $field.html(value);
                                break;
                            case 'iptcCaption':
                            case 'iptcCopyright':
                            case 'iptcKeywords':
                            case 'iptcSource':
                                $field.attr('title', value);
                                break;
                            case 'editable':
                                if (value) {
                                    $field.show();
                                } else {
                                    $field.hide();
                                }
                                break;
                        }
                        $field.removeClass('iptc_default');
                    }
                    $field.removeClass('iptc_undefined');
                }
                // store the entire meta object in the cached jquery object
                $ent.cachedSet('metadata', data.metadata);
            }
        },

        /**
         * refresh a single image, but ensure that it's loaded first
         * @param {object} $ent jQuery entity (shared cached copy)
         * @param {boolean} reres also refresh the image's resolution
         * @return {object} jQuery deferred
         */
        'refreshImageResolution': function ($ent, reres) {
            var that = this;
            var deferred = this.getDeferred();
            // final stage is to refresh the metric
            var wrapUp = function () {
                // resolve deferred
                deferred.resolve();
                // update metric [async]
                that.refreshMetric($ent);
            };
            if (reres) {
                // change out the image for a better resolution if one's available
                this.refreshResolution($ent).always(function () {
                    wrapUp();
                });
            } else {
                wrapUp();
            }
            return deferred;
        },

        /**
         * refresh and reres all visible images
         * @return {object} jQuery deferred
         */
        'refreshVisibleImageSet': function () {
            return this.refreshAnImageSet($(this.container_selector + ' .selectablecell.visible, ' + this.container_selector + ' .selectablecell.vispart'), true);
        },

        /**
         * refresh all visnear images, generally don't reres
         * @return {object} jQuery deferred
         */
        'refreshVisnearImageSet': function () {
            // reres only if the shortcut is null
            return this.refreshAnImageSet($(this.container_selector + ' .selectablecell.visnear'), (this.last_longest == null));
        },

        /**
         * refresh a specified set of images
         * @param {object} $set jQuery entity for selection
         * @param {boolean} reres true to also reres the images after loading thumbs
         * @return {object} jQuery deferred
         */
        'refreshAnImageSet': function ($set, reres) {
            var that = this;
            if ($set.length) {
                var deferred = this.getDeferred();
                var defs = [];
                // stage 1a: make sure thumbnails loaded and refresh bounds as a batch
                $set.each(function () {
                    var $ent = $(this);
                    defs.push(that.loadThumbRefreshBounds($ent));
                });
                $.when.apply($, defs).always(function () {
                    defs = [];
                    // stage 1b: refresh cell sizes for cells in and near image set
                    defs.push(that.cellsResize(that.calcVisnear($set.first().data('seq'), $set.last().data('seq'))));
                    $.when.apply($, defs).always(function () {
                        defs = [];
                        // stage 2: if we're reresing the images
                        if (reres) {
                            // refresh $set because resize may have added more visible/vispart/visnear cells
                            $set = $set.refresh();
                            // stage 3: refresh resolutions as a batch
                            $set.each(function () {
                                // get shared [cached] copy of cell
                                var $ent = that.$cell($(this).data('seq'));
                                defs.push(that.refreshImageResolution($ent, true));
                            });
                            $.when.apply($, defs).always(function () {
                                // finally resolve
                                deferred.resolve();
                            });
                        } else {
                            deferred.resolve();
                        }
                    });
                });
                return deferred;
            }
            return this.getDeferred().resolve();
        },

        // ------------------
        // FUNCTIONS: getters
        // ------------------

        /**
         * updated loaded-width and loaded-height data attributes
         * @param {jQuery object} $ent image to check
         * @param {boolean} recurse true to load subcells too
         * @return {object} jQuery deferred
         */
        'waitLoadedGetResolution': function ($ent, recurse) {
            var that = this;
            var deferred = this.getDeferred();
            var defs = [];
            var wrapUp = function () {
                deferred.resolve();
            }
            // process principal image if cell has one
            var $loadable = $ent.cachedFind('> .container > .loadable');
            if ($loadable.length) {
                var principalDeferred = this.getDeferred();
                defs.push(principalDeferred);
                // update loaded resolution
                var im = new Image();
                // use load handler to read image size
                im.onload = this.getImageWatcher(im, $loadable, principalDeferred);
                // if for any reason the image can't be loaded
                im.onerror = function () {
                    // strip loadable property
                    $loadable.removeClass('loadable');
                    // prime loadable to reload
                    $loadable.data('ratio', undefined);
                    $loadable.data('status', that.exp.imageStatusERROR);
                    $loadable.removeAttr('src');
                    // reset the image
                    eim = new Image();
                    eim.onload = that.getImageWatcher(eim, $loadable, principalDeferred);
                    // swap the source out for the error image
                    eim.src = that.getErrorImagePath();
                    // now wait for onload event on error image to resolve deferred
                };
                // if the src attribute is undefined, set it
                if ($loadable.attr('src') == undefined) {
                    // use common loadThumb to set it, but don't recurse
                    this.loadThumb($ent, false);
                }
                im.src = $loadable.attr('src');
                if (this.debug && false) {
                    console.log('image-' + $ent.data('seq') + ': fired update loaded resolution request');
                }
            }
            // if set, recurse on subcells
            if (recurse) {
                $ent.cachedFind('.subcell').each(function () {
                    defs.push(that.waitLoadedGetResolution($(this), false));
                });
            }
            // wait for all deps to be resolved (includes principal)
            $.when.apply($, defs).done(wrapUp);
            return deferred;
        },

        /**
         * @return {function} an onload function for this image
         */
        'getImageWatcher': function (im, $loadable, deferred) {
            var that = this;
            return function () {
                // set loaded dimensions
                $loadable.data('loaded-width', im.width);
                $loadable.data('loaded-height', im.height);
                $loadable.data('ratio', im.width / im.height);
                $loadable.data('status', that.exp.imageStatusLOADED);
                // if we've loaded the image for the first time, swap it in (fallback)
                if ($loadable.attr('src') == undefined) {
                    $loadable.attr('src', im.src);
                }
                im = null;
                if (that.debug && false) {
                    console.log('image-' + $loadable.parent('.cell').data('seq') + ': loaded resolution updated [' + $loadable.data('loaded-width') + ',' + $loadable.data('loaded-height') + ']');
                }
                if (deferred != undefined) {
                    // notify promise of resolution
                    deferred.resolve();
                }
            }
        },

        /**
         * Get the real flow direction, not just what the class says because the browser might not support all directions
         * (needs flexbox)
         * @return current flow direction
         */
        'getDirection': function () {
            var direction = 'y';
            if (this.$html.hasClass('flexbox') && this.$sfun.hasClass('flow-x')) {
                direction = 'x';
            }
            return direction;
        },

        /**
         * Get the flow breadth
         * @return current flow breadth
         */
        'getBreadth': function () {
            var breadth = 2;
            if (this.$sfun.hasClass('flow-1')) breadth = 1;
            if (this.$sfun.hasClass('flow-4')) breadth = 4;
            if (this.$sfun.hasClass('flow-8')) breadth = 8;
            return breadth;
        },

        /**
         * Get the flow breadth
         * @return next flow breadth in sequence
         */
        'getBreadthNext': function (from, inc) {
            var b = [1, 2, 4, 8];
            var bref = b.indexOf(from);
            if (bref == -1) {
                return 2;
            } else {
                bref += inc;
                // don't allow b to be less than minimum breadth
                if (bref < 0) bref = 0;
                // don't allow b to exceed max breadth
                if (bref >= b.length) bref = b.length - 1;
            }
            return (b[bref]);
        },

        /**
         * Get the image display mode
         * First token also contains caching instructions
         * e.g. /file/, /filenocache/, /filecacherefresh/
         * @return string mode (file|zoom)
         */
        'getMode': function () {
            var first = this.getFirstUrlToken();
            if (first.indexOf('zoom') === 0) {
                return 'zoom';
            }
            return 'file';
        },

        /**
         * @returns {boolean} true if we're in zoom mode
         */
        'isZoomMode': function() {
            return (this.getMode() == 'zoom');
        },

        /**
         * page scroll offset to sequence number is stored in the html tag [default to 0]
         * @return {int} scroll offset to seq
         */
        'getOffseq': function () {
            var offseq = this.$html.data('offseq');
            if (offseq == undefined) {
                return 0;
            }
            return offseq;
        },

        /**
         * @return {float} current size of cell along the major axis
         */
        'getCellMajor': function () {
            if (this.getDirection() == 'x') {
                return this.$sfun_selectablecell_first.width() + this.getAlley();
            } else {
                return this.$sfun_selectablecell_first.height() + this.getAlley();
            }
        },

        /**
         * @param {int} round non-zero to round to the nearest whole cell
         *   negative to round down, positive to round up
         * @return {float} work out how many cells appear on the major axis
         */
        'getCellMajorCount': function (round) {
            var cell_major = this.getCellMajor();
            var major_len = (this.getDirection() == 'x' ? this.getViewportWidth() : this.getViewportHeight());
            var cell_count = major_len / cell_major;
            // assume don't round if unset
            if (round == undefined) {
                round = 0;
            }
            // negative to round down
            if (round < 0) {
                cell_count = Math.floor(cell_count);
            }
            // negative to round up
            if (round > 0) {
                cell_count = Math.ceil(cell_count);
            }
            // catch case where we've got full screen images (can't round them down)
            if (cell_count <= 0) {
                cell_count = 1;
            }
            return cell_count;
        },

        /**
         * Return defaults
         *   direction: page direction
         *   breadth: number of cells across minor axis of page
         *   seq: sequence number
         *   offseq: scroll offset to sequence
         * @return {object} get URL default hash arguments
         */
        'getDefaults': function () {
            return {
                'theme': this.state_default['theme'],
                'direction': this.state_default['direction'],
                'breadth': this.state_default['breadth'],
                'seq': this.state_default['seq'],
                'offseq': this.state_default['offseq'],
                'debug': this.state_default['debug'],
                'imagesnap': this.state_default['imagesnap']
            };
        },

        /**
         * @return {int} sequence number of currently selected cell [default to 0]
         */
        'getSeq': function () {
            var $ent = this.$sfun_selectedcell;
            if (!$ent.length) {
                return 0;
            }
            var seq = $ent.data('seq');
            if (seq == undefined) {
                return 0;
            }
            return seq;
        },

        /**
         * @return {string} theme name, with the theme- prepend
         */
        'getTheme': function () {
            if (this.$html.hasClass('theme-dark')) {
                return 'theme-dark';
            }
            return 'theme-light';
        },

        /**
         * @return {int} total number of entities (max entry seq+1)
         */
        'getTotalEntries': function () {
            return (parseInt($(this.container_selector + ' .selectablecell:last').data('seq')) + 1);
        },

        /**
         * @param {object} $ent jQuery entity
         * @return {string} type of entity
         */
        'getType': function ($ent) {
            if ($ent.hasClass('image-type')) {
                return 'image';
            } else if ($ent.hasClass('video-type')) {
                return 'video';
            } else if ($ent.hasClass('directory-type')) {
                return 'directory';
            }
        },

        /**
         * @return {int} width of page outer border (gutter) in pixels [default 0]
         */
        'getGutter': function () {
            if (this.getGutter_static == undefined) {
                var $gut = $('#gutterball');
                if ($gut.length) {
                    this.getGutter_static = $gut.width();
                } else {
                    this.getGutter_static = 0;
                }
            }
            return this.getGutter_static;
        },

        /**
         * @return {int} width of alley (cell-to-cell) in pixels [default 0]
         */
        'getAlley': function () {
            if (this.getAlley_static == undefined) {
                var $alley = $('#alleyball');
                if ($alley.length) {
                    this.getAlley_static = $alley.width();
                } else {
                    this.getAlley_static = 0;
                }
            }
            return this.getAlley_static;
        },

        /**
         * @return {int | bool} next sequence number, or false on failure
         */
        'getNextSeq': function (seq, increment) {
            var startingPointSeq = seq;
            do {
                seq = (seq + increment) % this.getTotalEntries();
                // wrap around
                if (seq < 0 && increment < 0) {
                    seq = this.getTotalEntries() - 1;
                }
                if (this.$cell(seq).length) {
                    return seq;
                }
            } while (seq != this.startingPointSeq);
            return false;
        },

        /**
         * return a shared deferred if one exists, or create one if not
         * @return {jQuery} deferred
         */
        'getDeferred': function () {
            return new $.Deferred();
        },

        /**
         * get the first part of the URL
         * @returns {string} first token
         */
        'getFirstUrlToken': function() {
            var url = window.location.pathname;
            var slashpos = url.indexOf('/', 1);
            if (slashpos > 0) {
                // pull token without first /
                var token = url.substring(1, slashpos);
                return token;
            }
            return url;
        },

        /**
         * get the viewport x position (scroll left)
         * @return {real} position of viewport in whole pixels
         */
        'getViewportXpos': function (force) {
            return this.exp.api_round(this.$document.scrollLeft(), 0);
        },

        /**
         * get the viewport y position (scroll top)
         * @return {real} position of viewport in whole pixels
         */
        'getViewportYpos': function (force) {
            return this.exp.api_round(this.$document.scrollTop(), 0);
        },

        /**
         * get the viewport width, but don't cache it because scrollbars appear/disappear
         * @return {real} width of viewport in pixels
         */
        'getViewportWidth': function (force) {
            if (this.$sfun_yardx.length) {
                return this.$sfun_yardx.width();
            } else {
                // fall back to window
                return this.$window.width();
            }
        },

        /**
         * get the viewport height, but don't cache it because scrollbars appear/disappear
         * @return {real} height of viewport in pixels
         */
        'getViewportHeight': function (force) {
            if (this.$sfun_yardy.length) {
                return this.$sfun_yardy.height();
            } else {
                // fall back to window
                return this.$window.height();
            }
        },

        'getCanvasWidth': function() {
            if (this.isZoomMode()) {
                return this.$sfun.data('width');
            }
        },

        'getCanvasHeight': function() {
            if (this.isZoomMode()) {
                return this.$sfun.data('height');
            }
        },

        /**
         * @todo probably need to find a way to make this overwriteable for js lib clients
         * @return string path to error image
         */
        'getErrorImagePath': function () {
            return '/chrome/images/fullres/missing_image.jpg';
        },

        // ------------------
        // FUNCTIONS: setters
        //   all called downstream of events
        // ------------------

        /**
         * set all 'flow' elements to flow in the direction
         * @param string x|y for horizontal or vertical scrolling
         */
        'setDirection': function (direction) {
            var changed = (this.getDirection() !== direction);
            var invdir = (direction == 'x' ? 'y' : 'x');
            // set flow-<direction> on ul.flow and html
            this.$sfun_flow.add(this.$html).addClass('flow-' + direction).removeClass('flow-' + invdir);
            return changed;
        },

        /**
         * set the width of the screen flow
         * e.g. number of cells vertically if in vertical mode
         */
        'setBreadth': function (breadth) {
            var changed = (this.getBreadth() !== breadth);
            // remove all the other breadths
            for (var i = 1; i <= 8; i = i * 2) {
                // don't remove the breadth we're setting
                if (i == breadth) {
                    continue;
                }
                this.$sfun_flow.removeClass('flow-' + i);
                this.$html.removeClass('flow-' + i);
            }
            // apply class to both sfun and page (for page-wise effects)
            this.$sfun_flow.addClass('flow-' + breadth);
            this.$html.addClass('flow-' + breadth);
            // scrub cached yardsticks/balls affected by breadth
            this.getGutter_static = undefined;
            this.getAlley_static = undefined
            // return whether we actually changed it or not
            return changed;
        },

        /**
         * @param int sequence number of image to make current
         */
        'setSeq': function (seq) {
            var changed = (this.getSeq() !== seq);
            var position;
            if (this.$sfun_selectedcell.length) {
                // deselect old image
                this.$sfun_selectedcell.removeClass('selected');
            }
            // select new image
            this.$sfun_selectedcell = this.$cell(seq);
            this.$sfun_selectedcell.addClass('selected');
            return changed;
        },

        /**
         * page scroll offset to sequence number is stored in the html tag
         * @param {int} offset scroll offset to seq
         */
        'setOffseq': function (offseq) {
            var current = this.$html.data('offseq');
            var changed = (current !== offseq && current !== undefined);
            this.$html.data('offseq', offseq);
            return changed;
        },

        /**
         * @param {string} theme_name css name of theme to apply (includes theme- prepend)
         */
        'setTheme': function (theme_name) {
            switch (theme_name) {
                case 'theme-dark':
                    this.$html.addClass(theme_name);
                    break;
                case 'theme-light':
                default:
                    // darkness is only the absence of light
                    this.$html.removeClass('theme-dark');
                    break;
            }
        },

        /**
         * @param {int} newd (non-zero equals true)
         */
        'setDebug': function (newd) {
            var changed = (this.debug !== newd && this.debug !== undefined);
            if (changed) {
                this.debug = newd;
                if (this.debug) {
                    // if debugging is now on
                    this.$html.addClass('debug');
                    // show event vis
                    this.eventQueue.display(true);
                } else {
                    // if debugging is now off
                    // hide event vis
                    this.eventQueue.display(false);
                    // remove debug class to hide debugging controls
                    this.$html.removeClass('debug');
                }
            }
            return changed;
        },

        /**
         * set bounds for a cell
         * @param {object} $ent jQuery entity
         * @param {boolean} recurse true to recurse on subcells
         */
        'setBound': function ($ent, recurse) {
            var that = this;
            var $boundable = $ent.cachedFind('> .container > .boundable');
            if ($boundable.length) {
                // detect if the image is bound by width/height in this container
                var ix = $boundable.data('loaded-width'), iy = $boundable.data('loaded-height');
                // read container width/height
                var cx = $ent.width(), cy = $ent.height();
                var cratio = cx / cy;
                if (this.debug && false) {
                    console.log('image-' + $ent.data('seq') + ': [' + ix + ',' + iy + '] checking bound within [' + cx + ',' + cy + ']');
                }
                var iratio = ix / iy;
                var direction = ((cratio / iratio) > 1.0 ? 'y' : 'x');
                var invdir = (direction == 'x' ? 'y' : 'x');
                if (this.debug && false) {
                    console.log('cx[' + cx + '] cy[' + cy + '] cratio[' + cratio + '], ix[' + ix + '] iy[' + iy + '] iratio['
                        + iratio + ']: ' + (cratio / iratio).toPrecision(3) + '= ' + direction + '-bound');
                }
                // apply class to image
                $boundable.addClass(direction + '-bound').removeClass(invdir + '-bound');
            }
            // optionally recurse on sub-cells
            if (recurse) {
                $ent.cachedFind('.subcell').each(function () {
                    // only do 1 level of recursion
                    that.setBound($(this), false);
                });
            }
        },

        /**
         * @param {object} target position
         *        {int} scrollLeft distance from left of page in pixels
         *        {int} scrollTop  distance from top of page in pixels
         * @return {object} target position cropped against viewport
         */
        'cropScrollPositionAgainstViewport': function (target) {
            return {
                'scrollLeft': this.exp.api_round(Math.max(0, Math.min(target.scrollLeft, this.$document.width() - this.getViewportWidth())), 0),
                'scrollTop': this.exp.api_round(Math.max(0, Math.min(target.scrollTop, this.$document.height() - this.getViewportHeight())), 0)
            };
        },

        /**
         * ensure that a given image lies within the current viewport
         * @param {int} seq image sequence number
         * @param {int} [offseq] scroll offset to seq image [default: 0]
         * @param {object} [eventContext] optional event context to attach this to
         * @return {object} jQuery deferred
         */
        'envisionSeq': function (seq, offseq, eventContext) {
            var $ent = this.$cell(seq);
            var direction = this.getDirection();
            if (offseq == undefined) {
                offseq = 0;
            }
            // if we found the cell
            if ($ent.length) {
                // get the cell's position
                var position = $ent.offset();
                // work out the target position
                var gutter = this.getGutter();
                var target = {
                    'scrollLeft': (direction == 'x' ? position.left - offseq - gutter : 0),
                    'scrollTop': (direction == 'x' ? 0 : position.top - offseq - gutter)
                };
                // pass target to shared function
                return this.envisionPos(target, eventContext);
            }
            return this.getDeferred().resolve();
        },

        /**
         * ensure that a given target position lies within the current viewport
         * @param {object} target {[scrollLeft], [scrollTop]} position in pixels, absolute or relative to current
         * @param {object} [eventContext] optional event context to attach this to
         * @param {boolean} [relativeTarget] true to use target as a relative offset from current position
         * @return {object} jQuery deferred
         */
        'envisionPos': function (target, eventContext, relativeTarget) {
            var fireScroll = false;
            // setup argument defaults
            if (relativeTarget == undefined) {
                relativeTarget = false;
            }
            // work out current scroll position
            var scroll = {'scrollTop': this.getViewportYpos(), 'scrollLeft': this.getViewportXpos()};
            if (relativeTarget) {
                // increment relative target by current scroll position
                if (typeof(target.scrollTop) != 'undefined') {
                    target.scrollTop += scroll.scrollTop;
                } else {
                    target.scrollTop = scroll.scrollTop;
                }
                if (typeof(target.scrollLeft) != 'undefined') {
                    target.scrollLeft += scroll.scrollLeft;
                } else {
                    target.scrollLeft = scroll.scrollLeft;
                }
            }
            // crop the target position against reachable bounds
            target = this.cropScrollPositionAgainstViewport(target);
            // check to see if our current scroll position reflects the target position
            var direction = this.getDirection();
            if (direction == 'x') {
                if (target.scrollLeft != scroll.scrollLeft) {
                    fireScroll = true;
                }
            } else {
                if (target.scrollTop != scroll.scrollTop) {
                    fireScroll = true;
                }
            }
            // if we are at the position, just refresh visibilty
            if (!fireScroll) {
                return this.refreshVisibility(0);
            }
            // scroll to the target position
            // animate if we're using a relative offset
            return this.fireScrollUpdate(target, eventContext, (typeof(eventContext.animateable) != 'undefined' ? eventContext.animateable : 0));
        },

        /**
         * Work out what cells are visible at the moment
         * @return {object} describing visible cells
         *   first:seq of first visible, last:seq of last visible
         */
        'getVisibleBoundaries': function () {
            var vis = {};
            var min, max;
            // cells' offset is a couple of pixels left of image
            var rounding = this.getGutter();
            var direction = this.getDirection();
            // get screen bounds along major axis (min and max)
            if (direction == 'x') {
                // min is left bar minus rounding for border/margin
                min = this.getViewportXpos() - rounding;
                // max is right bar minus rounding for border/margin
                max = this.getViewportXpos() + this.getViewportWidth() + rounding;
            } else {
                min = this.getViewportYpos() - rounding;
                max = this.getViewportYpos() + this.getViewportHeight() + rounding;
            }
            // find first spanning min boundary
            var firstRef = this.visTableMajor.findCompare(min, this.exp.compareGTE, false);
            var firstMatch = this.visTableMajor.select(firstRef);
            if (firstMatch == null) {
                // use the first entry in table
                firstMatch = this.visTableMajor.select(0);
            }
            // debugging breakpoint
            if (firstMatch.$ent == undefined) {
                console.log(firstMatch);
            }
            vis.first = firstMatch.$ent.data('seq');
            // work backwards from spanning min boundary to include partials
            for (var i = vis.first; i >= 0; --i) {
                var $ent = this.$cell(i);
                var position = $ent.offset();
                var posMajor = (direction == 'x' ? position.left + $ent.width() : position.top + $ent.height());
                if (posMajor > min) {
                    vis.first = i;
                } else {
                    // don't go further than first non-partial
                    break;
                }
            }
            // find last spanning max boundary
            var lastRef = this.visTableMajor.findCompare(max - 1, this.exp.compareLTE, true);
            var lastMatch = this.visTableMajor.select(lastRef);
            if (lastMatch == null) {
                // use the last entry in the table
                lastMatch = this.visTableMajor.select(this.visTableMajor.getSize() - 1);
            }
            vis.last = lastMatch.$ent.data('seq');
            // assume all visibles are non-partial, then test
            vis.lastFirstPartial = -1;
            vis.firstLastPartial = 99999;
            // check first visibles for partial visibility
            for (var i = vis.first; i <= vis.last; ++i) {
                var $ent = this.$cell(i);
                var position = $ent.offset();
                var posMajor = (direction == 'x' ? position.left : position.top);
                if (posMajor < min) {
                    vis.lastFirstPartial = i;
                } else {
                    // don't go further than first non-partial
                    break;
                }
            }
            // check last visibles for partial visibility
            for (var i = vis.last; i >= vis.first; i--) {
                var $ent = this.$cell(i);
                var position = $ent.offset();
                var posMajor = (direction == 'x' ? position.left + $ent.width() : position.top + $ent.height());
                if (posMajor > max) {
                    vis.firstLastPartial = i;
                } else {
                    // don't do further than first non-partial
                    break;
                }
            }
            return vis;
        },

        /**
         * Loop through all images
         * @todo optimise
         * @param {boolean} thenRefresh true to also refresh new vis images
         * @return {object} jQuery deferred
         */
        'setVisibleAll': function (thenRefresh) {
            var that = this;
            // test to see if we found any selectable cells
            if (this.$sfun_selectablecell.length) {
                var deferred = this.getDeferred();
                var defs = [];
                var wrapUp = function () {
                    // resolve the deferred
                    deferred.resolve();
                }
                // clear all the visible images
                this.$sfun_selectablecell.removeClass('visible vispart visnear');
                // derive boundaries of visible cells
                var vis = this.getVisibleBoundaries();
                for (var i = vis.first; i <= vis.last; i++) {
                    var vistype = ((i <= vis.lastFirstPartial || i >= vis.firstLastPartial) ? 'vispart' : 'visible');
                    this.setImageVisibilityClass(this.$cell(i), vistype);
                }
                if (thenRefresh) {
                    // now batch process all the visibles
                    // either synchronously or asynchronously
                    if (false) {
                        // sync, wait for the images to load first
                        this.refreshVisibleImageSet().done(wrapUp);
                    } else {
                        // async, don't wait for the images to load
                        this.refreshVisibleImageSet();
                        wrapUp();
                    }
                } else {
                    wrapUp();
                }
                // now request visnear images, but don't wait for them (async, not resync)
                var ignored_deferred = this.setVisnearAll(vis);
                return deferred;
            }
            return this.getDeferred().resolve();
        },

        /**
         * either flag an image as visible or not visible
         * @param {jQuery} $ent image
         * @param {string} 'visible' true to make visible, 'not visible' to hide
         *   or 'visnear' to make visible but not re-res
         */
        'setImageVisibilityClass': function ($ent, vis) {
            var that = this;
            if (this.debug && false) {
                console.log('image-' + $ent.data('seq') + ': making ' + vis);
            }
            // process visibility string
            if (vis == 'not-visible') {
                // make it not-visible
                $ent.removeClass('visible');
            } else {
                var alsoload = false;
                // apply classes
                if (vis == 'visnear') {
                    // mark image as near visible
                    $ent.removeClass('vispart visible').addClass('visnear');
                } else if (vis == 'vispart') {
                    // make it visible (may have previously been visnear)
                    $ent.removeClass('visnear visible').addClass('vispart');
                    alsoload = true;
                } else if (vis == 'visible') {
                    // make it visible (may have previously been visnear)
                    $ent.removeClass('vispart visnear').addClass('visible');
                    alsoload = true;
                }
                if (alsoload) {
                    // load thumbnails (for visible/vispart but not visnear) and recurse
                    this.loadThumb($ent, true);
                }
            }
        },

        /**
         * @param {int} first_np1 first visible is visnear_n+1
         * @param {int} last_0 last visible is visnear_0
         * @return {object} {last_1, last_n, first_1, first_n}
         */
        'calcVisnear': function (first_np1, last_0) {
            var cellcount = this.getTotalEntries();
            var reach = this.getBreadth() * this.exp.visnearBreadthMULTIPLIER;
            var range = {};
            // compute those near the last visible
            range.last_1 = last_0 + 1;
            range.last_n = last_0 + reach;
            range.first_n = first_np1 - 1;
            range.first_1 = first_np1 - reach;
            // catch out-of-bound values: last only against max
            if (range.last_1 >= cellcount) {
                // disable because no cells to loop over
                range.last_1 = last_0;
            }
            if (range.last_n >= cellcount) {
                // crop against max
                range.last_n = cellcount - 1;
            }
            // catch out-of-bound values: first only against min
            if (range.first_n <= 0) {
                // disable because no cells to loop over
                range.first_n = first_np1;
            }
            if (range.first_1 <= 0) {
                // crop against min
                range.first_1 = 0;
            }
            return range;
        },

        /**
         * flag blocks of images near (before & after) visibles
         * @param {object} vis range of visible images
         * @return {object} jQuery deferred
         */
        'setVisnearAll': function (vis) {
            // find visnear first and last visible
            var range = this.calcVisnear(vis.first, vis.last);
            // optional debugging
            if (this.debug && false) {
                console.log('images-(' + range.first_1 + ' to ' + range.first_n + '): making visnear (before visibles)');
            }
            if (this.debug && false) {
                console.log('images-(' + range.last_1 + ' to ' + range.last_n + '): making visnear (after visibles)');
            }
            // only do last visnear if there are some entries AFTER visibles
            if (range.last_1 != vis.last) {
                // request visnear (after visibles), async
                for (var i = range.last_1; i <= range.last_n; i++) {
                    this.setImageVisibilityClass(this.$cell(i), 'visnear');
                }
            }
            // only do first visnear if there are some entries BEFORE visibles
            if (range.first_n != vis.first) {
                // request visnear (before visibles), async
                for (var i = range.first_1; i <= range.first_n; i++) {
                    this.setImageVisibilityClass(this.$cell(i), 'visnear');
                }
            }
            // now load visnears
            return this.refreshVisnearImageSet();
        },

        // --------------------
        // FUNCTIONS: image ops
        // --------------------

        /**
         * Swap out image using a temporary image (to get triggered on load event)
         * Can't just switch src on $ent, because that image is already loaded
         * Firebug doesn't show the updated data- attributes, but they are updated
         * @return {object} jQuery deferred
         */
        'imageReres': function ($ent, path) {
            var that = this;
            var $reresable = $ent.cachedFind('.reresable');
            if (this.debug && false) {
                console.log('imageReres called for ' + $ent.data('seq'));
            }
            if ($reresable.length) {
                var deferred = this.getDeferred();
                // create temporary image container
                var img = $('<img id="dynamic" />');
                // attach listener to catch when the new image has loaded
                img.attr('src', path).one('load', function () {
                    // now that it's pre-cached by the temp, apply to original image
                    $reresable.attr('src', path);
                    // store loaded width and height (loaded attributes come in 'this')
                    $reresable.data('loaded-width', this.width);
                    $reresable.data('loaded-height', this.height);
                    $reresable.data('ratio', this.width / this.height);
                    $reresable.data('status', that.exp.imageStatusRERESED);
                    // notify promise of resolution
                    deferred.resolve();
                    // process async actions
                    if (that.debug && false) {
                        console.log('image-' + $ent.data('seq') + ': swapped out for (' + $reresable.data('loaded-width') + ',' + $reresable.data('loaded-height') + ')');
                    }
                    that.refreshMetric($ent);
                    // flag as reres'd, no longer reresing
                    $ent.removeClass('reresing');
                }).each(function () {
                    if (this.complete) $(this).load();
                });
                // return local context so that when we complete (resolve), our parents can execute
                return deferred;
            }
            $ent.removeClass('reresing');
            return this.getDeferred().resolve();
        },

        /**
         * advance forward or back by a certain number of images in the sequence
         * @param {int} increment positive to go to next, negative for previous
         * @param {object} eventContext optional event context for decorating an existing deferred
         * @return {object} jQuery deferred
         */
        'imageAdvanceBy': function (increment, eventContext) {
            var that = this;
            // start with the current image
            var seq = this.getSeq();
            var wrapUp = function () {
                if (eventContext) {
                    return that.eventQueue.resolve(eventContext);
                }
            }
            if (seq >= 0 && seq < this.getTotalEntries()) {
                // increment (+/-) to find next image
                if ((seq = this.getNextSeq(seq, increment)) !== false) {
                    return this.imageAdvanceTo(seq, eventContext).done(wrapUp);
                }
            } else {
                console.log('warning: erroneous seq(' + seq + ') returned by getseq');
            }
            return wrapUp();
        },

        /**
         * advance to a specific image in the sequence
         * @param {int} image sequence number
         * @param {object} [eventContext] optional event context for decorating an existing deferred
         */
        'imageAdvanceTo': function (seq, eventContext) {
            var offseq, breadth = this.getBreadth();
            // if we're in fullscreen mode
            if (breadth == 1) {
                // keep the selected image centred
                offseq = this.imageCentreOffseq(this.getDirection(), seq);
            } else {
                // only scroll if we need to
                offseq = this.imageStillShiftOffseq(seq);
            }
            // stop offseq being negative (because imageAdvanceTo should show all of the image)
            if (offseq < 0) offseq = 0;
            // update using hash change
            return this.fireHashUpdate({'seq': seq, 'offseq': offseq}, false, eventContext);
        },

        /**
         * @param [string] direction
         * @param [int] image sequence number
         * @return {int} viewport centre offset by half the width of a cell (for this view size)
         */
        'imageCentreOffseq': function (direction, seq) {
            // pad out direction and seq if not set
            if (direction == undefined) {
                direction = this.getDirection();
            }
            if (seq == undefined) {
                seq = this.getSeq();
            }
            // compute offseq value to centre the image
            var offseq;
            var layout = this.layoutManager.select(0);
            if (layout != null) {
                // use layout to compute centre
                offseq = layout.receiverImageCentre.call(layout.context, direction, seq);
            } else {
                // default layout uses 100% cells, so cell edge is 0 (left) to centre image
                offseq = 0;
            }
            return offseq;
        },

        /**
         * @param {int} seq sequence number of image that's being selected
         * @param {string} direction
         * @return {int} offseq value to keep image exactly where it is in the current viewport
         */
        'imageStillShiftOffseq': function (seq, direction) {
            if (direction == undefined) {
                direction = this.getDirection();
            }
            var gutter = this.getGutter();
            var viewport_base = (direction == 'x' ? this.getViewportXpos() : this.getViewportYpos());
            var image_pos = this.$cell(seq).offset();
            var image_base = (direction == 'x' ? image_pos.left : image_pos.top) - gutter;
            // find current offset of image within viewport, to 0DP
            var offseq = this.exp.api_round(image_base - viewport_base, 0);
            // work out max offseq can be to keep selected image in view
            var viewport_major = (direction == 'x' ? this.getViewportWidth() : this.getViewportHeight());
            var cell_major = (direction == 'x' ? this.$cell(seq).width() : this.$cell(seq).height());
            var max_offseq = viewport_major - cell_major - gutter;
            // work out min offseq can be to keep selected image at least partially in view
            var min_offseq = 0 - cell_major + (2 * gutter);
            // crop offseq against window bounds allowing for image bounds
            var cropped = Math.max(Math.min(offseq, max_offseq), min_offseq);
            return cropped;
        },

        // ------------------
        // FUNCTIONS: URL ops
        // ------------------

        /**
         * change up a directory
         */
        'urlChangeUp': function (url) {
            var lastChar = url.length;
            // if we use a hash, start backwards from there
            var lastHash = url.lastIndexOf('#');
            if (lastHash != -1) {
                lastChar = lastHash - 1;
            }
            // check for a '/index.html' string immediately prior to the hash
            var last_eleven = url.substring(lastChar - 11 + 1, lastChar + 1);
            if (last_eleven == '/index.html') {
                lastChar -= 11;
            }
            // check for a / immediately prior to the hash
            if (url[lastChar - 1] == '/') {
                lastChar--;
            }
            // search backwards from lastChar to find preceding slash
            var previousSlash = url.lastIndexOf('/', lastChar - 1);
            // search backwards from lastChar to find preceding ~2F
            var previousAliasedSlash = url.lastIndexOf('~2F', lastChar - 1);
            if (previousSlash < previousAliasedSlash) {
                // if an aliased slash nearer the end, use that instead
                previousSlash = previousAliasedSlash;
            }
            if (previousSlash != -1) {
                // new URL should include slash
                var new_url = url.substring(0, previousSlash) + '/';
                // catch recursive case where URL isn't changing
                if (url == new_url) {
                    return false;
                }
                // catch nested zip case
                var last_four = new_url.substring(previousSlash - 4, previousSlash);
                if (last_four == '.zip') {
                    // recurse up from zip
                    return this.urlChangeUp(new_url);
                }
                // append filtered hash
                var filteredHash = this.getFilteredHash();
                // redirect to new page
                this.urlGoto(new_url + this.exp.stringHASHBANG + filteredHash);
            }
            return false;
        },

        /**
         * redirect to another url
         * @param {string} newUrl new location
         */
        'urlGoto': function (newUrl) {
            window.location.href = newUrl;
        },

        /**
         * @return {string} URL of this directory with preserved hash state
         */
        'urlDirectoryWithState': function (newUrl) {
            var filteredHash = this.hashGetPreserved();
            return newUrl + this.exp.stringHASHBANG + filteredHash;
        },

        // ---------------
        // FUNCTIONS: hash
        // ---------------

        /**
         * @param {hash}    hash string to go to browser
         * @param {boolean} push true to push a history item
         */
        'hashSetTo': function (hash, push) {
            // fire event: change the window.location.hash, allow handler to resolve context
            if (push) {
                History.pushState({}, null, this.exp.stringHASHBANG + hash);
            } else {
                // -- doesn't always work, fails when hash is empty
                if (hash == '') {
                    hash = 'seq=0';
                }
                History.replaceState({}, 'Image', this.exp.stringHASHBANG + hash);
                // can also check with readback, but location.hash makes a mess of the history
                var assume_working = false;
                if (!assume_working) {
                    // have to read it back and check; History hashes come back without #
                    readback = History.getHash();
                    if ((this.exp.stringHASHBANG + hash) != ('#' + readback)) {
                        // -- leaves a messy history trail, but necessary when hash isn't being set to window
                        window.location.hash = this.exp.stringHASHBANG + hash;
                        console.log('History.replaceState(' + (this.exp.stringHASHBANG + hash) + ') failed=' + readback + ', forced location.hash=' + (this.exp.stringHASHBANG + hash));
                    }
                }
            }
        },

        /**
         * convert an object to a hash string
         * @param {object} values as an object
         * @return {string} hash as string (without a # prepend)
         */
        'hashGenerate': function (obj) {
            var hash = '';
            for (var key in obj) {
                // only set name:value pair if not default
                if (obj[key] == this.state_default[key]) {
                    // don't set the hash, because we'll fall back to the default anyway
                } else {
                    if (hash != '') {
                        hash += '&';
                    }
                    hash += key + '=' + obj[key];
                }
            }
            return hash;
        },

        /**
         * @param {string} h1 first hash
         * @param {string} h2 second hash
         * @return {boolean} true if the two hashes are equivalent
         */
        'hashEquals': function (h1, h2) {
            return (h1 == h2);
        },

        /**
         * parse out integers from hash attributes
         * @param {string} hash string
         * @return {object} hash values as an object
         */
        'hashParse': function (hash) {
            var output = {};
            // look for hash arguments
            if (hash.length > 1) {
                // strip leading hashbang if set
                var hblen = this.exp.stringHASHBANG.length;
                if (hash.substr(0, hblen) == this.exp.stringHASHBANG) {
                    hash = hash.substr(hblen);
                }
                // override defaults if set
                var hashpairs = hash.split('&');
                for (var i = 0; i < hashpairs.length; ++i) {
                    // var eqpos = hashpairs[i].indexOf('=');
                    var components = hashpairs[i].split('=');
                    var value;
                    switch (components[0]) {
                        case 'direction' :
                            // strictly limit to defined set
                            value = 'x';
                            if (components[1] == 'y') value = 'y';
                            break;
                        case 'theme' :
                            // strictly limit to defined set
                            value = 'theme-light'
                            if (components[1] == 'theme-dark') value = 'theme-dark';
                            break;
                        default:
                            // limit to integers
                            value = parseInt(components[1]);
                            break;
                    }
                    // adding elements to an object using array syntax (unknown name)
                    output[components[0]] = value;
                }
            }
            return output;
        },

        /**
         * check that the values in this object are valid
         * @param {object} hash name:value pairs
         * @return {boolean} true if they're ok
         */
        'hashValidate': function (hash) {
            var deleteCount = 0;
            for (var attrname in hash) {
                switch (attrname) {
                    case 'seq':
                        if (!((hash[attrname] >= 0) && (hash[attrname] < this.getTotalEntries()))) {
                            deleteCount++;
                            // remove entry from hash
                            delete hash[attrname];
                        }
                        break;
                }
            }
            // true if we haven't deleted/fixed anything
            return (deleteCount == 0);
        },

        /**
         * get a hash for the bits of current visual state (with overrides) that we preserve between pages (directories)
         * @param  {object} [options] optional options to overwrite current state
         * @return {string} hash as string
         */
        'hashGetPreserved': function (options) {
            var obj = this.hashParse(this.getHash());
            // unset unpreserved state (seq/offseq)
            if (typeof('obj.seq') != 'undefined') {
                delete obj.seq;
            }
            if (typeof('obj.offseq') != 'undefined') {
                delete obj.offseq;
            }
            if (options != undefined) {
                // overwrite with options
                this.merge(obj, options);
            }
            // convert to hash string
            hash = this.hashGenerate(obj);
            return hash;
        },

        // -------------------------
        // FUNCTIONS: event triggers
        // -------------------------

        /**
         * Make a change to the document's hash
         * @param {object}  options      name:value pairs to go in the hash
         * @param {boolean} push         true to push a history item
         * @param {object} [eventContext] optional event context for decorating an existing deferred
         * @return {object} jQuery deferred
         */
        'fireHashUpdate': function (options, push, eventContext) {
            var hash = '', fromHash, readback;
            // start with defaults
            var obj = this.getDefaults();
            // overwrite with current hash values
            fromHash = this.hashParse(this.getHash());
            this.merge(obj, fromHash);
            // overwrite with options
            this.merge(obj, options);
            // convert to hash string
            hash = this.hashGenerate(obj);
            // always create a context [so we can resolve something], but parent it only if eventContext is not undefined
            var localContext = this.eventQueue.pushOrParent({
                'key': 'hash:' + hash,
                'comment': 'localContext for fire_hashUpdate',
                'fired': true
            }, eventContext);
            // if hash would have no effect (would not trigger handlerHashChanged)
            if (this.hashEquals(this.getHash(), hash)) {
                return this.eventQueue.resolve(localContext);
            } else {
                this.hashSetTo(hash, push);
                // @todo test; instant firing doesn't seem to save much time
                if (false) {
                    // manually fire the handler instantly, even before the event trickles through
                    this.handlerHashChanged(this.exp.stringHASHBANG + hash);
                }
                // localContext is resolved by handlerHashChanged
                return localContext.deferred;
            }
        },

        /**
         * change the visible portion of the page by moving the scrollbars
         * @param {object} target position
         *        {int} scrollLeft distance from left of page in pixels
         *        {int} scrollTop  distance from top of page in pixels
         * @param {object} [eventContext] optional event context for decorating an existing deferred
         * @param {int} [animate] duration of scroll animation, or 0 to pop
         * @return {object} jQuery deferred
         */
        'fireScrollUpdate': function (target, eventContext, animate) {
            var that = this;
            if (animate == undefined) {
                animate = false;
            }
            var newkey = 'scroll:' + 'x=' + target.scrollLeft + '&y=' + target.scrollTop;
            // otherwise create a context, but parent it if eventContext is defined (and not identical)
            var localContext = this.eventQueue.pushOrParent({
                'key': newkey,
                'comment': 'localContext for fire_scrollUpdate',
                'fired': true
            }, eventContext);
            if (this.debug && false) {
                console.log('* fired scroll event ' + this.eventQueue.renderToString(localContext));
            }
            // fire event: change the scroll position
            this.fireScrollActual(target, animate);
            // if we've yet to setup an event handler
            if (this.bindToScroll_static == undefined) {
                // manually call handler
                this.handlerScrolled({}, target.scrollLeft, target.scrollTop);
            } else {
                // @todo test; instant firing doesn't seem to save much time
                if (false) {
                    // manually fire the handler instantly, even before the event trickles through
                    this.handlerScrolled({}, target.scrollLeft, target.scrollTop);
                }
            }
            // localContext is resolved by handlerScrolled
            return localContext.deferred;
        },

        /**
         * animate scroll to new position, or pop if fullscreen
         * @param  {object} target {...} multiple properties to animate
         * @param  {int} animate duration of animation, or zero to pop
         */
        'fireScrollActual': function (target, animate) {
            if (animate > 0) {
                // for some reason can't cache this selector
                $('html, body').finish().animate(target, animate);
            } else {
                // comes through as single event
                if (typeof(target.scrollLeft) != 'undefined') {
                    this.$document.scrollLeft(target.scrollLeft);
                }
                if (typeof(target.scrollTop) != 'undefined') {
                    this.$document.scrollTop(target.scrollTop);
                }
            }
        },

        /**
         * change the visible portion of the page by moving the scrollbars
         * @param {int} key to fire press event for
         * @param {object} [eventContext] optional event context for decorating an existing deferred
         * @return {object} jQuery deferred
         */
        'fireKeyPress': function (key, eventContext) {
            var e = jQuery.Event('keydown', {which: key});
            var localContext = this.eventQueue.pushOrParent({
                'key': 'keypress:key=' + key,
                'comment': 'localContext for fire_keyPress (keyToPress ' + key + ')',
                'fired': true
            });
            this.$document.trigger(e);
            return localContext.deferred;
        },

        /**
         * send analytics event
         * always called before we enact a keypress/click
         */
        'fireTrackEvent': function (event, category, label) {
            var that = this;
            if (this.exp.settings.ga_id != null) {
                // don't overwrite category if set
                if (category == undefined) {
                    // assemble category from view state
                    category = 'b=' + this.getBreadth() + '&d=' + this.getDirection();
                }
                // but always append image seq and software version
                var label_additions = 'seq=' + this.getSeq() + '&v=' + this.exp.settings.sfun_version;
                if (label == undefined) {
                    label = label_additions;
                } else {
                    label += '&' + label_additions;
                }
            }
            // buffer track event call slightly to avoid key-action or click-action latency
            setTimeout(function () {
                if (that.debug && false) {
                    console.log('send trackEvent(' + category + ', ' + event + ', ' + label + ')')
                }
                // send event to Google
            }, 1000);
        },

        // -------------------------
        // FUNCTIONS: event handlers
        // -------------------------

        /**
         * apply hash state (+current values for those unset) to page
         * downstream of: EVENT hash change
         * @param {string} hash that's been updated
         * @param [boolean] forceChange true to force the handler to reapply the hash state to the DOM [default: false]
         * @return {object} jQuery Deferred
         */
        'handlerHashChanged': function (hash, forceChange) {
            var that = this;
            // apply argument defaults
            if (forceChange == undefined) {
                forceChange = false;
            }
            // get context if we created the event, invent if it was user generated
            var eventContext = this.eventQueue.getOrInvent({
                'key': 'hash:' + hash,
                'comment': 'invented context for handlerHashChanged'
            });
            // start with defaults
            var obj = this.getDefaults();
            // overwrite with current hash values
            var fromHash = this.hashParse(hash);
            // check the hash values are valid, fallback to defaults if not
            if (!this.hashValidate(fromHash)) {
                console.log('illegal hash values, falling back to defaults');
            }
            this.merge(obj, fromHash);
            // optional debugging
            if (this.debug && false) {
                console.log('caught hashChanged event [' + hash + ']');
            }
            // stage 1: apply [hash] state to DOM
            // direction changes potentially affect all images
            var directionChanged = this.setDirection(obj.direction);
            // breadth changes potentially affect all images
            var breadthChanged = this.setBreadth(obj.breadth);
            // seq changes at most only affect the image being selected
            var seqChanged = this.setSeq(obj.seq);
            // seqoffset changes at most only affect the images being viewed
            var offseqChanged = this.setOffseq(obj.offseq);
            // theme changes should affect no images (no affect)
            var themeChanged = this.setTheme(obj.theme);
            // debug changed (no affect)
            this.setDebug(obj.debug);
            // imagesnap changed (no affect)
            this.imagesnap = obj.imagesnap;
            // updates based on certain types of change
            if (breadthChanged || directionChanged || forceChange) {
                // force the cells back to their native (CSS) sizes
                this.cellsClear();
                // refresh this.visTableMajor so we know there they actually are
                this.visTableMajor.updateAll(this.getDirection(), this.$sfun_selectablecell);
            }
            // find out if we should trigger other events based on this hash change
            return this.eventQueue.actOnContext(eventContext, function () {
                // update images based on what changed
                if (seqChanged || offseqChanged || breadthChanged || directionChanged || forceChange) {
                    // scroll to the selected image, which triggers refresh on all .visible images
                    return that.envisionSeq(obj.seq, obj.offseq, eventContext).done(function () {
                        // @todo this doesn't cover it, do it on this.refreshAnImageSet() instead
                        //if (breadthChanged || directionChanged || forceChange) {
                        //  this.cellsResize();
                        //}
                    });
                }
            }, this);
        },

        /**
         * process or buffer events generated by window scrolling
         * @return {object} jQuery deferred
         * downstream of: EVENT scroll
         */
        'handlerScrolled': function (event, sx, sy) {
            var that = this;
            var keyargs = 'x=' + sx + '&y=' + sy;
            var key = 'scroll:' + keyargs;
            var eventContext = this.eventQueue.get(key);
            if (this.debug && false) {
                console.log('handlerScrolled key[' + key + ']');
            }
            // if this is a fresh event that we didn't fire
            if (eventContext == null) {
                // don't process scroll event every time, buffer unless there's a context
                this.buffer('handlerScrolled_event',
                    // success function to execute if/when we are processing this event
                    function () {
                        // get context if we created the event, invent if it was user generated
                        eventContext = that.eventQueue.getOrInvent({
                            'key': key,
                            // [browser-generated] scroll events can be dumped (superceded)
                            // but if they come from fireScrollUpdate (with their own context)
                            // that context may not be dumpable
                            'dumpable': true,
                            'comment': 'invented context for handlerScrolled'
                        });
                        // process this event if we're meant to
                        return that.eventQueue.actOnContext(eventContext, function () {
                            // store context in event in case we need it when processing
                            event.eventContext = eventContext;
                            return that.handlerScrolled_eventProcess(event, sx, sy);
                        }, that);
                    },
                    // drop function to execute if we're dumping this event
                    function () {
                        // nothing to do
                        if (that.debug && false) {
                            console.log('dumped buffered scroll event, no context, key[' + key + ']');
                        }
                    }, this.exp.implicitScrollBUFFER);
            } else {
                // still buffer to ensure we drop the previous event and delay slightly for animation
                this.buffer('handlerScrolled_event',
                    // success function to delay the processing just slightly (helps animation)
                    function () {
                        // process this event if we're meant to as we originated it
                        return that.eventQueue.actOnContext(eventContext, function () {
                            // store context in event in case we need it when processing
                            event.eventContext = eventContext;
                            return that.handlerScrolled_eventProcess(event, sx, sy);
                        }, that);
                    },
                    // no drop function, as normal
                    function () {
                        // resolve dumped context, because other things may be dependent on it
                        that.eventQueue.resolve(eventContext);
                        // nothing to do
                        if (that.debug && false) {
                            console.log('resolved and dumped buffered scroll event, with context, key[' + key + ']');
                        }
                    },
                    this.exp.implicitScrollBUFFER);
            }
        },

        /**
         * actually process the events
         * @return {object} jQuery deferred
         * downstream of: EVENT scroll
         */
        'handlerScrolled_eventProcess': function (event, sx, sy) {
            if (event.eventContext !== undefined) {
                // can use 'dumpable' for now as a good proxy for 'invented' (not fired)
                if (!event.eventContext.fired) {
                    // only track scroll events that we didn't fire
                    var keyargs = 'x=' + sx + '&y=' + sy;
                    this.fireTrackEvent('scroll', undefined, keyargs);
                    // console.log(event.eventContext);
                }
            }
            // invert deltas to match scroll wheel
            if (this.scroll_lastX_static == undefined) {
                event.deltaX = 0 - sx;
                event.deltaY = 0 - sy;
            } else {
                event.deltaX = 0 - (sx - this.scroll_lastX_static);
                event.deltaY = 0 - (sy - this.scroll_lastY_static);
            }
            event.deltaFactor = 1;
            // remember scroll coords for next time
            this.scroll_lastX_static = sx;
            this.scroll_lastY_static = sy;
            if (this.debug && false) {
                console.log('scroll dx[' + event.deltaX + '] dy[' + event.deltaY + '] factor[' + event.deltaFactor + ']');
            }
            // see if scroll has made any new images visible
            var scrolldir = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? 0 - event.deltaX : 0 - event.deltaY);
            return this.refreshVisibility(scrolldir);
        },

        /**
         * process events generated by key presses
         * downstream of: EVENT key pressed
         * @return {object} jQuery deferred
         */
        'handlerKeyPressed': function (event) {
            var that = this;
            // ignore certain key presses
            switch (event.which) {
                case this.exp.KEY_CTRL :
                case this.exp.KEY_ALT :
                    return this.getDeferred().resolve();
            }
            // create an event context for this handler, or use stored one
            var eventContext = this.eventQueue.getOrInvent({
                'key': 'keypress:' + 'key=' + event.which,
                'comment': 'invented context for handlerKeyPressed'
            });
            // optional debugging information
            if (this.debug && false) {
                console.log('keydown event code[' + event.which + ']');
            }
            return this.eventQueue.actOnContext(eventContext, function () {
                var defs = [];
                // setup event to allow delegates to prevent
                event.sfun_active = true;
                // delegate keypress to tool receivers
                that.toolManager.iterate(function (obj) {
                    var tool = obj;
                    // only process event if it hasn't been deactivated
                    if (event.sfun_active) {
                        defs[defs.length] = tool.receiverKeyPressed.call(tool.context, event, eventContext);
                    }
                });
                if (event.sfun_active) {
                    // process keypress with local receiver (if still active)
                    defs[defs.length] = that.receiverKeyPressed(event, eventContext);
                }
                // aggregate deferreds then resolve context
                $.when.apply($, defs).always(that.eventQueue.resolve(eventContext));
            }, this);
        },

        /**
         * process events generated by key presses
         * downstream of: EVENT key pressed, HANDLER key pressed
         * @return {object} jQuery deferred
         */
        'receiverKeyPressed': function (event, eventContext) {
            // process key press
            switch (event.which) {

                // directory navigation
                case this.exp.KEY_ARROW_UP:
                    if (event.altKey) {
                        event.preventDefault();
                        this.urlChangeUp(window.location.href);
                    } else {
                        event.preventDefault();
                        this.fireTrackEvent('key_arrow_up');
                        // advance to previous image
                        eventContext.animateable = this.exp.implicitScrollDURATION;
                        // or if direction is same as arrow, jump back by breadth
                        return this.imageAdvanceBy(this.getDirection() == 'y' ? -this.getBreadth() : -1, eventContext);
                    }
                    break;

                // single image changes
                case this.exp.KEY_ARROW_LEFT:
                    if (!event.altKey) {
                        event.preventDefault();
                        this.fireTrackEvent('key_arrow_left');
                        // advance to previous image
                        eventContext.animateable = this.exp.implicitScrollDURATION;
                        // or if direction is same as arrow, jump back by breadth
                        return this.imageAdvanceBy(this.getDirection() == 'x' ? -this.getBreadth() : -1, eventContext);
                    }
                    break;
                case this.exp.KEY_ARROW_RIGHT:
                    if (!event.altKey) {
                        event.preventDefault();
                        this.fireTrackEvent('key_arrow_right');
                        // advance to previous image
                        eventContext.animateable = this.exp.implicitScrollDURATION;
                        // or if direction is same as arrow, jump forward by breadth
                        return this.imageAdvanceBy(this.getDirection() == 'x' ? this.getBreadth() : 1, eventContext);
                    }
                case this.exp.KEY_ARROW_DOWN:
                    event.preventDefault();
                    this.fireTrackEvent('key_arrow_down');
                    // advance to next image
                    eventContext.animateable = this.exp.implicitScrollDURATION;
                    // or if direction is same as arrow, jump forward by breadth
                    return this.imageAdvanceBy(this.getDirection() == 'y' ? this.getBreadth() : 1, eventContext);
                case this.exp.KEY_TAB:
                    event.preventDefault();
                    this.fireTrackEvent('key_tab');
                    // advance to next image
                    eventContext.animateable = this.exp.implicitScrollDURATION;
                    return this.imageAdvanceBy(1, eventContext);

                // page-wise navigation
                case this.exp.KEY_PAGE_UP:
                case this.exp.KEY_PAGE_DOWN:
                    if (!event.ctrlKey) {
                        event.preventDefault();
                        // get cell count and round down
                        var cellcount = this.getCellMajorCount(-1);
                        var cellmajor = this.getCellMajor();
                        // always animate
                        eventContext.animateable = this.exp.implicitScrollDURATION;
                        // apply position change as relative offset
                        var pagedir = (event.which == this.exp.KEY_PAGE_DOWN ? +1 : -1);
                        // send track event
                        this.fireTrackEvent(event.which == this.exp.KEY_PAGE_DOWN ? 'key_page_down' : 'key_page_up');
                        // this.envisionPos() using relative offset
                        if (this.getDirection() == 'x') {
                            return this.envisionPos({'scrollLeft': pagedir * cellcount * cellmajor}, eventContext, true);
                        } else {
                            return this.envisionPos({'scrollTop': pagedir * cellcount * cellmajor}, eventContext, true);
                        }
                    }
                    break;

                case this.exp.KEY_HOME:
                    event.preventDefault();
                    this.fireTrackEvent('key_home');
                    if (this.isZoomMode()) {
                        return this.exp.api_zoomPanCornerTo(this.exp.cornerTOPLEFT, 0, 0, eventContext);
                    } else {
                        return this.imageAdvanceTo(0, eventContext);
                    }
                    break;
                case this.exp.KEY_END:
                    event.preventDefault();
                    this.fireTrackEvent('key_end');
                    if (this.isZoomMode()) {
                        return this.exp.api_zoomPanCornerTo(this.exp.cornerBOTTOMRIGHT, this.getCanvasWidth(), this.getCanvasHeight(), eventContext);
                    } else {
                        return this.imageAdvanceTo(this.getTotalEntries() - 1, eventContext);
                    }
                    break;

                // change breadth
                case this.exp.KEY_NUMBER_1:
                    event.preventDefault();
                    this.fireTrackEvent('key_1');
                    return this.fireHashUpdate({'breadth': 1}, false, eventContext);
                case this.exp.KEY_NUMBER_2:
                    event.preventDefault();
                    this.fireTrackEvent('key_2');
                    return this.fireHashUpdate({'breadth': 2}, false, eventContext);
                case this.exp.KEY_NUMBER_4:
                    event.preventDefault();
                    this.fireTrackEvent('key_4');
                    return this.fireHashUpdate({'breadth': 4}, false, eventContext);
                case this.exp.KEY_NUMBER_8:
                    event.preventDefault();
                    this.fireTrackEvent('key_8');
                    return this.fireHashUpdate({'breadth': 8}, false, eventContext);

                // plus and minus effectively zoom in and out using breadth
                case this.exp.KEY_PLUS:
                case this.exp.KEY_EQUALS:
                    event.preventDefault();
                    this.fireTrackEvent('key_plus');
                    return this.fireHashUpdate({'breadth': this.getBreadthNext(this.getBreadth(), -1)}, false, eventContext);
                case this.exp.KEY_MINUS:
                case this.exp.KEY_UNDERSCORE:
                    event.preventDefault();
                    this.fireTrackEvent('key_minus');
                    return this.fireHashUpdate({'breadth': this.getBreadthNext(this.getBreadth(), +1)}, false, eventContext);

                // change between horizontal and vertical
                case this.exp.KEY_H_UPPER:
                case this.exp.KEY_H_LOWER:
                    event.preventDefault();
                    this.fireTrackEvent('key_h');
                    var offseq = this.imageCentreOffseq('x');
                    return this.fireHashUpdate({'direction': 'x', 'offseq': offseq}, false, eventContext);
                case this.exp.KEY_V_UPPER:
                case this.exp.KEY_V_LOWER:
                    event.preventDefault();
                    this.fireTrackEvent('key_v');
                    var offseq = this.imageCentreOffseq('y');
                    return this.fireHashUpdate({'direction': 'y', 'offseq': offseq}, false, eventContext);
            }
            return this.getDeferred().resolve();
        },

        /**
         * process events generated by mouse wheel scrolling
         * mouseWheeled is a dumb event; we never fire it, so it doesn't have a context
         * downstream of: EVENT mouse wheeled
         */
        'handlerMouseWheeled': function (event) {
            var that = this;
            // work out what direction we're applying this mouse-wheel scroll to
            var breadth = this.getBreadth();
            var direction = this.getDirection();
            // scroll direction goes against change in Y (for both x and y directions)
            var scrolldir = 0 - event.deltaY;
            // get current scroll position
            var rounding = this.getGutter() + 1;
            var current_pos = (direction == 'x' ? this.getViewportXpos() : this.getViewportYpos());
            // minimum width of an image is required to correct rounding errors
            var min_offset = 1.0;
            // active mousewheel reaction is dependent on which direction we're flowing in
            var target = {};
            var animation_length = this.exp.implicitScrollDURATION;
            // only imagesnap and animate for breadth=1
            var applied_imagesnap = this.imagesnap;
            if (breadth > 1) {
                applied_imagesnap = this.exp.imageSnapOff;
                animation_length = 0;
            }
            switch (applied_imagesnap) {
                case this.exp.imageSnapBySeq : // on, scroll selector
                    var next_seq = handlerMouseWheeled_this.getNextSeq(breadth, direction, scrolldir);
                    event.preventDefault();
                    //// create localContext because jump can be animated
                    //var localContext = eventQueue.push({
                    //  'key': 'wheelTo:'+'seq='+next_seq,
                    //  'comment': 'localContext for handlerMouseWheeled'
                    //});
                    //localContext.animateable = this.exp.implicitScrollDURATION;
                    this.imageAdvanceTo(next_seq);
                    break;

                case this.exp.imageSnapByScroll : // on, scroll by image alignment
                    var next_pos = this.handlerMouseWheeled_getNextPos(breadth, direction, scrolldir, current_pos + min_offset);
                    // put into target object
                    target[(direction == 'x' ? 'scrollLeft' : 'scrollTop')] = next_pos;
                    // target = this.cropScrollPositionAgainstViewport(target);
                    break;

                case this.exp.imageSnapOff : // off, no image snapping just scroll
                    if (direction == 'x') {
                        // use both axes to scroll along X
                        var velocity = 100;
                        var next_pos = current_pos + ((0 - event.deltaY) + event.deltaX) * velocity;
                        target = {'scrollLeft': next_pos};
                    } else {
                        target = null;
                    }
                    break;
            }
            // only scroll if we've got a target
            if (target !== null) {
                // then crop against viewport
                this.fireScrollActual(target, animation_length);
                event.preventDefault();
            }
            // optional debugging
            if (this.debug && false) {
                console.log('wheel dx[' + event.deltaX + '] dy[' + event.deltaY + '] factor[' + event.deltaFactor + ']');
            }
        },

        /**
         * works out where the scroll wheel should scroll to
         * @param {int} breadth
         * @param {string} direction
         * @param {int} scrolldir > 0 for right/down, < 0 for left/up
         * @param {int} current_pos
         * @returns {int} next viewport (scroll) position
         */
        'handlerMouseWheeled_getNextPos': function (breadth, direction, scrolldir, current_pos) {
            // calculate how many minor axis cells
            var advance_by = (scrolldir > 0 ? 1 : -1) * breadth;
            var vpm = (direction == 'x' ? this.getViewportWidth() : this.getViewportHeight());
            var snap_line = 0;
            if (breadth == 1) {
                // snap to middle/middle (horizontal or vertical scrolling)
                snap_line = vpm / 2;
            } else {
                // snap to the left/top
                snap_line = 0;
            }
            // cell at snap line, i.e. find first spanning min boundary
            var current_seq = this.visTableMajor.findCompare(current_pos + snap_line, this.exp.compareLTE, false);
            // compute next_seq but don't allow wrap around
            var next_seq = Math.min(current_seq + advance_by, this.visTableMajor.getSize() - 1);
            // next_pos is next major
            var next_pos = 0;
            if (breadth == 1) {
                // offset by offseq to centre that image
                next_pos = this.visTableMajor.key(next_seq) - this.imageCentreOffseq(direction, next_seq);
                // insert hack to make sure we don't miss second image seq#1
                if (next_seq == 2) {
                    // see where the position would be for image 1
                    var possible_pos = this.visTableMajor.key(1) - this.imageCentreOffseq(direction, 1);
                    // if that position is forward from where we are now
                    if (possible_pos > current_pos) {
                        // jump to possible_pos instead of next_pos
                        return possible_pos;
                    }
                }
            } else {
                next_pos = this.visTableMajor.key(next_seq);
            }
            return next_pos;
        },

        /**
         * works out where the scroll wheel should scroll to
         * @param {int} breadth
         * @param {string} direction
         * @param {int} scrolldir > 0 for right/down, < 0 for left/up
         * @param {int} current_pos
         * @returns {int} next image sequence number
         */
        'handlerMouseWheeled_getNextSeq': function (breadth, direction, scrolldir, current_pos) {
            var advance_by = (scrolldir > 0 ? 1 : -1) * breadth;
            // get seq of currently selected image
            var current_seq = this.getSeq();
            // compute next_seq but don't allow wrap around
            var next_seq = Math.min(current_seq + advance_by, this.visTableMajor.getSize() - 1);
            return Math.max(next_seq, 0);
        },

        /**
         * process a click on an image
         * @param {object} event raw DOM event
         * @param {object} $ent jQuery object
         * @param {string} selector (type.class) for the click target
         */
        'handlerImageClicked': function (event, $ent, selector) {
            if (this.debug && false) {
                console.log('bindToImageLinks click event on selector[' + selector + ']');
            }
            this.fireTrackEvent('image_clicked', undefined, 'click=' + $ent.data('seq') + '&selector=' + selector);
            // setup event to allow delegates to deactivate
            event.sfun_active = true;
            // delegate image click to tool receivers
            this.toolManager.iterate(function (obj) {
                var tool = obj;
                if (event.sfun_active) {
                    tool.receiverImageClicked.call(tool.context, event, $ent, selector);
                }
            });
            if (event.sfun_active) {
                // process image click with local receiver
                this.receiverImageClicked(event, $ent, selector);
            }
        },

        /**
         * process a click on an image
         * downstream of: EVENT image click, HANDLER image click
         * @param {object} event raw DOM event
         * @param {object} $ent jQuery object
         * @param {string} selector (type.class) for the click target
         */
        'receiverImageClicked': function (event, $ent, selector) {
            var seq = $ent.data('seq');
            switch (selector) {
                default:
                    break;
            }
        },

        // ------------------
        // FUNCTIONS: helpers
        // ------------------

        /**
         * store current values as previous state, for reversion later
         */
        'storeStateAsPrevious': function() {
            var cdirection = this.getDirection(), cbreadth = this.getBreadth(), cseq = this.getSeq(), coffseq = this.getOffseq(), ctheme = this.getTheme(), cdebug = this.debug, cimagesnap = this.imagesnap;
            this.state_previous['direction'] = cdirection;
            this.state_previous['breadth'] = cbreadth;
            this.state_previous['seq'] = cseq;
            this.state_previous['offseq'] = coffseq;
            this.state_previous['theme'] = ctheme;
            this.state_previous['debug'] = cdebug;
            this.state_previous['imagesnap'] = cimagesnap;
        },

        /**
         * substitute values into a mustache template
         * @param {string} template in mustache format
         * @param {object} view collection of values to substitute
         * @return {string} output after substitution
         */
        'substitute': function (template, view) {
            var output = Mustache.render(template, view);
            return output;
        },

        /**
         * merge into obj1
         * overwrites obj1's values with obj2's and adds obj2's if non existent in obj1
         * @param obj1
         * @param obj2
         * @return {object} obj1, now containing merged fields from obj2
         */
        'merge': function (obj1, obj2) {
            for (var attrname in obj2) {
                obj1[attrname] = obj2[attrname];
            }
            return obj1;
        },

        /**
         * buffer a frequently firing event
         * @param {string} name of buffer
         * @param {function} successCallback to call if we're executing this event
         * @param {function} dropCallback to call if we're dropping this event
         * @param {int} timeout in milliseconds, needs to be about 200ms for normal dragging
         * @param {int} mode 0 (default) = bufferExecFIRST, 1 = bufferExecLAST
         */
        'buffer': function (name, successCallback, dropCallback, timeout, mode) {
            // defaults
            if (mode == undefined) {
                mode = this.exp.bufferExecLAST;
            }
            // option to disable buffer
            var disabled = false;
            if (disabled) {
                return successCallback();
            }
            // assume that we're going to schedule the current event, not execute it now
            var schedule = true;
            // if we've already scheduled something
            if (typeof(this[name]) != 'undefined' && this[name]) {
                switch (mode) {
                    case this.exp.bufferExecFIRST:
                        // delay the scheduled event (first event will eventually get executed)
                        clearTimeout(this[name]);
                        this[name] = setTimeout(this[name + '__function'], timeout);
                        // drop, don't schedule the current event
                        schedule = false;
                        dropCallback();
                        break;
                    case this.exp.bufferExecLAST:
                        // drop the previous event
                        this[name + '__function'](false);
                        // schedule the current
                        schedule = true;
                        break;
                }
            }
            // if we've got a fresh queue
            else {
                // schedule the current event
                schedule = true;
            }
            if (schedule) {
                // save callback function in case it needs delaying
                this[name + '__function'] = function (exec) {
                    // by default, we execute the success callback
                    if (exec == undefined) {
                        // because the default occurs when we hit the timeout
                        exec = true;
                    }
                    if (exec) {
                        successCallback();
                    } else {
                        dropCallback();
                    }
                    // clear timeout var (<name>) and callback function (<name>__function)
                    clearTimeout(this[name]);
                    this[name] = null;
                    this[name + '__function'] = null;
                },
                    // schedule event
                    this[name] = setTimeout(this[name + '__function'], timeout);
            }
        },

        /**
         * @param {jQuery} $entity the cell
         * @param {bool} True to include partially visible cells
         * @return {bool} True if this image is currently visible in the viewport
         */
        'isVisible': function ($ent, partial) {
            if ($ent.hasClass('visible')) return true;
            if (partial && $ent.hasClass('vispart')) return true;
            return false;
        },

        /**
         * @param string
         *          to search within
         * @param string
         *          to search for
         * @return true if the haystack ends with the needle
         */
        'endswith': function (haystack, needle) {
            // roll on ECMAScript 6
            return haystack.indexOf(needle, haystack.length - needle.length) !== -1;
        },

        /**
         * strip any of the characters used in the stringHASHBANG from the start of the hash
         * @param {string} hash to strip
         * @return {string} stripped output
         */
        'stripBang': function (hash) {
            var output;
            // re = new RegExp('/^['+this.exp.stringHASHBANG+']*/','g');
            var re = new RegExp('^[' + this.exp.stringHASHBANG + ']', 'g');
            output = hash.replace(re, '');
            return output;
        },

        /**
         * @return {string} browser's hash without whatever stringHASHBANG we're using
         */
        'getHash': function () {
            return this.stripBang(History.getHash());
        },

        /**
         * @return {string} browser's hash minus a few attributes
         */
        'getFilteredHash': function () {
            return this.getHash();
        },

        /**
         * create a CSS class dynamically
         * http://stackoverflow.com/questions/1720320/how-to-dynamically-create-css-class-in-javascript-and-apply
         * @param  {string} selector e.g. '.classname'
         * @param  {string} style
         */
        'createCSSSelector': function (selector, style) {
            if (!document.styleSheets) {
                return null;
            }

            if (document.getElementsByTagName("head").length == 0) {
                return null;
            }

            var stylesheet;
            var mediaType;
            if (document.styleSheets.length > 0) {
                for (var i = 0; i < document.styleSheets.length; i++) {
                    if (document.styleSheets[i].disabled) {
                        continue;
                    }
                    var media = document.styleSheets[i].media;
                    mediaType = typeof media;

                    if (mediaType == "string") {
                        if (media == "" || (media.indexOf("screen") != -1)) {
                            styleSheet = document.styleSheets[i];
                        }
                    } else if (mediaType == "object") {
                        if (media.mediaText == "" || (media.mediaText.indexOf("screen") != -1)) {
                            styleSheet = document.styleSheets[i];
                        }
                    }

                    if (typeof styleSheet != "undefined") {
                        break;
                    }
                }
            }

            if (typeof styleSheet == "undefined") {
                var styleSheetElement = document.createElement("style");
                styleSheetElement.type = "text/css";
                document.getElementsByTagName("head")[0].appendChild(styleSheetElement);
                for (var i = 0; i < document.styleSheets.length; i++) {
                    if (document.styleSheets[i].disabled) {
                        continue;
                    }
                    styleSheet = document.styleSheets[i];
                }
                var media = styleSheet.media;
                mediaType = typeof media;
            }

            if (mediaType == "string") {
                for (var i = 0; i < styleSheet.rules.length; i++) {
                    if (styleSheet.rules[i].selectorText && styleSheet.rules[i].selectorText.toLowerCase() == selector.toLowerCase()) {
                        styleSheet.rules[i].style.cssText = style;
                        return;
                    }
                }
                styleSheet.addRule(selector, style);
            } else if (mediaType == "object") {
                for (var i = 0; i < styleSheet.cssRules.length; i++) {
                    if (styleSheet.cssRules[i].selectorText && styleSheet.cssRules[i].selectorText.toLowerCase() == selector.toLowerCase()) {
                        styleSheet.cssRules[i].style.cssText = style;
                        return;
                    }
                }
                styleSheet.insertRule(selector + "{" + style + "}", styleSheet.cssRules.length);
            }
        },

        // -----------------
        // FUNCTIONS: External API
        // -----------------

        'exp': {
            // queue function calls until document ready
            'q': [],

            /**
             * execute a function
             * @param {string} name function name
             * @param {[type]} obj  function arguments
             */
            'push': function (name, obj) {
                if (this.q == null) {
                    // execute function immediately
                } else {
                    // push function and call later
                    this.q.push({'name': name, 'obj': obj});
                }
            },

            /**
             * execute contents of queue
             */
            'flush': function () {
                for (var i = 0; i < this.q.length; ++i) {
                    // call queued function
                    this['api_' + this.q[i].name](this.q[i].obj);
                }
                // disable queue
                this.q = null;
            },

            // ---------
            // CONSTANTS
            // ---------

            'KEY_ARROW_LEFT': 37,
            'KEY_ARROW_RIGHT': 39,
            'KEY_ARROW_UP': 38,
            'KEY_ARROW_DOWN': 40,
            'KEY_TAB': 9,
            'KEY_HOME': 36,
            'KEY_END': 35,
            'KEY_PAGE_UP': 33,
            'KEY_PAGE_DOWN': 34,
            'KEY_SHIFT': 16,
            'KEY_CTRL': 17,
            'KEY_ALT': 18,
            'KEY_RETURN': 13,
            'KEY_SPACE': 32,
            'KEY_NUMBER_1': 49,
            'KEY_NUMBER_2': 50,
            'KEY_NUMBER_4': 52,
            'KEY_NUMBER_8': 56,
            'KEY_H_UPPER': 72,
            'KEY_H_LOWER': 104,
            'KEY_V_UPPER': 86,
            'KEY_V_LOWER': 118,
            'KEY_PLUS': 187,      // chrome
            'KEY_EQUALS': 61,     // firefox
            'KEY_MINUS': 189,     // chrome
            'KEY_UNDERSCORE': 173,// firefox

            stringHASHBANG: '#!',
            visnearBreadthMULTIPLIER: 4,
            implicitScrollDURATION: 100,
            implicitScrollBUFFER: 50,
            explicitScrollBUFFER: 50,
            loopIterLIMIT: 100,
            compareGTE: 1,
            compareLTE: -1,
            bufferExecFIRST: 0,
            bufferExecLAST: 1,
            imageStatusERROR: -2,
            imageStatusMISSING: -1,
            imageStatusPENDING: 0,
            imageStatusLOADED: 1,
            imageStatusRERESED: 2,
            imageSnapOff: 0,
            imageSnapByScroll: 1,
            imageSnapBySeq: 2,
            cornerTOPLEFT: 0,
            cornerBOTTOMRIGHT: 1,
            // time after which scroll events expire
            TIMEOUT_expireEVENT: 10000,
            // settings (default settings)
            settings: {
                'ga_id': null,
                'sfun_version': '0.0.1',
            },

            /**
             * first call once all libraries have been built
             */
            'api_initialise': function () {
                coreObject.init();
            },

            /**
             * extend the core functions
             * @param obj 1..N collection of functions (object) to extend with
             */
            'api_coreExtend': function () {
                for (var i = 0; i < arguments.length; i++) {
                    var attributes = arguments[i];
                    for (var key in attributes) {
                        coreObject[key] = attributes[key];
                    }
                }
            },

            /**
             * extend the core API functions
             * @param obj 1..N collection of functions (object) to extend with
             */
            'api_apiExtend': function (target) {
                for (var i = 0; i < arguments.length; i++) {
                    var attributes = arguments[i];
                    for (var key in attributes) {
                        this[key] = attributes[key];
                    }
                }
            },

            /**
             * add a button to the header
             * @param {object} obj arguments
             */
            'api_headerAddButton': function (obj) {
                var output = coreObject.substitute(obj.template, obj.view);
                // attach output to header
                $('.header').append(output);
                // allow element to bind its handlers
                obj.receiverRegistered.call(obj.context, obj);
            },

            /**
             * register a layout engine
             * @param {object} obj arguments
             */
            'api_registerLayout': function (obj) {
                coreObject.layoutManager.push(obj);
                // allow element to bind its handlers
                obj.receiverRegistered.call(obj.context);
            },

            /**
             * register a tool
             * @param {object} obj arguments
             */
            'api_registerTool': function (obj) {
                coreObject.toolManager.push(obj);
                // allow element to bind its handlers
                obj.receiverRegistered.call(obj.context);
            },

            /**
             * jQuery selector caching
             * @param {string} seq
             * @return {object} cached jQuery object
             */
            'api_$cell': function (seq) {
                return coreObject.$cell(seq);
            },

            /**
             * @return {object} jQuery object for cell
             */
            'api_getCell': function (seq) {
                return coreObject.$cell(seq);
            },

            /**
             * jQuery selector caching
             * @return {object} cached jQuery object for sfun container entity
             */
            'api_get$sfun': function () {
                return coreObject.$sfun;
            },

            /**
             * ingest default values
             * @param {obj} list list of defaults
             */
            'api_setDefaults': function (list) {
                for (var key in list) {
                    coreObject.state_default[key] = list[key];
                }
            },

            /**
             * ingest settings
             * @param {obj} list list of settings
             */
            'api_setSettings': function (list) {
                for (var key in list) {
                    // if we've defined the setting, allow it to be set
                    if (this.settings[key] !== undefined) {
                        this.settings[key] = list[key];
                        // debug variable unpopulated at this stage, so just true|false
                        if (false) {
                            console.log('set setting ' + key + '=' + list[key]);
                        }
                    } else {
                        if (false) {
                            console.log('not setting ' + key + '=' + list[key]);
                        }
                    }
                }
            },

            /**
             * @param {string} regkey key as regular expression
             * @param {boolean} wait for context if it doesn't exist
             * @return {object} eventContext.deferred if found, a resolved deferred if not
             */
            'api_bindToContext': function (regkey, wait) {
                // find last matching key
                var ref = coreObject.eventQueue.findRegex(regkey, true);
                if (ref == -1) {
                    return coreObject.getDeferred().resolve();
                }
                var context = coreObject.eventQueue.select(ref);
                if (context == null) {
                    if (wait) {
                        // create an eventContext ahead of the event we're waiting for
                        var context = coreObject.eventQueue.push({
                            'key': regkey,
                            'comment': 'localContext for api_bindToContext key[' + regkey + ']'
                        });
                    } else {
                        // if not waiting, just return a resolved deferred
                        return coreObject.getDeferred().resolve();
                    }
                }
                return context.deferred;
            },

            /**
             * buffer a frequently firing event
             * @param {string} name of buffer
             * @param {function} successCallback to call if we're executing this event
             * @param {function} dropCallback to call if we're dropping this event
             * @param {int} timeout in milliseconds, needs to be about 200ms for normal dragging
             * @param {int} mode 0 (default) = bufferExecFIRST, 1 = bufferExecLAST
             */
            'api_buffer': function () {
                return coreObject.buffer.apply(coreObject, arguments);
            },

            /**
             * @return {int} Width of alley in pixels
             */
            'api_getAlley': function () {
                return coreObject.getAlley();
            },

            /**
             * @return {int} Width of gutter in pixels
             */
            'api_getGutter': function () {
                return coreObject.getGutter();
            },

            /**
             * @return {boolean} true if in debugging mode
             */
            'api_getDebug': function () {
                return coreObject.debug;
            },

            /**
             * @return {object} promise (alias for commonality)
             */
            'api_getDeferred': function () {
                return coreObject.getDeferred();
            },

            /**
             * @return {string} direction of current view
             */
            'api_getDirection': function () {
                return coreObject.getDirection();
            },

            /**
             * @return {int} breadth of current view
             */
            'api_getBreadth': function () {
                return coreObject.getBreadth();
            },

            /**
             * @return {int} currently selected entity
             */
            'api_getSeq': function () {
                return coreObject.getSeq();
            },

            /**
             * @param {object} $ent jQuery entity
             * @return {string} type of entity
             */
            'api_getType': function ($ent) {
                return coreObject.getType($ent);
            },

            /**
             * @return {int} return viewport width/height
             */
            'api_getViewportWidth': function () {
                return coreObject.getViewportWidth();
            },
            'api_getViewportHeight': function () {
                return coreObject.getViewportHeight();
            },

            /**
             * @return {object} jQuery object for sfun layout root
             */
            'api_getLayoutRoot': function () {
                return coreObject.$sfun_flow;
            },

            /**
             * @return {int} total number of entries
             */
            'api_getTotalEntries': function () {
                return coreObject.getTotalEntries();
            },

            /**
             * @param {int} round non-zero to round to the nearest whole cell
             *   negative to round down, positive to round up
             * @return {float} number of cells on the major axis
             */
            'api_getCellMajorCount': function (round) {
                return coreObject.getCellMajorCount(round);
            },

            /**
             * @return {object} visibility table for major axis
             */
            'api_getVisTableMajor': function () {
                return coreObject.visTableMajor;
            },

            /**
             * @return {object} event queue
             */
            'api_getEventQueue': function () {
                return coreObject.eventQueue;
            },

            /**
             * @return {int} last thumb's longest edge
             */
            'api_getLastLongest': function () {
                return coreObject.last_longest;
            },

            /**
             * @return {array} list of field names
             */
            'api_getMetadataFieldNames': function () {
                return coreObject.metadata_fields;
            },

            /**
             * Get and parse the document's hash
             * @return {object} hash as object
             */
            'api_getAndParseHash': function () {
                return coreObject.hashParse(coreObject.getHash());
            },

            /**
             * write current state as name:value pairs in state_previous
             */
            'api_storeStateAsPrevious': function () {
                return coreObject.storeStateAsPrevious();
            },

            /**
             * @return {object} previous state as name:value pairs
             */
            'api_getPreviousState': function () {
                return {
                    'breadth': coreObject.state_previous['breadth'],
                    'seq': coreObject.state_previous['seq'],
                    'offseq': coreObject.state_previous['offseq'],
                    'debug': coreObject.state_previous['debug'],
                    'imagesnap': coreObject.state_previous['imagesnap']
                };
            },

            /**
             * @param {object} [typically selective] state to overwrite previous with
             * @return {object} previous state as name:value pairs
             */
            'api_overwritePreviousState': function (over) {
                var prev = this.api_getPreviousState();
                return coreObject.merge(prev, over);
            },

            /**
             * @param {object} $ent cell to check (and re-set) bounds for
             */
            'api_setBound': function ($ent) {
                return coreObject.setBound($ent, true);
            },

            /**
             * @param {object} $ent cell to check (and re-set) bounds for
             */
            'api_setDirection': function (dir) {
                return coreObject.setDirection(dir);
            },

            /**
             * @param {int} offseq Set offseq to internal store
             * This is usually set by URL (hash -> handlerHashChanged)
             * but this api call is useful for history correction
             */
            'api_setOffseq': function (offseq) {
                return coreObject.setOffseq(offseq);
            },

            /**
             * @param {int} value to set for thumb's longest edge
             */
            'api_setLastLongest': function (llong) {
                coreObject.last_longest = llong;
            },

            /**
             * @param {object} jQuery cell to load contained images
             * @return {object} jQuery deferred
             */
            'api_waitLoadCell': function ($cell) {
                var recurse = false;
                return coreObject.waitLoadedGetResolution($cell, recurse);
            },

            /**
             * Apply returned metadata to fields
             * @param {object} $ent jQuery entity (shared cached copy)
             * @param {object} data metadata from server
             */
            'api_refreshMetadataApplyToFields': function ($ent, data) {
                return coreObject.refreshMetadataApplyToFields($ent, data);
            },

            /**
             * Compose a new URL for the current page; used for changing root
             * @param {string} root new root, e.g. /file or /zoom
             * @param {boolean} with_hash true to return with the current hash
             * @returns {*}
             */
            'api_getNewUrlForCurrentIdentifier': function (root, with_hash) {
                var slashpos = window.location.pathname.indexOf('/', 1);
                if (slashpos > 0) {
                    // pull current URL
                    var newurl = root + window.location.pathname.substring(slashpos);
                    if (with_hash) {
                        newurl += window.location.hash;
                    }
                    return newurl;
                }
                return false;
            },

            'api_getFirstUrlToken': function() {
                return coreObject.getFirstUrlToken();
            },

            /**
             * Redirect the browser to the named URL
             * @param target URL
             */
            'api_redirect': function (target) {
                window.location = target;
            },

            /**
             * trigger a click and allow caller to bind to its context
             * @param {object} $ent jQuery entity to click
             * @return {object} jQuery deferred
             */
            'api_triggerClick': function ($ent) {
                $ent.trigger('click');
                // get earliest context for current [post-click] hash
                var context = coreObject.eventQueue.get(coreObject.getHash());
                if (context == null) {
                    return coreObject.getDeferred().resolve();
                }
                return context.deferred;
            },

            /**
             * helper function to make testing key presses easier
             */
            'api_triggerKeypress': function (key) {
                return coreObject.fireKeyPress(key);
            },

            /**
             * Make a change to the document's hash
             * @param {object}  options      name:value pairs to go in the hash
             * @param {boolean} push         true to push a history item
             * @param {object} [eventContext] optional event context for decorating an existing deferred
             * @return {object} jQuery deferred
             */
            'api_fireHashUpdate': function (options, push, eventContext) {
                return coreObject.fireHashUpdate(options, push, eventContext);
            },

            /**
             * fire scroll update
             * @param {object} pos  {scrollLeft, scrollTop} new scroll coordinate
             * @param {boolean} numb true to numb listener
             * @return {object} jQuery deferred
             */
            'api_triggerScroll': function (pos, numb) {
                if (numb == undefined) {
                    numb = false;
                }
                // currently experimenting with direct scrolling (no sign of any event)
                // setting this to true create numbing events
                // which have to be expired manually
                var prepareForEvent = false;
                if (prepareForEvent) {
                    // create an event and then fire a scroll, then wait for expiries check
                    if (numb) {
                        // create a null context to numb the event listener
                        var localContext = coreObject.eventQueue.push({
                            // key is cosmetic; envisionPos call will spawn an inheritted context
                            'key': 'api_triggerScroll:' + 'x=' + pos.scrollLeft + '&y=' + pos.scrollTop,
                            'replaceEvent': true,
                            'comment': 'localContext for api_triggerScroll, numb listener'
                        });
                        return coreObject.envisionPos(pos, localContext);
                    }
                    return coreObject.envisionPos(pos);
                } else {
                    // crop the target position against reachable bounds, then scroll
                    coreObject.fireScrollActual(coreObject.cropScrollPositionAgainstViewport(pos), 0);
                }
            },

            /**
             * jump to a specific image
             * @param {int} seq image to advance to
             */
            'api_imageAdvanceTo': function (seq) {
                return coreObject.imageAdvanceTo(seq);
            },

            /**
             * jump forward/back by a certain number of images
             * @param {int} number of images to advance by (+/-)
             */
            'api_imageAdvanceBy': function (by) {
                return coreObject.imageAdvanceBy(by);
            },

            /**
             * use offseq to centre the image
             * @param {string} direction axis to centre on
             * @param {int} image sequence number
             */
            'api_imageCentreOffseq': function (direction, seq) {
                return coreObject.imageCentreOffseq(direction, seq);
            },

            /**
             * @param {int} seq sequence number of image that's being selected
             * @param {string} [optional] direction
             * @return {int} offseq value to keep image exactly where it is in the current viewport
             */
            'api_imageStillShiftOffseq': function (seq, direction) {
                return coreObject.imageStillShiftOffseq(seq, direction);
            },

            /**
             * @return {real} mod function that works with negative numbers
             */
            'api_negative_mod': function (x, m) {
                if (x < 0) return (x + m);
                return x % m;
            },

            /**
             * @param {real} k value to round
             * @param {int} dp number of decimal places to round to (0 by default)
             * @return {real} number rounded to dp
             */
            'api_round': function (k, dp) {
                if (dp == undefined) {
                    dp = 0;
                }
                var scalar = Math.pow(10, dp);
                return Math.round(k * scalar) / scalar;
            },

            /**
             * @return {string} a number padding with leading zeros
             */
            'api_pad': function (num, size) {
                var s = num + '';
                while (s.length < size) {
                    s = '0' + s;
                }
                return s;
            },

            /**
             * substitute values into a mustache template
             * @param {string} template in mustache format
             * @param {object} view collection of values to substitute
             * @return {string} output after substitution
             */
            'api_substitute': function (template, view) {
                return coreObject.substitute(template, view);
            },

            // Test suite support functions

            /**
             * @return {object} create new blank visibility table
             */
            'api_createVisTable': function () {
                return coreObject.visTableMajor.createNew();
            },

            // no comma on last entry
            lastEntry: true
        },

        // no comma on last entry
        lastEntry: true
    };

// return external API object
    return coreObject.exp;

})
(jQuery, undefined);
