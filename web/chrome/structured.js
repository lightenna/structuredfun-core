// ---------
// POLYFILLS
// ---------

// Object.create polyfill
if (typeof Object.create !== 'function') {
  Object.create = function (o) {
    function F() {}
    F.prototype = o;
    return new F();
  };
}

// inherits polyfill
if (typeof Function.prototype.inherits !== 'function') {
  // helper that makes inheritance work using 'Object.create'
  Function.prototype.inherits = function(parent) {
    this.prototype = Object.create(parent.prototype);
  };
}

// missing console in IE
var console = window.console || { log: function() {} };

/**
 * StructuredFun javascript
 * @param {object} $ object reference, so polyfills apply to all jQuery objects
 */
window.sfun = (function($, undefined) {

  // ---------
  // POLYFILLS
  // ---------

  // jQuery selector refresh
  $.fn.refresh = function() {
    return $(this.selector);
  };

  // jQuery caching find function
  $.fn.cachedFind = function(subselector) {
    this.litter = this.litter || {};
    this.litter.cache = this.litter.cache || {};
    if (this.litter.cache[subselector] == undefined) {
      if (debug && false) {
        console.log('cache HIT ('+this.selector+') id['+this.attr('id')+']:'+subselector);
      }
      this.litter.cache[subselector] = this.find(subselector);
    }
    else {
      if (debug && false) {
        console.log('cache MISS ('+this.selector+') id['+this.attr('id')+']:'+subselector);
      }
    }
    return this.litter.cache[subselector];
  };

  // jQuery caching getter
  $.fn.cachedGet = function(key) {
    this.litter = this.litter || {};
    this.litter.cache = this.litter.cache || {};
    return this.litter.cache[key];
  }

  // jQuery caching setter
  $.fn.cachedSet = function(key, value) {
    this.litter = this.litter || {};
    this.litter.cache = this.litter.cache || {};
    this.litter.cache[key] = value;
  }

  // ---------
  // CONSTANTS
  // and private variables
  // ---------

  // debugging state
  var debug = true;
  // default values for view state
  var state_default = [];
  // the previous values for the view state (1 generation)
  var state_previous = [];
  // ms to wait after resize event before re-bound/re-res
  var resize_timeout = null;
  // default selector used to select top-level container
  var container_selector = '#sfun';
  // list of metadata fields supported
  var metadata_fields = ['caption', 'byline', 'headline', 'keywords', 'copyright', 'source'];
  var metadata_flags = ['editable'];
  var editing_metadata = false;
  // last image maxlongest, to shortcut reres using thumb size
  var last_longest = null;
  // device detection
  var likely_fluidScroll = (navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i)? true : false);
  // maintain a rolling mean of image ratios (#sfun.data-ratio-mean)
  var ratio_total = 0;
  var ratio_count = 0;

  // move to state
  var imagesnap = true;

  // jQuery cache
  var $document = $(document);
  var $window = $(window);
  var $html = $('html');
  var $sfun;
  var $sfun_flow;
  var $sfun_selectablecell;
  var $sfun_selectablecell_first;
  var $sfun_selectedcell = [];
  var $sfun_selectablecell_img = [];
  var $sfun_yardx = $('#sfun-yardstick-x');
  var $sfun_yardy = $('#sfun-yardstick-y');

  // jQuery selector caching
  var $img = function(seq) {
    // if we haven't yet cached the selector, or the last time it didn't exist
    if ($sfun_selectablecell_img[seq] == undefined || !$sfun_selectablecell_img[seq].length) {
      $sfun_selectablecell_img[seq] = $('#seq-'+seq);
    }
    // return cached jQuery object
    return $sfun_selectablecell_img[seq];
  };

  // ---------
  // FUNCTIONS
  // ---------

  var init = function() {
    var that = this;
    // no-js (js turned-off in browser), disabled-js (js turned off in sfun)
    if ($html.hasClass('disabled-js')) {
      // js not turned off, so browser will ignore noscript alternatives
      $document.ready(function() {
        $('img[data-desrc!=""]').each(function() {
          // manually swap in data-desrc to src
          $(this).attr('src', $(this).data('desrc'));
        });
      });
    } else {
      $document.ready(function() {
        // fill in jQuery cache
        $sfun = $(container_selector);
        $sfun_flow = $(container_selector+'.flow');
        $sfun_selectablecell = $(container_selector+' > .selectablecell');
        $sfun_selectablecell_first = $(container_selector+' > .selectablecell:first');
        // perform minimal operations on each cell
        $sfun_selectablecell.find('img').each(function() {
          // render Mustache templates
          var template = $(this).data('template-src');
          if (template != undefined) {
            Mustache.parse(template);
          }
          // @todo could strip this out and calc in HTML
          // include ratios if available in mean
          var ratio = $(this).data('ratio');
          if (ratio != undefined) {
            ratio_total += ratio;
            ratio_count += 1;
          }
          // apply cell tinting
          var seq = $(this).data('seq');
        });
        // process state in page HTML next
        state_previous['theme'] = state_default['theme'] = getTheme();
        state_previous['direction'] = state_default['direction'] = getDirection();
        state_previous['breadth'] = state_default['breadth'] = getBreadth();
        state_previous['seq'] = state_default['seq'] = 0;
        state_previous['offseq'] = state_default['offseq'] = 0;
        // bind to page
        bindToHeaderLinks();
        bindToHotKeys();
        bindToImageLinks();
        bindToDirectoryLinks();
        // bindToHover();
        // bindToVideoHover();
        // if we're sideways scrolling, bind to scroll event
        setDirection(getDirection());
        // execute queue of API calls
        exp.flush();
        // process state if set in URL (hash) first
        handlerHashChanged(getHash(), true);
        // don't bind to event handlers until we've started the initial hash (in its critical section)
        bindToHashChange();
        bindToScroll();
        // attach listener to window for resize (rare, but should update)
        $window.resize(function() {
          // buffer('init_resized',
          // // process event
          // function() {
            // flush cache
            getViewportWidth(true);
            getViewportHeight(true);
            // get current hash
            var hash = getHash();
            // update any parts of hash that are viewport-dependent
            if (hash.indexOf('offseq') != -1) {
              var fromHash = hashParse(hash);
              fromHash.offseq = imageCentreOffseq(getDirection());
              hash = hashGenerate(fromHash);
              hashSetTo(hash, false);
            } else {
              // process resize as forced hash change
              handlerHashChanged(hash, true);
            }
          // },
          // // do nothing if dumped
          // function(){},
          // 50); // 50ms
        });
      });
    }
  };

  // ----------------
  // FUNCTIONS: cells
  // ----------------

  /**
   * check that ratio is set for each of the images
   * @param {object} range {first_1, last_n} range of sequence numbers
   * @todo optimise
   */
  var checkRatios = function(range) {
    var deferred = getDeferred();
    var defs = [];
    var wrapUp = function() {
      deferred.resolve();
    }
    for (var i = range.first_1 ; i<= range.last_n ; ++i) {
      var $ent = $img(i);
      var $loadable = $ent.cachedFind('.loadable');
      if ($loadable.data('ratio') == undefined) {
        // wait for image to be loaded in order to get ratio
        defs[defs.length] = waitLoadedGetResolution($ent, true).done(function() {
          setBound($ent, true);
        });
      }
    }
    $.when.apply($, defs).always(wrapUp);
    return deferred;
  };

  /** 
   * @return {object} jQuery deferred
   */
  var cellsResize = function() {
    var that = this;
    var deferred = getDeferred();
    var vis = getVisibleBoundaries();
    var wrapUp = function() {
      // when layoutManager completes a resize, capture cell boundaries for altered cells
      // and invalidate those after last_n because they may have changed
      visTableMajor.updateRange(getDirection(), vis.first, vis.last);
      // see if resize means that different images are visible
      var aftervis = getVisibleBoundaries();
      if (vis.first == aftervis.first && vis.last == aftervis.last) {
        // no need to reset visibles
      } else {
        // use updated table to check visibles, but don't also tell then to reres yet
        setVisibleAll(false);
      }
      deferred.resolve();
    }
    // set range as visible cells including visnear
    var range = calcVisnear(vis.first, vis.last);
    // add selected to range
    range.selected = $sfun_selectedcell.data('seq');
    // set ratio for images within range
    checkRatios(range).done(function() {
      // get the current layoutManager, if we have one
      var layout = layoutManager.select(0);
      if (layout != null) {
        // tell it that we've resized cells
        var laid = layout.layoutResize.call(layout.context, range);
        // laid may be a deferred, but when can cope if it's not
        $.when(laid).done(wrapUp);
      } else {
        wrapUp();
      }      
    });
    // return our deferred either way
    return deferred;
  };

  /**
   * clear previously assigned cell-specific width and height
   */
  var cellsClear = function() {
    // @todo call layout_cellsClear
    $('.cell-specific').css( { 'width':'', 'height':'' } ).removeClass('cell-specific').removeClass('visible vispart visnear');
  };

  // ---------------------
  // FUNCTIONS: thumbnails
  // ---------------------

  /**
   * load thumbnail for principal image in cell, then recurse on subcells
   * @param {object}  $ent   jQuery cell
   * @param {boolean} recurse true to recurse
   */
  var loadThumb = function($ent, recurse) {
    var that = this;
    // find principal images within this cell
    var $loadable = $ent.cachedFind('> .container > .loadable');
    if ($loadable.length) {
      // load thumbnail by swapping in src, if src not already set [async]
      var attr = $loadable.attr('src');
      if (typeof attr === 'undefined' || attr === false) {
        // if we have already reres'd another image, use its size instead of the default thumbnail size
        if ((last_longest != null) && $loadable.hasClass('reresable')) {
          var highres = substitute($loadable.data('template-src'), { 'maxwidth': last_longest, 'maxheight': last_longest } );
          $loadable.attr('src', highres);
        } else {
          // otherwise just use desrc
          $loadable.attr('src', $loadable.data('desrc'));          
        }
      }
    }
    // optionally recurse on sub-cells
    if (recurse) {
      $ent.cachedFind('.subcell').each(function() {
        // only do 1 level of recursion
        loadThumb($(this), false);
      });
    }
  };

  /**
   * update (x/y)-bound on boundable image in cell
   * @param jQuery cell that may have changed size
   * @return {object} $.Deferred
   */
  var loadThumbRefreshBounds = function($ent) {
    // find boundable entity
    var $boundable = $ent.cachedFind('.loadable');
    if ($boundable.length) {
      // 1. update loaded resolution if necessary first
      if ($boundable.data('loaded-width') == undefined || $boundable.data('loaded-height') == undefined) {
        // if waitLoadedGetResolution succeeds, use loaded-width/height
        return waitLoadedGetResolution($ent, true).done(function() {
          // 2a. once we've got the loaded- dimensions, check bounds
          setBound($ent, true);
        });
      } else {
        // 2b. as we've already got the loaded- dimensions, check bounds
        setBound($ent, true);
      }
    }
    // return a resolved deferred
    return getDeferred().resolve();
  };

  // ------------------
  // FUNCTIONS: refresh
  // ------------------

  /**
   * Read data about the image and update metric display
   * @param {object} $ent jQuery object for image
   */
  var refreshMetric = function($ent) {
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
      if (debug && false) {
        // show the size of the image that's been loaded into this img container
        $metric.cachedFind('span.width').html(Math.round($reresable.data('loaded-width')));
        $metric.cachedFind('span.height').html(Math.round($reresable.data('loaded-height')));
        $metric.cachedFind('span.size').show();
      } else {
        // update with current image width and height
        $metric.cachedFind('span.width').html(Math.round(width_current));
        $metric.cachedFind('span.height').html(Math.round(height_current));
      }
      if (!isNaN(perc)) {
        $metric.cachedFind('span.perc').html(perc+'%').show();
      }
      // analyse to see if we're over/under the native res
      if (width_current > width_native || height_current > height_native) {
        $metric.removeClass('super').addClass('sub');
      } else {
        $metric.removeClass('sub').addClass('super');          
      }
    }
    // finally refresh the position of the metric
    refreshMetricPosition($ent);
    // 2s later, add the fade out class, which is almost instant because of mouseout
    $ent.delay(1000).queue(function(next) {
      $(this).addClass('reres-plus-2s');
      next();
    });
  };

  /**
   * check that the image metric is in the right place
   */
  var refreshMetricPosition = function($ent) {
    var $metric = $ent.cachedFind('.imgmetric');
    if ($metric.length) {
      var $image = $ent.cachedFind('.reresable');
      if ($image.length) {
        // move the metric to the corner of the image using coords relative to parent
        $metric.css( { 'top': $image[0].offsetTop, 'left': $image[0].offsetLeft });
      }
    }
  };

  /**
   * refresh the cell.visible status on all/some of the entries
   * @param {int} scrolldir direction of scroll (+ve/-ve) or 0 for no scroll
   * @return {object} jQuery deferred
   */
  var refreshVisibility = function(scrolldir) {
    var that = this;
    // always test all images for visibility, reres, check selection
    return setVisibleAll(true).always(function() {
      refreshSelected(scrolldir);
    });
  };

  /** 
   * refresh the selected entry after a visibility change
   * @param {int} scrolldir direction of scroll (+ve/-ve) or 0 for no scroll
   * @return {object} jQuery deferred
   */
  var refreshSelected = function(scrolldir) {
    var $ent = $sfun_selectedcell;
    // if no selection, or the current selection isn't visible
    if (!$ent.length || !($ent.hasClass('visible') || $ent.hasClass('vispart'))) {
      if (debug && false) {
        console.log('previously selected image '+$ent.data('seq')+' no longer visible');
      }
      // find the next visible one in the scroll direction
      $ent = $(container_selector+' .selectablecell.visible:'+(scrolldir > 0 ? 'first' : 'last'));
      // if no fully visible images to select, use first partially visible
      if ($ent.length == 0) {
        $ent = $(container_selector+' .selectablecell.vispart:'+(scrolldir > 0 ? 'first' : 'last'));
      }
      if ($ent.length) {
        // create and resolve a local context to allow us to numb listener
        var localContext = eventQueue.push({
          'key': 'selected:seq='+$ent.data('seq'),
          'comment': 'localContext for refreshSelected (image-'+$ent.data('seq')+')',
          'replaceEvent': true
        });
        // use hash to select new and deselect old, but numb listener and parent deferred
        return imageAdvanceTo($ent.data('seq'), localContext);
      } else {
        // if no visible/vispart images, don't try to select anything
      }
    }
    return getDeferred().resolve();
  };

  /**
   * Check the display resolution of the image and swap out src if higher res available 
   * @param {object} $ent jQuery entity (shared cached copy)
   * @return {object} jQuery deferred
   */
  var refreshResolution = function($ent) {
    var that = this;
    var $reresable = $ent.cachedFind('.reresable');
    if (!$reresable.length) {
      return getDeferred().resolve();
    }
    // don't attempt to check image resolution on directory
    var type = getType($ent);
    if (!(type == 'image' || type == 'video')) {
      return getDeferred().resolve();
    }
    // flag this image as updating its resolution
    $ent.addClass('reresing');
    // create local deferred and local wrapUp
    var deferred = getDeferred();
    var wrapUp = function() {
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
    refreshMetadata($ent)
    .done(function() {
      // if successful, use metadata to make decision about reres
      var nativeWidth = $reresable.data('native-width');
      var nativeHeight = $reresable.data('native-height');
      // analyse
      var resbracket = 250, brackWidth, brackHeight;
      var bigger = imageContainerWidth > loadedWidth || imageContainerHeight > loadedHeight;
      var available = loadedWidth < nativeWidth || loadedHeight < nativeHeight;
      // optional debugging
      if (debug && false) {
        console.log('image-'+$ent.data('seq')+': checking resolution w['+imageContainerWidth+'] h['+imageContainerHeight+'] nativeWidth['+nativeWidth+'] nativeHeight['+nativeHeight+'] loadedWidth['+loadedWidth+'] loadedHeight['+loadedHeight+']');
      }
      // test to see if we're displaying an image at more than 100%
      if (bigger && available) {
        // only need to think about one dimension, because ratio of image is fixed
        var majorw = (imageContainerWidth >= imageContainerHeight);
        // but that dimension has to be the major dimension 
        // @todo could probably calculate both brackWidth and brackHeight, then combine these two
        if (majorw) {
          // find the smallest resbracket less than nativeWidth, but greater that loadedWidth
          brackWidth = Math.min(Math.ceil(imageContainerWidth/resbracket) * resbracket, nativeWidth);
          // could have resized down, so only swap the image if the brackWidth is greater that the current loaded
          if (brackWidth > loadedWidth) {
            // store max longest to shortcut next thumb load
            last_longest = brackWidth;
            // swap out image and wait for swap to complete
            imageReres($ent, substitute($reresable.data('template-src'), { 'maxwidth': brackWidth } )).always(wrapUp);
          } else {
            wrapUp();
          }
        } else {
          // same but pivot on height rather than width
          brackHeight = Math.min(Math.ceil(imageContainerHeight/resbracket) * resbracket, nativeHeight);
          if (brackHeight > loadedHeight) {
            // store max longest to shortcut next thumb load
            last_longest = brackHeight;
            // swap out image and wait for swap to complete
            imageReres($ent, substitute($reresable.data('template-src'), { 'maxheight': brackHeight } )).always(wrapUp);
          } else {
            wrapUp();
          }
        }
      } else {
        wrapUp();
      }
    })
    .fail(function() {
      // if we can't refresh the metadata, try and manage without it
      if (typeof($reresable.data('loaded-width')) != 'undefined' && typeof($reresable.data('loaded-height')) != 'undefined') {
        if ((imageContainerWidth > loadedWidth) || (imageContainerHeight > loadedHeight)) {
          // don't know native width, so just request at loadedWidth/Height
          imageReres($ent, substitute($reresable.data('template-src'), { 'maxwidth': imageContainerWidth, 'maxheight': imageContainerHeight } )).always(wrapUp);
        } else {
          wrapUp();
        }
      } else {
        wrapUp();
      }
    });
    return deferred;
  };

  /**
   * Request metadata about this image from the server if we don't have it
   * @param {object} $ent jQuery entity (shared cached copy)
   * @return {object} jQuery deferred
   */
  var refreshMetadata = function($ent) {
    var that = this;
    var $reresable = $ent.cachedFind('.reresable');
    if ($reresable.length && $reresable.data('meta-src')) {
      // test to see if we have the metadata
      if (typeof($reresable.data('native-width')) == 'undefined' || typeof($reresable.data('native-height')) == 'undefined') {
        var deferred = getDeferred();
        // fire ajax request
        $.ajax({
          url: $reresable.data('meta-src'),
          dataType: 'json',
        })
        .done(function(data, textStatus, jqXHR) {
          if (typeof(data.meta) != 'undefined') {
            // if we get a response, set the missing resolution data to the image
            $reresable.data('native-width', data.meta.width);
            $reresable.data('native-height', data.meta.height);
            if (debug && false) {
              console.log('image-'+$ent.data('seq')+': received native width['+$reresable.data('native-width')+'] height['+$reresable.data('native-height')+']');
            }
            // set missing metadata fields to their DOM elements
            var fields = metadata_fields.concat(metadata_flags);
            for (var i=0 ; i<fields.length ; ++i) {
              var value = data.meta[fields[i]];
              var $field = $ent.cachedFind('.' + fields[i]);
              switch (fields[i]) {
                case 'headline':
                case 'byline':
                  $field.html(value);
                  break;
                case 'caption':
                case 'copyright':
                case 'keywords':
                case 'source':
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
              if (value == state_default[fields[i]]) {
                if (debug && false) {
                  console.log('v['+value+'] default['+state_default[fields[i]]+'] is default');
                }
                $field.addClass('default');
              }
            }
            // store the entire meta object in the cached jquery object
            $ent.cachedSet('meta', data.meta);
          }
          // resolve the context
          deferred.resolve();
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
          // resolve the context (as a failure)
          deferred.reject();
        });
        if (debug && false) {
          console.log('image-'+$ent.data('seq')+': fired request for native width and height');
        }
        return deferred;
      } else {
        // no need to update metadata
        return getDeferred().resolve();
      }
    }
    // if we couldn't find a suitable candidate and get it's metadata, fail out the deferred
    return getDeferred().reject();
  };

  /**
   * refresh a single image, but ensure that it's loaded first
   * @param {object} $ent jQuery entity (shared cached copy)
   * @param {boolean} reres also refresh the image's resolution
   * @return {object} jQuery deferred
   */
  var refreshImageResolution = function($ent, reres) {
    var that = this;
    var deferred = getDeferred();
    // final stage is to refresh the metric
    var wrapUp = function() {
      // resolve deferred
      deferred.resolve();
      // update metric [async]
      refreshMetric($ent);
    };
    if (reres) {
      // change out the image for a better resolution if one's available
      refreshResolution($ent).always(function() {
        wrapUp();
      });
    } else {
      wrapUp();
    }
    return deferred;
  };

  /**
   * refresh and reres all visible images
   * @return {object} jQuery deferred
   */
  var refreshVisibleImageSet = function() {
    return refreshAnImageSet($(container_selector+' .selectablecell.visible, '+container_selector+' .selectablecell.vispart'), true);
  };

  /**
   * refresh all visnear images, generally don't reres
   * @return {object} jQuery deferred
   */
  var refreshVisnearImageSet = function() {
    // reres only if the shortcut is null
    return refreshAnImageSet($(container_selector+' .selectablecell.visnear'), (last_longest == null));
  };

  /**
   * refresh a specified set of images
   * @param {object} $set jQuery entity for selection
   * @param {boolean} reres true to also reres the images after loading thumbs
   * @return {object} jQuery deferred
   */
  var refreshAnImageSet = function($set, reres) {
    var that = this;
    if ($set.length) {
      var deferred = getDeferred();
      var defs = [];
      // stage 1a: make sure thumbnails loaded and refresh bounds as a batch
      $set.each(function() {
        var $ent = $(this);
        defs.push(loadThumbRefreshBounds($ent));
      });
      // stage 1b: refresh cell dimensions
      defs.push(cellsResize());
      $.when.apply($, defs).always(function() {
        // stage 2: if we're reresing the images
        if (reres) {
          defs = [];
          // refresh $set because resize may have added more visible/vispart/visnear cells
          $set = $set.refresh();
          // stage 3: refresh resolutions as a batch
          $set.each(function() {
            // get shared cached copy of cell
            var $ent = $img($(this).data('seq'));
            defs.push(refreshImageResolution($ent, true));
          });
          $.when.apply($, defs).always(function() {
            // finally resolve
            deferred.resolve();
          });
        } else {
          deferred.resolve();
        }
      });
      return deferred;
    }
    return getDeferred().resolve();
  };
  // ------------------
  // FUNCTIONS: Binding
  // ------------------

  /**
   * process events generated by mouse wheel/trackpad scrolling
   */
  var bindToScroll = function() {
    var that = this;
    if (this.bindToScroll_static == undefined) {
      $window.scroll(function(event) {
        var sx = $document.scrollLeft(), sy = $document.scrollTop();
        handlerScrolled(event, sx, sy);
        event.preventDefault();
      });
      $window.mousewheel(function(event) {
        handlerMouseWheeled(event);
      });
      // guess at the likely existence of a trackpad/magic mouse
      if (likely_fluidScroll) {
        // turn off imagesnap
        imagesnap = false;
      }
      // flag that we've attached our listeners
      this.bindToScroll_static = true;
    }
  };

  /**
   * turn header links into clickable buttons
   */
  var bindToHeaderLinks = function() {
    var that = this;
    // fade out header, then setup hover listeners
    $('.header').css('opacity', 0.5).hover(function(event) {
      // animate header open to full screen width
      $(this).stop(true, false).animate( { width: '100%', opacity: 1.0 }, 100);
      event.preventDefault();      
    }, function(event) {
      // leave header up for 2s, then collapse back down
      $(this).stop(true, false).delay(2000).animate( { width: '2.5em', opacity: 0.5 }, 100);
    });
    // horizontal or vertical layout
    $('#flow-x').click(function(event) {
      fireHashUpdate( { 'direction': 'x' }, false);
      event.preventDefault();
    });
    $('#flow-y').click(function(event) {
      fireHashUpdate( { 'direction': 'y' }, false);
      event.preventDefault();
    });
    // light or dark theme
    $('#theme-light').click(function(event) {
      fireHashUpdate( { 'theme': 'theme-light' }, false);
      event.preventDefault();
    });
    $('#theme-dark').click(function(event) {
      fireHashUpdate( { 'theme': 'theme-dark' }, false);
      event.preventDefault();
    });
    // 1x, 2x, 4x, or 8x
    $('#flow-1').click(function(event) {
      fireHashUpdate( { 'breadth': 1 }, false);
      event.preventDefault();
    });
    $('#flow-2').click(function(event) {
      fireHashUpdate( { 'breadth': 2 }, false);
      event.preventDefault();
    });
    $('#flow-4').click(function(event) {
      fireHashUpdate( { 'breadth': 4 }, false);
      event.preventDefault();
    });
    $('#flow-8').click(function(event) {
      fireHashUpdate( { 'breadth': 8 }, false);
      event.preventDefault();
    });
    
  };

  /**
   * Bind to hotkeys for navigation
   */
  var bindToHotKeys = function() {
    var that = this;
    $document.keydown(function(event) {
      handlerKeyPressed(event);
    });
  };

  /**
   * listen for changes to the hash
   * see https://github.com/browserstate/history.js
   */
  var bindToHashChange = function() {
    var that = this;
    // bind to the hash change (not state hashes)
    History.Adapter.bind(window, 'anchorchange', function(event) {
      event.preventDefault();
      handlerHashChanged(getHash());
    });
  };

  /**
   *  if the image is clicked, redirect to in-page image
   *  based on http://stackoverflow.com/questions/2420970/how-can-i-get-selector-from-jquery-object
   */
  var bindToImageLinks = function() {
    var that = this;
    // bind to click using delegated event handler (http://api.jQuery.com/on/), instead of individual N handlers
    $sfun.on('click', '.selectablecell a.media-container', function(event) {
      // find out which element was clicked using node name and first class only
      var selector = event.target.nodeName.toLowerCase();
      if (event.target.classList.length > 0) {
        selector += '.'+ event.target.classList[0];
      }
      // use parent cell to find seq
      var $ent = $(this).parents('.selectablecell');
      if (handlerImageClicked($ent, selector)) {
        event.preventDefault();
      }
    });
  };

  /**
   * if a directory is clicked, append current visual state to new URL
   */
  var bindToDirectoryLinks = function() {
    var that = this;
    $sfun.on('click', '.selectablecell a.directory-container', function(event) {
      var url = urlDirectoryWithState($(this).attr('href'));
      event.preventDefault();
      // manually jump to new URL
      urlGoto(url);
    });    
  };

  /**
   * if a user hovers over an image, select it
   * currently turned off
   */
  var bindToHover = function() {
    var that = this;
    $sfun.on('mouseenter', '.selectablecell a.container', function(event) {
      // be very careful with code in here as :hover is a very frequent event
      var seq = $(this).parent().data('seq');
      // work out image and viewports positions on major axis
      var direction = getDirection();
      var viewport_base = (direction == 'x' ? $document.scrollLeft() : $document.scrollTop());
      var image_pos = $img(seq).offset();
      var image_base = (direction == 'x' ? image_pos.left : image_pos.top);
      // find current offset of image within viewport, to 0DP
      var offseq = exp.api_round(image_base - viewport_base, 0);
      // select image using hash update
      fireHashUpdate( { 'seq': seq, 'offseq': offseq }, false);
      // optional debugging
      if (debug && true) {
        console.log('hover over img-'+seq);
      }
    });
  }

  /**
   * if a user hovers over a video, use relative position to change thumbnail
   * currently turned off
   */
  var bindToVideoHover = function() {
    var that = this;
    // be very careful with code in here as :hover is a very frequent event
    $sfun.on('mousemove', '.selectablecell a.video-container', function(event) {
      // pull ent using shared cached copy
      var $ent = $img($(this).parent().data('seq'));
      // work out image and cursor positions on x axis (always)
      var image_pos = $ent.offset();
      var cursor_pos = event.pageX - image_pos.left;
      var meta = $ent.cachedGet('meta');
      if (meta != undefined) {
        // calculate frame to request (grouped by partitions)
        // var partitions = 20;
        // var cursor_part = exp.api_round(cursor_pos * partitions / $ent.width(), 0);
        // var cursor_frame = exp.api_round(cursor_part * meta.dv_framecount / partitions, 0);
        // calculate frame to request
        var cursor_frame = exp.api_round(cursor_pos * meta.dv_framecount / $ent.width(), 0);
        // check to see if we're already displaying this frame
        if ($ent.data('frame') == cursor_frame) {
          // do nothing
        } else {
          // tag cell as displaying this frame
          $ent.data('frame', cursor_frame);
          // find image
          var $loadable = $ent.cachedFind('> .container > .loadable');
          if ($loadable.hasClass('frame_pending')) {
            // do nothing
          } else {
            // just change out the img src; no res/ratio changes
            var highres = substitute($loadable.data('template-src'), { 'maxwidth': last_longest, 'maxheight': last_longest, 'timecode': 'f' + cursor_frame } );
            var im = new Image();
            im.onload = im.onerror = function() {
              // re-enable frame loading
              $loadable.removeClass('frame_pending');
              $loadable.attr('src', highres);
            }
            im.src = highres;
            $loadable.addClass('frame_pending')
            // optional debugging
            if (debug && true) {
              console.log(cursor_frame + ' of ' + meta.dv_framecount);
            }            
          }
        }
      }
    });
  }

  // ------------------
  // FUNCTIONS: getters
  // ------------------

  /**
   * updated loaded-width and loaded-height data attributes
   * @param {jQuery object} $ent image to check
   * @param {boolean} recurse true to load subcells too
   * @return {object} jQuery deferred
   */
  var waitLoadedGetResolution = function($ent, recurse) {
    var deferred = getDeferred();
    var defs = [];
    var wrapUp = function() {
      deferred.resolve();
    }
    // process principal image if cell has one
    var $loadable = $ent.cachedFind('> .container > .loadable');
    if ($loadable.length) {
      var principalDeferred = getDeferred();
      defs.push(principalDeferred);
      // update loaded resolution
      var im = new Image();
      // use load handler to read image size
      im.onload = getImageWatcher(im, $loadable, principalDeferred);
      // if for any reason the image can't be loaded
      im.onerror = function() {
        // strip loadable property
        $loadable.removeClass('loadable');
        // prime loadable to reload
        $loadable.data('ratio', undefined);
        $loadable.removeAttr('src');
        // reset the image
        eim = new Image();
        eim.onload = getImageWatcher(eim, $loadable, principalDeferred);
        // swap the source out for the error image
        eim.src = getErrorImagePath();
        // now wait for onload event on error image to resolve deferred
      }
      // if the src attribute is undefined, set it
      if ($loadable.attr('src') == undefined) {
        // use common loadThumb to set it, but don't recurse
        loadThumb($ent, false);
      }
      im.src = $loadable.attr('src');
      if (debug && false) {
        console.log('image-'+$ent.data('seq')+': fired update loaded resolution request');
      }
    }
    // if set, recurse on subcells
    if (recurse) {
      $ent.cachedFind('.subcell').each(function() {
        defs.push(waitLoadedGetResolution($(this), false));
      });
    }
    // wait for all deps to be resolved (includes principal)
    $.when.apply($, defs).done(wrapUp);
    return deferred;
  };

  /**
   * @return {function} an onload function for this image
   */
  var getImageWatcher = function(im, $loadable, deferred) {
    return function() {
      $loadable.data('loaded-width', im.width);
      $loadable.data('loaded-height', im.height);
      // never update the ratio, but set if unset
      setRatioIfUnset($loadable, im.width / im.height);
      // if we've loaded the image for the first time, swap it in (fallback)
      if ($loadable.attr('src') == undefined) {
        $loadable.attr('src', im.src);
      }
      im = null;
      if (debug && false) {
        console.log('image-'+$loadable.parent('.cell').data('seq')+': loaded resolution updated ['+$loadable.data('loaded-width')+','+$loadable.data('loaded-height')+']');
      }
      if (deferred != undefined) {
        // notify promise of resolution
        deferred.resolve();        
      }
    }
  }

  /**
   * Get the real flow direction, not just what the class says because the browser might not support all directions
   * (needs flexbox)
   * @return current flow direction
   */
  var getDirection = function() {
    var direction = 'y';
    if ($html.hasClass('flexbox') && $sfun.hasClass('flow-x')) {
      direction = 'x';
    }
    return direction;
  };

  /**
   * Get the flow breadth
   * @return current flow breadth
   */
  var getBreadth = function() {
    var breadth = 2;
    if ($sfun.hasClass('flow-1')) breadth = 1;
    if ($sfun.hasClass('flow-4')) breadth = 4;
    if ($sfun.hasClass('flow-8')) breadth = 8;
    return breadth;
  };

  /**
   * Get the flow breadth
   * @return next flow breadth in sequence
   */
  var getBreadthNext = function(from, inc) {
    var b = [1, 2, 4, 8];
    var bref = b.indexOf(from);
    if (bref == -1) {
      return 2;
    } else {
      bref += inc;
      // don't allow b to be less than minimum breadth
      if (bref < 0) bref = 0;
      // don't allow b to exceed max breadth
      if (bref >= b.length) bref = b.length-1;
    }
    return(b[bref]);
  };

  /**
   * page scroll offset to sequence number is stored in the html tag [default to 0]
   * @return {int} scroll offset to seq
   */
  var getOffseq = function() {
    var offseq = $html.data('offseq');
    if (offseq == undefined) {
      return 0;
    }
    return offseq;
  }

  /**
   * @return {float} current size of cell along the major axis
   */
  var getCellMajor = function() {
    if (getDirection() == 'x') {
      return $sfun_selectablecell_first.width() + getAlley();
    } else {
      return $sfun_selectablecell_first.height() + getAlley();
    }
  };

  /**
   * @param {int} round non-zero to round to the nearest whole cell
   *   negative to round down, positive to round up
   * @return {float} work out how many cells appear on the major axis
   */
  var getCellMajorCount = function(round) {
    var cell_major = getCellMajor();
    var major_len = (getDirection() == 'x' ? getViewportWidth() : getViewportHeight());
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
    return cell_count;
  };

  /**
   * Return defaults
   *   direction: page direction
   *   breadth: number of cells across minor axis of page
   *   seq: sequence number
   *   offseq: scroll offset to sequence
   * @return {object} get URL default hash arguments
   */
  var getDefaults = function() {
    return { 'theme': state_default['theme'], 'direction': state_default['direction'], 'breadth': state_default['breadth'], 'seq': state_default['seq'], 'offseq': state_default['offseq'] };
  }

  /**
   * @return {int} sequence number of currently selected cell [default to 0]
   */
  var getSeq = function() {
    var $ent = $sfun_selectedcell;
    if (!$ent.length) {
      return 0;
    }
    var seq = $ent.data('seq');
    if (seq == undefined) {
      return 0;
    }
    return seq;
  };

  /**
   * @return {string} theme name, with the theme- prepend
   */
  var getTheme = function() {
    if ($html.hasClass('theme-dark')) {
      return 'theme-dark';
    }
    return 'theme-light';
  };

  /**
   * @return {int} total number of entities (max entry seq+1)
   */
  var getTotalEntries = function() {
    return (parseInt($(container_selector+' .selectablecell:last').data('seq'))+1);
  };

  /**
   * @return {string} type of entity
   */
  var getType = function($ent) {
    if ($ent.hasClass('image-type')) {
      return 'image';
    } else if ($ent.hasClass('video-type')) {
      return 'video';
    } else if ($ent.hasClass('directory-type')) {
      return 'directory';
    }
  };

  /**
   * @return {int} width of page outer border (gutter) in pixels [default 0]
   */
  var getGutter = function() {
    if (this.getGutter_static == undefined) {
      var $gut = $('#gutterball');
      if ($gut.length) { 
        this.getGutter_static = $gut.width();
      } else {
        this.getGutter_static = 0;
      }
    } 
    return this.getGutter_static;
  }

  /**
   * @return {int} width of alley (cell-to-cell) in pixels [default 0]
   */
  var getAlley = function() {
    if (this.getAlley_static == undefined) {
      var $alley = $('#alleyball');
      if ($alley.length) { 
        this.getAlley_static = $alley.width();
      } else {
        this.getAlley_static = 0;
      }
    } 
    return this.getAlley_static;
  }

  /**
   * @return {int | bool} next sequence number, or false on failure
   */
  var getNextSeq = function(seq, increment) {
    var startingPointSeq = seq;
    do {
      seq = (seq+increment) % getTotalEntries();
      // wrap around
      if (seq < 0 && increment < 0) {
        seq = getTotalEntries()-1;
      }
      if ($img(seq).length) {
        return seq;
      }
    } while (seq != this.startingPointSeq);
    return false;
  }

  /**
   * return a shared deferred if one exists, or create one if not
   * @return {jQuery} deferred
   */
  var getDeferred = function() {
    return new $.Deferred();
  };

  /**
   * get the viewport height, but don't cache it because scrollbars appear/disappear
   * @return {real} height of viewport in pixels
   */
  var getViewportHeight = function(force) {
    if ($sfun_yardy.length) {
      return $sfun_yardy.height();
    } else {
      // fall back to window
      return $window.height();
    }
  };

  /**
   * get the viewport width, but don't cache it because scrollbars appear/disappear
   * @return {real} width of viewport in pixels
   */
  var getViewportWidth = function(force) {
    if ($sfun_yardx.length) {
      return $sfun_yardx.width();
    } else {
      // fall back to window
      return $window.width();
    }
  };

  /** 
   * @todo probably need to find a way to make this overwriteable for js lib clients
   * @return string path to error image
   */
  var getErrorImagePath = function() {
    return '/chrome/images/fullres/missing_image.jpg';
  }

  // ------------------
  // FUNCTIONS: setters
  //   all called downstream of events
  // ------------------

  /**
   * set all 'flow' elements to flow in the direction
   */
  var setDirection = function(direction) {
    var changed = (getDirection() !== direction);
    var invdir = (direction == 'x' ? 'y' : 'x');
    // set flow-<direction> on ul.flow and html
    $sfun_flow.add($html).addClass('flow-' + direction).removeClass('flow-' + invdir);
    return changed;
  };

  /**
   * set the width of the screen flow
   * e.g. number of cells vertically if in vertical mode
   */
  var setBreadth = function(breadth) {
    var changed = (getBreadth() !== breadth);
    // remove all the other breadths
    for (var i=1 ; i <= 8 ; i=i*2) {
      // don't remove the breadth we're setting
      if (i == breadth) {
        continue;
      }
      $sfun_flow.removeClass('flow-'+i);
      $html.removeClass('flow-'+i);
    }
    // apply class to both sfun and page (for page-wise effects)
    $sfun_flow.addClass('flow-' + breadth);
    $html.addClass('flow-' + breadth);
    // return whether we actually changed it or not
    return changed;
  };

  /**
   * use rolling image mean and viewport dimensions to calculate optimal number of cells on major axis
   */
  var refreshDynamicMajors = function(breadth, direction) {
    var ratio_mean = ratio_total / ratio_count;
    // avoid division by zero
    if (ratio_total == 0) {
      ratio_mean = 1.5;
    }
    // set to DOM
    $sfun.data('ratio-mean', ratio_mean);
    // tell DOM that we're going to be setting up dynamic major axis cell widths
    $sfun.addClass('flow-dynamic-major');
    // get viewport ratio
    var viewport_ratio = getViewportWidth() / getViewportHeight();
    // calculate number of cells to show on the major axis (at least 1)
    var cell_count = (direction == 'x' ? 
      Math.max(1, viewport_ratio * breadth * 1 / ratio_mean) :
      Math.max(1, 1 / viewport_ratio * breadth * ratio_mean)
    );
    var cell_perc = 100 / cell_count;
    // optional debugging
    if (debug && true) {
      console.log('ratio_mean['+ratio_mean+'] viewport_ratio['+viewport_ratio+'] cell_count['+cell_count+']');
    }
    // overwrite existing CSS selector
    createCSSSelector('.sfun.flow-pc.flow-dynamic-major > .cell.resizeablecell', (direction == 'x' ? 'width' : 'height') + ': calc(' + cell_perc + '% - 8px);');
  };

  /**
   * @param int sequence number of image to make current
   */
  var setSeq = function(seq) {
    var changed = (getSeq() !== seq);
    var position;
    if ($sfun_selectedcell.length) {
      // deselect old image
      $sfun_selectedcell.removeClass('selected');
    }
    // select new image
    $sfun_selectedcell = $img(seq);
    $sfun_selectedcell.addClass('selected');
    return changed;
  };

  /**
   * page scroll offset to sequence number is stored in the html tag
   * @param {int} offset scroll offset to seq
   */
  var setOffseq = function(offseq) {
    var current = $html.data('offseq');
    var changed = (current !== offseq && current !== undefined);
    $html.data('offseq', offseq);
    return changed;
  };

  /**
   * @param {string} theme_name css name of theme to apply (includes theme- prepend)
   */
  var setTheme = function(theme_name) {
    switch (theme_name) {
      case 'theme-dark':
        $html.addClass(theme_name);
        break;
      case 'theme-light':
      default:
        // darkness is only the absence of light
        $html.removeClass('theme-dark');
        break;
    }
  };

  /**
   * set bounds for a cell
   * @param {object} $ent jQuery entity
   * @param {boolean} recurse true to recurse on subcells
   */
  var setBound = function($ent, recurse) {
    var that = this;
    var $boundable = $ent.cachedFind('> .container > .boundable');
    if ($boundable.length) {
      // detect if the image is bound by width/height in this container
      var ix = $boundable.data('loaded-width'), iy = $boundable.data('loaded-height');
      // read container width/height
      var cx = $ent.width(), cy = $ent.height();
      var cratio = cx / cy;
      if (debug && false) {
        console.log('image-'+$ent.data('seq')+': ['+ix+','+iy+'] checking bound within ['+cx+','+cy+']');
      }
      var iratio = ix / iy;
      var direction = ((cratio / iratio) > 1.0 ? 'y' : 'x');
      var invdir = (direction == 'x' ? 'y' : 'x');
      if (debug && false) {
        console.log('cx[' + cx + '] cy[' + cy + '] cratio[' + cratio + '], ix[' + ix + '] iy[' + iy + '] iratio['
            + iratio + ']: ' + (cratio / iratio).toPrecision(3) + '= ' + direction + '-bound');
      }
      // apply class to image
      $boundable.addClass(direction + '-bound').removeClass(invdir + '-bound');
    }
    // optionally recurse on sub-cells
    if (recurse) {
      $ent.cachedFind('.subcell').each(function() {
        // only do 1 level of recursion
        setBound($(this), false);
      });
    }
  }

  /**
   * @param {object} $loadable jQuery image to set ratio for
   * @param {float} ratio
   * @return {boolean} true if the ratio was updated
   */
  var setRatioIfUnset = function($loadable, ratio) {
    if ($loadable.data('ratio') == undefined) {
      $loadable.data('ratio', ratio);
      // increment the rolling mean
      ratio_total += ratio;
      ratio_count += 1;
      return true;
    }
    return false;
  }

  /**
   * @param {object} target position
   *        {int} scrollLeft distance from left of page in pixels
   *        {int} scrollTop  distance from top of page in pixels
   * @return {object} target position cropped against viewport
   */
  var cropScrollPositionAgainstViewport = function(target) {
    return {
      'scrollLeft': exp.api_round(Math.max(0, Math.min(target.scrollLeft, $document.width() - getViewportWidth())), 0),
      'scrollTop': exp.api_round(Math.max(0, Math.min(target.scrollTop, $document.height() - getViewportHeight())), 0)
    };
  }

  /** 
   * ensure that a given image lies within the current viewport
   * @param {int} seq image sequence number
   * @param {int} [offseq] scroll offset to seq image [default: 0]
   * @param {object} [eventContext] optional event context to attach this to
   * @return {object} jQuery deferred
   */
  var envisionSeq = function(seq, offseq, eventContext) {
    var $ent = $img(seq);
    var direction = getDirection();
    if (offseq == undefined) {
      offseq = 0;
    }
    // if we found the cell
    if ($ent.length) {
      // get the cell's position
      var position = $ent.offset();
      // work out the target position
      var target = { 'scrollLeft': (direction == 'x' ? position.left - offseq : 0), 'scrollTop': (direction == 'x' ? 0 : position.top - offseq) };
      // pass target to shared function
      return envisionPos(target, eventContext);
    }
    return getDeferred().resolve();
  };

  /** 
   * ensure that a given target position lies within the current viewport
   * @param {object} target {[scrollLeft], [scrollTop]} position in pixels, absolute or relative to current
   * @param {object} [eventContext] optional event context to attach this to
   * @param {boolean} [relativeTarget] true to use target as a relative offset from current position
   * @return {object} jQuery deferred
   */
  var envisionPos = function(target, eventContext, relativeTarget) {
    var fireScroll = false;
    // setup argument defaults
    if (relativeTarget == undefined) {
      relativeTarget = false;
    }
    // work out current scroll position
    var scroll = { 'scrollTop': $document.scrollTop(), 'scrollLeft': $document.scrollLeft() };
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
    target = cropScrollPositionAgainstViewport(target);
    // check to see if our current scroll position reflects the target position
    var direction = getDirection();
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
      return refreshVisibility(0);
    }    
    // scroll to the target position
    // animate if we're using a relative offset
    return fireScrollUpdate(target, eventContext, (typeof(eventContext.animate) != 'undefined' ? eventContext.animate : 0));
  };

  /**
   * Work out what cells are visible at the moment
   * @return {object} describing visible cells
   *   first:seq of first visible, last:seq of last visible
   */
  var getVisibleBoundaries = function() {
    var vis = {};
    var min, max;
    // cells' offset is a couple of pixels left of image
    var rounding = getGutter()+1;
    var direction = getDirection();
    // get screen bounds along major axis (min and max)
    if (direction == 'x') {
      // min is left bar minus rounding for border/margin
      min = $document.scrollLeft() - rounding;
      // max is right bar minus rounding for border/margin
      max = $document.scrollLeft() + getViewportWidth() - rounding;
    } else {
      min = $document.scrollTop() - rounding;
      max = $document.scrollTop() + getViewportHeight() - rounding;
    }
    // find first spanning min boundary
    var firstRef = visTableMajor.findCompare(min, exp.compareGTE, false);
    var firstMatch = visTableMajor.select(firstRef);
    if (firstMatch == null) {
      // use the first entry in table
      firstMatch = visTableMajor.select(0);
    }
    vis.first = firstMatch.$ent.data('seq');
    // work backwards from spanning min boundary to include partials
    for (var i = vis.first ; i >= 0 ; --i) {
      var $ent = $img(i);
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
    var lastRef = visTableMajor.findCompare(max, exp.compareLTE, true);
    var lastMatch = visTableMajor.select(lastRef);
    if (lastMatch == null) {
      // use the last entry in the table
      lastMatch = visTableMajor.select(visTableMajor.getSize()-1);
    }
    vis.last = lastMatch.$ent.data('seq');
    // assume all visibles are non-partial, then test
    vis.lastFirstPartial = -1;
    vis.firstLastPartial = 99999;
    // check first visibles for partial visibility
    for (var i = vis.first ; i <= vis.last ; ++i) {
      var $ent = $img(i);
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
    for (var i = vis.last ; i >= vis.first ; i--) {
      var $ent = $img(i);
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
  }

  /**
   * Loop through all images
   * @todo optimise
   * @param {boolean} thenRefresh true to also refresh new vis images
   * @return {object} jQuery deferred
   */
  var setVisibleAll = function(thenRefresh) {
    var that = this;
    // test to see if we found any selectable cells
    if ($sfun_selectablecell.length) {
      var deferred = getDeferred();
      var defs = [];
      var wrapUp = function() {
        // resolve the deferred
        deferred.resolve();
      }
      // clear all the visible images
      $sfun_selectablecell.removeClass('visible vispart visnear');
      // derive boundaries of visible cells
      var vis = getVisibleBoundaries();
      for (var i = vis.first ; i <= vis.last ; i++) {
        var vistype = ((i <= vis.lastFirstPartial || i >= vis.firstLastPartial) ? 'vispart' : 'visible');
        setImageVisibilityClass($img(i), vistype);
      }
      if (thenRefresh) {
        // now batch process all the visibles
        refreshVisibleImageSet().done(wrapUp);
      } else {
        wrapUp();
      }
      // now request visnear images, but don't wait for them (async, not resync)
      var ignored_deferred = setVisnearAll(vis);
      return deferred;
    }
    return getDeferred().resolve();
  };

  /**
   * either flag an image as visible or not visible
   * @param {jQuery} $ent image
   * @param {string} 'visible' true to make visible, 'not visible' to hide
   *   or 'visnear' to make visible but not re-res
   */
  var setImageVisibilityClass = function($ent, vis) {
    var that = this;
    if (debug && false) {
      console.log('image-'+$ent.data('seq')+': making '+vis);
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
        loadThumb($ent, true);
      }
    }
  };

  /**
   * @param {int} first_np1 first visible is visnear_n+1
   * @param {int} last_0 last visible is visnear_0
   * @return {object} {last_1, last_n, first_1, first_n}
   */
  var calcVisnear = function(first_np1, last_0) {
    var cellcount = getTotalEntries();
    var reach = getBreadth() * exp.visnearBreadthMULTIPLIER;
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
  }

  /**
   * flag blocks of images near (before & after) visibles
   * @param {object} vis range of visible images
   * @return {object} jQuery deferred
   */
  var setVisnearAll = function(vis) {
    // find visnear first and last visible
    var range = calcVisnear(vis.first, vis.last);
    // optional debugging
    if (debug && false) {
      console.log('images-('+range.first_1+' to '+range.first_n+'): making visnear (before visibles)');
    }
    if (debug && false) {
      console.log('images-('+range.last_1+' to '+range.last_n+'): making visnear (after visibles)');
    }
    // only do last visnear if there are some entries AFTER visibles
    if (range.last_1 != vis.last) {
      // request visnear (after visibles), async
      for (var i = range.last_1 ; i <= range.last_n ; i++) {
        setImageVisibilityClass($img(i), 'visnear');
      }
    }
    // only do first visnear if there are some entries BEFORE visibles
    if (range.first_n != vis.first) {
      // request visnear (before visibles), async
      for (var i = range.first_1 ; i <= range.first_n ; i++) {
        setImageVisibilityClass($img(i), 'visnear');
      }
    }
    // now load visnears
    return refreshVisnearImageSet();
  }

  // --------------------
  // FUNCTIONS: image ops
  // --------------------

  /**
   * Swap out image using a temporary image (to get triggered on load event)
   * Can't just switch src on $ent, because that image is already loaded
   * Firebug doesn't show the updated data- attributes, but they are updated
   * @return {object} jQuery deferred
   */
  var imageReres = function($ent, path) {
    var that = this;
    var $reresable = $ent.cachedFind('.reresable');
    if ($reresable.length) {
      var deferred = getDeferred();
      // create temporary image container
      var img = $('<img id="dynamic" />');
      // attach listener to catch when the new image has loaded
      img.attr('src', path).one('load', function() {
        // now that it's pre-cached by the temp, apply to original image
        $reresable.attr('src', path);
        // store loaded width and height
        $reresable.data('loaded-width', this.width);
        $reresable.data('loaded-height', this.height);
        // never update the ratio, but set if unset
        setRatioIfUnset($reresable, this.width / this.height);
        // notify promise of resolution
        deferred.resolve();
        // process async actions
        if (debug && false) {
          console.log('image-'+$ent.data('seq')+': swapped out for ('+$reresable.data('loaded-width')+','+$reresable.data('loaded-height')+')');
        }
        refreshMetric($ent);
        // flag as reres'd, no longer reresing
        $ent.removeClass('reresing');
      }).each(function() {
        if(this.complete) $(this).load();
      });
      // return local context so that when we complete (resolve), our parents can execute
      return deferred;
    }
    $ent.removeClass('reresing');
    return getDeferred().resolve();
  };

  /**
   * advance forward or back by a certain number of images in the sequence
   * @param {int} increment positive to go to next, negative for previous
   * @param {object} eventContext optional event context for decorating an existing deferred
   * @return {object} jQuery deferred
   */
  var imageAdvanceBy = function(increment, eventContext) {
    var that = this;
    // start with the current image
    var seq = getSeq();
    var wrapUp = function() {
      if (eventContext) {
        return eventQueue.resolve(eventContext);
      }
    }
    if (seq >= 0 && seq < getTotalEntries()) {
      // iterate to find next image
      if ((seq = getNextSeq(seq, increment)) !== false) {
        return imageAdvanceTo(seq, eventContext).done(wrapUp);
      }
    } else {
      console.log('warning: erroneous seq('+seq+') returned by getseq');
    }
    return wrapUp();
  };

  /**
   * advance to a specific image in the sequence
   * @param {int} image sequence number
   * @param {object} [eventContext] optional event context for decorating an existing deferred
   */
  var imageAdvanceTo = function(seq, eventContext) {
    // @todo nicer alignment
    // update using hash change
    return fireHashUpdate( { 'seq': seq }, false, eventContext);
  };

  /**
   * @param {string} direction
   * @return {int} viewport centre offset by half the width of a cell (for this view size)
   */
  var imageCentreOffseq = function(direction) {
    // work out how to centre image
    var viewport_ratio = getViewportWidth() / getViewportHeight();
    var ratio_mean = ratio_total / ratio_count;
    // we're centring the image fullscreen, so can't use current width
    var cell_count_fullscreen = (direction == 'x' ? 
      Math.max(1, viewport_ratio * 1 * 1 / ratio_mean) :
      Math.max(1, 1 / viewport_ratio * 1 * ratio_mean)
    );
    // work out what the cell width will be when fullscreen
    var viewport_major = (direction == 'x' ? getViewportWidth() : getViewportHeight())
    var viewport_midpoint = viewport_major / 2;
    var cell_major = viewport_major / cell_count_fullscreen;
    var cell_midpoint = cell_major / 2;
    var offseq = exp.api_round(viewport_midpoint - cell_midpoint, 0);
    // optional debugging
    if (debug && false) {
      console.log('viewport_midpoint['+viewport_midpoint+'] cell_count_fullscreen['+cell_count_fullscreen+'] cell_midpoint['+cell_midpoint+'] offseq['+offseq+']');
    }
    return offseq;
  }

  /**
   * switch between the default breadth and fullscreen
   * @param {int} seq image to make fullscreen
   * @param {object} eventContext optional event context for decorating an existing deferred
   * @return {object} jQuery deferred
   */
  var imageToggleFullscreen = function(seq, eventContext) {
    var $ent = $img(seq);
    switch (getType($ent)) {
      case 'image':
        var offseq = imageCentreOffseq(getDirection());
        // toggle using hash change
        if (getBreadth() == 1) {
          return fireHashUpdate( { 'breadth': state_previous['breadth'], 'seq': seq, 'offseq': state_previous['offseq'] }, false, eventContext);
        } else {
          return fireHashUpdate( { 'breadth': 1, 'seq': seq, 'offseq': offseq }, false, eventContext);
        }
        break;
      case 'directory':
        var $clickable = $ent.cachedFind('.clickable');
        if ($clickable.length) {
          window.location = $clickable.attr('href');
        }
        break;
    }
    return eventQueue.resolve(eventContext);
  };

  /**
   * setup an image metadata editing form for this image
   * @param {int} seq image to edit
   */
  var imageSetupEdit = function(seq) {
    var $root = $img(seq).addClass('editing');
    var $form = $('#metaform');
    // setup fields to edit
    var fields = metadata_fields;
    // substitute values
    for (var i=0 ; i<fields.length ; ++i) {
      var key = fields[i];
      $form.cachedFind('input#form_'+key).val($root.cachedFind('.'+key).html());
    }
    // hide displayed metadata (in spans)
    $root.cachedFind('.meta > .base').hide();
    // move form (don't clone) because it's full of #ids
    $root.append($form);
    // put the caret in the headline box
    fieldPutCursorAtEnd($form.cachedFind('.headline'));
    // flag that we're editing
    editing_metadata = seq;
  };

  /**
   * tear down an image metadata editing form for this image
   */
  var imageTeardownEdit = function() {
    var seq = editing_metadata;
    var $root = $img(seq).removeClass('editing');
    var $form = $('#metaform');
    // move form (don't clone) back to its invisible holder
    $('#metadata_form_sleeve').append($form);
    // re-show displayed metadata (in spans)
    $root.cachedFind('.meta > .base').show();
    // flag that we're no longer editing an image
    editing_metadata = false;
  };

  // ------------------
  // FUNCTIONS: URL ops
  // ------------------

  /**
   * change up a directory
   */
  var urlChangeUp = function() {
    var url = window.location.href;
    var lastChar = url.length;
    // if we use a hash, start backwards from there
    var lastHash = url.lastIndexOf('#');
    if (lastHash != -1) {
      lastChar = lastHash-1;
    }
    // check for a / immediately prior to the hash
    if (url[lastChar] == '/') {
      lastChar--;
    }
    // search backwards from lastChar to find preceding slash
    var previousSlash = url.lastIndexOf('/', lastChar);
    if (previousSlash != -1) {
      // new URL should include slash
      var newUrl = url.substring(0, previousSlash+1);
      // append filtered hash
      var filteredHash = getFilteredHash();
      // redirect to new page
      urlGoto(newUrl + exp.stringHASHBANG + filteredHash);
    }
    return false;
  };

  /**
   * redirect to another url
   * @param {string} newUrl new location
   */
  var urlGoto = function(newUrl) {
    window.location.href = newUrl;
  };

  /**
   * @return {string} URL of this directory with preserved hash state
   */
  var urlDirectoryWithState = function(newUrl) {
    var filteredHash = hashGetPreserved();
    return newUrl + exp.stringHASHBANG + filteredHash;
  };

  // ---------------
  // FUNCTIONS: hash
  // ---------------

  /**
   * @param {hash}    hash string to go to browser
   * @param {boolean} push true to push a history item
   */
  var hashSetTo = function(hash, push) {
    // fire event: change the window.location.hash, allow handler to resolve context
    if (push) {
      History.pushState({}, null, exp.stringHASHBANG + hash);
    } else {
      // -- doesn't always work!
      History.replaceState({}, 'Image', exp.stringHASHBANG + hash);
      // have to read it back and check; History hashes come back without #
      readback = History.getHash();
      if ((exp.stringHASHBANG + hash) != ('#'+readback)) {
        // -- leaves a messy history trail
        window.location.hash = exp.stringHASHBANG + hash;
      }
    }
  }

  /**
   * convert an object to a hash string
   * @param {object} values as an object
   * @return {string} hash as string (without a # prepend)
   */
  var hashGenerate = function(obj) {
    var hash = '';
    for (var key in obj) {
        // only set name:value pair if not default
      if (obj[key] == state_default[key]) {
        // don't set the hash, because we'll fall back to the default anyway
      } else {
        if (hash != '') {
          hash += '&';
        }
        hash += key+'='+obj[key];
      }
    }
    return hash;
  };

  /**
   * @param {string} h1 first hash
   * @param {string} h2 second hash
   * @return {boolean} true if the two hashes are equivalent
   */
  var hashEquals = function(h1, h2) {
    return(h1 == h2);
  };

  /**
   * parse out integers from hash attributes
   * @param {string} hash string
   * @return {object} hash values as an object
   */
  var hashParse = function(hash) {
    var output = {};
    // look for hash arguments
    if (hash.length > 1) {
      // strip leading hashbang if set
      var hblen = exp.stringHASHBANG.length;
      if (hash.substr(0, hblen) == exp.stringHASHBANG) {
        hash = hash.substr(hblen);
      }
      // override defaults if set
      var hashpairs = hash.split('&');
      for (var i=0 ; i<hashpairs.length ; ++i) {
        // var eqpos = hashpairs[i].indexOf('=');
        var components = hashpairs[i].split('=');
        var value;
        switch(components[0]) {
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
  };

  /**
   * check that the values in this object are valid
   * @param {object} hash name:value pairs
   * @return {boolean} true if they're ok
   */
  var hashValidate = function(hash) {
    var deleteCount = 0;
    for (var attrname in hash) {
      switch(attrname) {
        case 'seq':
          if (!((hash[attrname] >= 0) && (hash[attrname] < getTotalEntries()))) {
            deleteCount++;
            // remove entry from hash
            delete hash[attrname];
          }
          break;
      }
    }
    // true if we haven't deleted/fixed anything
    return (deleteCount == 0);
  };

  /**
   * get a hash for the bits of current visual state (with overrides) that we preserve between pages (directories)
   * @param  {object} [options] optional options to overwrite current state
   * @return {string} hash as string
   */
  var hashGetPreserved = function(options) {
    var obj = hashParse(getHash());
    // unset unpreserved state
    if (typeof('obj.seq') != 'undefined') {
      delete obj.seq;
    }
    if (options != undefined) {
      // overwrite with options
      merge(obj, options);
    }
    // convert to hash string
    hash = hashGenerate(obj);
    return hash;
  }

  // --------------------------
  // LIBRARY: generic hashTable
  // --------------------------

  /**
   * create a generic hashTable
   * @param {string} namearg name of the table (used for debugging messages)
   * @return {object} hashTable object
   */
  var createHashTable = function(namearg) {
    if (typeof(namearg) == 'undefined') {
      namearg = '<unnamed>';
    }
    return {
      // optional name
      'name': namearg,
      // array of objects, stored in dense sequential
      'objarr': [],
      // array of keys, stored in dense sequential
      'keyarr': [],

      // length of queue
      'length': 0,
      // counter for dishing out unique IDs
      'counter': 0,

      /**
       * @param {array} arr Array of elements to push into hash table
       */
      'add': function(arr) {
        // loop through array adding elements
        for (var i=0 ; i<arr.length ; ++i) {
          var obj = arr[i];
          // if element isn't an object already
          if (typeof(obj) != 'object') {
            // create an object wrapper for this key
            obj = {};
            obj.key = arr[i];
          }
          // push into hash table
          this._push(obj);
        }
      },

      /**
       * wipe the hash table
       */
      'wipe': function() {
        this.objarr.length = 0;
        this.keyarr.length = 0;
        // don't reset counter because old objects may still be floating about
      },

      /**
       * interface function push obj onto queue
       * this function may be overwritten by specialist hash tables
       * @param {object} obj to push
       */
      'push': function(obj) {
        this._push(obj);
        return obj;
      },

      /**
       * actually push obj onto queue
       * @param {object} obj to push
       */
      '_push': function(obj) {
        // get next free position, but don't store in obj because it can change
        var ref = this.getSize();
        // if object has ref set, use instead
        if (obj.ref != undefined) {
          ref = obj.ref;
        }
        // store ID and ready for next ID request
        obj.idx = 1000 + this.counter++;
        // store in object array
        this.objarr[ref] = obj;
        // store in the index array(s), allow duplicate keys
        this.keyarr[ref] = obj.key;
        // optional debugging
        if (debug && false) {
          console.log('pushed object['+this.render(obj)+'] on to ref['+ref+'] '+this.name+' hashTable, now has '+this.getSize()+'elements');
        }
        return ref;
      },

      /**
       * @return {string} render simple string of object
       */
      'render': function(obj) {
        if (obj == null) {
          return '<no object>';
        }
        return obj.key;
      },

      /**
       * @param {mixed} key to search for
       * @param {bool} [findLast] true to find last occurrence of this key
       * @return {int} array reference or -1 if not found
       */
      'find': function(key, findLast) {
        var ref;
        // set defaults on optional arguments
        if (typeof(findLast) == 'undefined') {
          findLast = false;
        }
        if (findLast) {
          ref = this.keyarr.lastIndexOf(key);
        } else {
          ref = this.keyarr.indexOf(key);
        }
        return ref;
      },

      /**
       * @param {mixed} key to search for, as regular expression without slashes
       * @param {bool} [findLast] true to find last occurrence of this key
       * @return {int} array reference or -1 if not found
       */
      'findRegex': function(key, findLast) {
        var ref;
        // set defaults on optional arguments
        if (typeof(findLast) == 'undefined') {
          findLast = false;
        }
        // prep search loop
        var re = new RegExp(key, 'g');
        $matches = [];
        for (var i=0 ; i<this.keyarr.length ; i++) {
          // try and match the key against this key
          if (this.keyarr[i].match(re) != null) {
            // store position of match
            ref = i;
            if (!findLast) {
              // if we're not looking for the last one, break at the first match
              break;
            }
          }
        }
        return ref;
      },

      /**
       * @param {mixed} key to pivot around
       * @param {int} increment positive for >=, negative for <=
       * @param {bool} [findLast] true to find last occurrence of this key
       * @return {int} ref position of object matching this comparison, or -1 if not found
       */
      'findCompare': function(key, comparison, findLast) {
        // set defaults on optional arguments
        if (typeof(findLast) == 'undefined') {
          findLast = false;
        }
        // find boundaries of array
        var minRef = 0;
        // detect sparse array
        if (this.keyarr[minRef] == undefined) {
          for (var i in this.keyarr) {
            // array keys returned as strings, so convert
            minRef = parseInt(i);
            break;
          }
        }
        var maxRef = this.getSize() - 1;
        // setup binary search
        var currentRef;
        var currentElement;
        while (minRef <= maxRef) {
          // find middle ref, and element's value
          currentRef = (minRef + maxRef) / 2 | 0;
          currentElement = this.keyarr[currentRef];

          // if less than key
          if (currentElement < key) {
            // raise min to current+1
            minRef = currentRef + 1;
          }
          // if greater than key
          else if (currentElement > key) {
            // lower max to current-1
            maxRef = currentRef - 1;
          }
          // if equal
          else {
            // converge on current
            minRef = maxRef = currentRef;
            break;
          }
        }
        // process based on direction of comparison (LTE/GTE)
        if (comparison > 0) {
          if (minRef < 0 || minRef >= this.getSize()) return -1;
          currentElement = this.keyarr[minRef];
          // work forwards looking for identical value to first >= key
          return this.find(currentElement, false);
        } else {
          if (maxRef < 0 || maxRef >= this.getSize()) return -1;
          currentElement = this.keyarr[maxRef];
          // work backwards looking for identical value to last <= key
          return this.find(currentElement, true);
        }
      },

      /**
       * update key for a given object
       * @param {int} ref position in object array
       * @param {objext} obj object to update
       * @param {mixed} new_key
       */
      'replaceKey': function(ref, obj, new_key) {
        if (this.objarr[ref] == obj) {
          // upate object itself
          obj.key = new_key;
          // update key array
          this.keyarr[ref] = new_key;
        }
      },

      /**
       * Could use any object property to dereference it (like ID)
       * @param {object} object to remove if found
       * @return {int} array reference if removed or -1 if not found
       */
      'removeObj': function(obj) {
        // use key to deref object
        return this.removeKey(obj.key);
      },

      /**
       * @param {string} key to remove if found
       * @return {int} array reference if removed or -1 if not found
       */
      'removeKey': function(key) {
        // find this key in the array
        var ref = this.find(key);
        if (ref != -1) {
          var obj = this.objarr[ref];
          this.removeRef(ref);
          // optional debugging output
          if (debug && false) {
            console.log('removed ['+this.render(obj)+'] from '+this.name+' hashTable');
          }
        }
        return ref;
      },

      /**
       * @param {int} ref to remove
       */
      'removeRef': function(ref) {
        // delete from the object array
        this.objarr.splice(ref, 1);
        // delete from the index array
        this.keyarr.splice(ref, 1);
      },

      /**
       * This can be used just prior to a _push to get the ID that will be assigned by that _push
       * @return {int} object counter in the hashTable
       */
      'getCounter': function() {
        return this.counter;
      },

      /**
       * @return {int} total number of entries in table
       */
      'getSize': function() {
        return this.objarr.length;
      },

      /** 
       * interface function to get from table
       * @param {string} key to search for
       * @param {bool} [alsoRemove] true to delete matched elements
       * @param {bool} [findLast] true to find last occurrence of this key
       * @return {object} matched object or null if not found
       */
      'get': function(key, alsoRemove, findLast) {
        // set defaults on optional arguments
        if (typeof(alsoRemove) == 'undefined') {
          alsoRemove = false;
        }
        if (typeof(findLast) == 'undefined') {
          findLast = false;
        }
        return this._get(key, alsoRemove);
      },

      /** 
       * actually get object from table
       * @param {string} key to search for
       * @param {bool} [alsoRemove] true to delete matched elements
       * @param {bool} [findLast] true to find last occurrence of this key
       * @return {object} matched object or null if not found
       */
      '_get': function(key, alsoRemove, findLast) {
        // set defaults on optional arguments
        if (typeof(alsoRemove) == 'undefined') {
          alsoRemove = false;
        }
        if (typeof(findLast) == 'undefined') {
          findLast = false;
        }
        // find position in array(s)
        var ref = this.find(key, findLast);
        if (debug && false) {
          console.log('get requested for key[' + key + ']');
        }
        if (ref != -1) {
          // get the object
          var obj = this.objarr[ref];
          if (alsoRemove) {
            // delete this object
            this.removeRef(ref);
            if (debug && false) {
              console.log('pulled hashTable object[' + this.render(obj) + ']');
            }
          }
          return obj;
        }
        return null;
      },

      /**
       * get the object at a certain position in the table
       * @param {int} ref position in table
       * @return {object} matched object, or null if not present
       */
      'select': function(ref) {
        if ((ref == -1) || (ref >= this.objarr.length)) {
          return null;
        }
        return this.objarr[ref];
      },

      /**
       * get the key on an object at a certain position in the table
       * @param {int} ref position in table
       * @return {mixed} key at this position in the table
       */
      'key': function(ref) {
        if ((ref == -1) || (ref >= this.objarr.length)) {
          return null;
        }
        return this.keyarr[ref];
      },

      lastEntry: null
    };
  }

  /**
   * create a specialised hashTable for visTableMajor
   */
  var createVisTable = function() {
    return $.extend(createHashTable('visTable'), {

      // FUNCTIONS

      /**
       * update coordinates stored for a range of cells
       * @param {string} direction x or y
       * @param {int} range_start seq of first cell to refresh
       * @param {int} range_end seq of last cell to refresh (inclusive)
       */
      'updateRange': function(direction, range_start, range_finish) {
        var vt = this;
        // capture initial position of last cell in range (b) to calculate delta-b
        var position_finish_pre = $img(range_finish).offset();
        // loop through cells from start to finish
        for (var i=range_start ; i<=range_finish ; ++i) {
          var $ent = $img(i);
          var position = $ent.offset();
          var ref = $ent.data('seq');
          var obj = vt.select(ref);
          if (obj == null) {
            // add object
            var obj = {
              '$ent': $ent,
              'ref': ref,
              'key': Math.floor(direction == 'x' ? position.left : position.top)
            };
            vt.push(obj);
          } else {
            // replace this key in object and key index
            vt.replaceKey(ref, obj, Math.floor(direction == 'x' ? position.left : position.top));
          }
        }
        // calculate delta-b
        var position_finish_post = $img(range_finish).offset();
        var delta_b = (direction == 'x' ? position_finish_post.left - position_finish_pre.left : position_finish_post.top - position_finish_pre.top);
        // if there's been a shift effect
        if (delta_b != 0) {
          // update all the keys after the updated range to include their new position
          vt.keyShift(range_finish+1, vt.getSize()-1, delta_b);
        }
      },

      /**
       * update coordinates stored for each cell
       * @param {string} direction x or y
       * @param {object} $cells jQuery list of cells
       */
      'updateAll': function(direction, $cells) {
        var vt = this;
        // wipe previous table altogether
        vt.wipe();
        // read in new values
        $cells.each(function() {
          var $ent = $(this);
          var position = $ent.offset();
          // create object
          var obj = {
            '$ent': $ent,
            'key': Math.floor(direction == 'x' ? position.left : position.top)
          };
          // push object into hashTable
          vt.push(obj);
        });
      },

      /**
       * inc/decrements keys within a range
       * @param  {int} range_start  array ref for start position
       * @param  {int} range_finish array ref for end position (inclusive)
       * @param  {mixed} delta        [description]
       * If keys are strings, this appends a string
       * If keys are numeric, this inc/decrements
       */
      'keyShift': function(range_start, range_finish, delta) {
        for (var i=range_start ; i<=range_finish ; ++i) {
          if (this.keyarr[i] != null) {
            this.keyarr[i] += delta;
            this.objarr[i].key += delta;
          }
        }
      },

      'lastEntry': null
    });
  }

  /** 
   * The visTableMajor is used:
   * - to store an indexed list of cell coordinates along the major axis
   */
  var visTableMajor = createVisTable();

  /** 
   * The layoutManager is used:
   * - to store an indexed list of layout methods
   */
  var layoutManager = function() {
    return $.extend(createHashTable('layoutManager'), {
      // comma-less last field
      'lastEntry': null
    });
  }();

  /** 
   * The toolManager is used:
   * - to store an indexed list of available tools
   */
  var toolManager = function() {
    return $.extend(createHashTable('toolManager'), {
      // comma-less last field
      'lastEntry': null
    });
  }();

  /**
   * create a specialised hashTable for the eventQueue
   * @return {object} hashTable object
   */
  var createEventQueue = function(outer_class) {
    return $.extend(createHashTable('eventQueue'), {

      // CONSTANTS

      // time after which scroll events expire
      TIMEOUT_expireEVENT: 10000,

      // default event object 
      'default_event_object': {
        'key': '<unset:',
        // don't replace the event handler
        'replaceEvent': null,
        // don't create a deferred
        'deferred': null,
        // has no parent
        'parent': null,
        // has no dependencies
        'deps': null,
        // has not been handled yet
        'handled': false,
        // can not be dumped if peered
        'dumpable': false,
        // has no action
        'action': function(){},
        // never expires
        'expires': null,
        // comment is an empty string (for rendering)
        'comment': '',
        // no id yet
        'idx': null
      },

      // VARIABLES

      // expiry timeout callback
      'expiry_handler': null,

      // currently executing event
      'critical_section': null,

      // and the one that just executed
      'last_critical_section': null,

      // count of dumped events
      'dump_count': 0,

      // FUNCTIONS

      /**
       * @return {string} render simple string of object
       */
      'render': function(obj) {
        if (obj == null) {
          return '<no event context>';
        }
        var output = obj.idx + ':' + obj.key + ', ' + obj.deferred.state();
        if (obj.comment) {
          output += ', ' + obj.comment;
        }
        if (obj.deps.length) {
          output += ', ' + obj.deps.length + ' deps';
        }
        return output;
      },

      /**
       * work through eventQueue looking for expired events
       */
      'checkExpiries': function() {
        if (debug) {
          console.log('checking expiries');
        }
        var obj, timenow = this.getTime();
        // note dynamic getSize() call, because list is changing during loop
        for (var i=0 ; i<this.getSize() ; ++i) {
          obj = this.objarr[i];
          if (obj.expires != null) {
            if (timenow > obj.expires) {
              if (debug) {
                console.log('expiring eventContext['+obj.key+']');
              }
              this.resolve(obj);
              // beware: resolve deletes at most 1 elements from array, so redo
              i--;
            }
          }
        }
      },

      /**
       * @return {int} time in milliseconds
       */
      'getTime': function() {
        var d = new Date;
        return d.getTime();
      },

      /**
       * push event object onto event queue
       * @param {object} partial fields to override defaults
       */
      'push': function(partial) {
        var that = this;
        // start by trying to match this key to an existing event in the queue
        var obj = null;
        if (typeof(partial.key) != 'undefined') {
          obj = this.get(partial.key);
        }
        // if we've created the object, prep and push it
        if (obj == null) {
          // compose new object ($.extend gives right to left precedence)
          var obj = $.extend({},
            // 1: statuc defaults
            this.default_event_object, {
              // 2: dynamic defaults
              'key': this.default_event_object.key + this.getCounter() + '>',
              // create new deferred, but ignore if already set in partial
              'deferred': getDeferred(),
              // set expiry
              'expires': eventQueue.getTime() + eventQueue.TIMEOUT_expireEVENT,
              'deps': []
            },
            // 3: overrides from call
            partial
          );
          // push
          var ref = this._push(obj);
          // optional debugging message
          if (debug && false) {
            console.log('+ pushed event context[' + this.render(obj) + '], qlen now '+(this.getSize()));
          }
        }
        // but if we've found an existing object matching the key
        else {
          // merge in any partial fields that we want to keep
          if (obj.comment) {
            obj.comment += ', now peered with sister [' + partial.comment + ']';
          }
          // optional debugging message
          if (debug && true) {
            console.log('+ not-pushed, found sister event context[' + this.render(obj) + '], qlen now '+(this.getSize()));
          }          
        }
        // if the object expires, schedule its removal
        if (obj.expires) {
          // clear old [eventQueue-wide] timeout
          if (that.expiry_handler != null) {
            clearTimeout(that.expiry_handler);
          }
          // schedule a [single shared eventQueue-wide] check after the timeout
          this.expiry_handler = setTimeout(function() {
            that.checkExpiries();
          }, this.TIMEOUT_expireEVENT);
        }
        // return the object (retreived or pushed)
        return obj;
      },

      /**
       * push event object or merge if a peer is set
       *   this does create issues if we try to pull based on the old key
       * @param {object} partial fields to override defaults
       */
      'pushOrMerge': function(partial, peer) {
        if (typeof(peer) == 'undefined') {
          // if no peer, push new context with partial values
          return this.push($.extend({}, partial));
        }
        // capture old position
        var ref = this.find(peer.key);
        // capture old description for debugging
        var olddesc = '';
        if (debug) {
          olddesc = this.render(peer);
        }
        // aggregate the comments to enable clearer historical tracking
        if (partial.comment) {
          partial.comment += ', was ' + peer.comment;
        }
        // merge in set fields
        $.extend(peer, partial);
        // manually update old indices
        if (ref != -1) {
          this.keyarr[ref] = peer.key
        }
        // optional debugging
        if (debug && true) {
          console.log('  - merged event context[' + this.render(peer) + '] into old context['+olddesc+'], unaffected q len now'+this.getSize());
        }
        return peer;
      },

      /**
       * push event object onto event queue and setup parenting
       * copes with 1:N parent:child relationships
       * @param {object} partial fields to override defaults
       * @param {object} parentContext 
       */
      'pushOrParent': function(partial, parent) {
        if (typeof(parent) == 'undefined') {
          // if no parent, just push the partial
          return this.push(partial);
        }
        // aggregate the comments to enable clearer historical tracking
        if (partial.comment) {
          partial.comment += ', inherited from ' + parent.comment + ' (which is now upstream)';
        }
        // push partial in normal way
        var obj = this.push(partial);
        // attach this obj as child to parent
        this.parent(obj, parent);
        return obj;
      },

      /**
       * delay s2 (parent) to follow s1 (child)
       * equivalent to setup parenting from s1 (child) to s2 (parent)
       * @param {object} obj child event context to attach to parent
       * @param {object} parentContext parent event context
       */
      'delay': function(obj, parentContext) {
        var that = this;
        if (typeof(parentContext) != 'undefined' && parentContext) {
          // attach to parent
          this.attachParent(obj, parentContext);
          // optional debugging
          if (debug && true) {
            console.log('  - delayed event context[' + this.render(obj.parent) + '] to follow resolution of context['+this.render(obj)+'], q len now '+this.getSize());
          }
        }
        return obj;
      },

      /**
       * setup parenting from s1 (child) to s2 (parent)
       * @param {object} obj child event context to attach to parent
       * @param {object} parentContext parent event context
       */
      'parent': function(obj, parentContext) {
        var that = this;
        if (typeof(parentContext) != 'undefined' && parentContext) {
          // child inherits certain parental attributes
          obj.dumpable = parentContext.dumpable;
          obj.replaceEvent = parentContext.replaceEvent;
          // attach to parent
          this.attachParent(obj, parentContext);
          // optional debugging
          if (debug && false) {
            console.log('  - placed child event context[' + this.render(obj) + '] into parent context['+this.render(obj.parent)+'], q len now '+this.getSize());
          }
        }
        // return original object, not what actually got attached to parent
        return obj;
      },

      /**
       * setup parenting from s1's earliest ancestor (child) to s2 (parent)
       * @param {object} attach_point [great][grand]child event context
       * @param {object} parentContext parent event context
       * @return {object} s1's ancestor that got attached to parent
       */
      'attachParent': function(attach_point, parentContext) {
        // if this object already had a parent
        if (attach_point.parent != null) {
          // find its earliest ancestor
          attach_point = this.earliestAncestor(attach_point);
        }
        // store parent relationship
        attach_point.parent = parentContext;
        // store child relationship
        parentContext.deps[parentContext.deps.length] = attach_point;
        return attach_point;
      },

      /**
       * @param {string} key
       * @return {string} regex pattern to match key's family
       */
      'getKeyFamily': function(key) {
        var colonPos = key.indexOf(':');
        if (colonPos != -1) {
          return key.substr(0, colonPos+1) + '.*';
        }
        return key;
      },

      /** 
       * interface function to get from table
       * @param {string} key to search for
       * @param {bool} [alsoRemove] true to delete matched elements
       * @return {object} matched object or null if not found
       */
      'get': function(key) {
        var obj = this._get(key, false);
        if (obj != null) {
          if (debug && false) {
            console.log('- pulled event context[' + this.render(obj) + '], q'+this.getSize());
          }
        } else {
          if (debug && false) {
            console.log('o unfilled get request for key[' + key + ']');
          }
        }
        return obj;
      },

      /** 
       * @param {object} partial fields to override defaults
       * @return {object} created object if fresh or matched object if found
       */
      'getOrInvent': function(partial) {
        var retrieved = null;
        if (typeof(partial.key) != 'undefined') {
          retrieved = this.get(partial.key);
        }
        // if this is a fresh event that we didn't fire
        if (retrieved == null) {
          // create object using shallow copy of defaults, then overwrite set fields
          retrieved = this.invent(partial);
          // store, which will add to unhandled list
          retrieved = this.push(retrieved);
        }
        // otherwise if we've fired (and not resolved) this event
        else {
          // aggregate the comments to enable clearer historical tracking
          if (retrieved.comment) {
            retrieved.comment += ', instead of ' + partial.comment;
          }
          if (debug && true) {
            console.log('* handler caught fired event context[' + this.render(retrieved) + '], q'+this.getSize());
          }
        }
        return retrieved;
      },

      /** 
       * invent an event context
       * @param {object} partial for context to invent
       * @return {object} created object
       */
      'invent': function(partial) {
        if (typeof(partial.key) == 'undefined') {
          partial.key = '<unset>';
        }
        // create object using shallow copy of defaults, then overwrite set fields
        var retrieved = $.extend({}, this.default_event_object, {
          'deferred': getDeferred(),
          'deps': [],
        }, partial);
        return retrieved;
      },

      /**
       * @param {object} eventContext to flag as being in its critical section
       */
      'setCriticalSection': function(eventContext) {
        var that = this;
        // setup back-to-one function for use in callbacks
        var scheduleCriticalReset = function() {
          // if nothing else has swiped it already
          if (that.critical_section == eventContext) {
            that.last_critical_section = that.critical_section;
            // flag that nothing is in its critical section
            that.critical_section = null;
          }
        };
        // remember last critical section
        that.last_critical_section = that.critical_section;
        // store eventContext as current critical section
        this.critical_section = eventContext;
        // optional debugging
        if (debug && false) {
          console.log('> entering critical section for '+this.render(this.critical_section));
        }
        this.critical_section.deferred.done(scheduleCriticalReset);
      },

      /**
       * process act-on-event decision
       * event contexts:
       *   get resolved when they've done their work (action function)
       *   get marked as handled whether they get queued or not
       * @param {object} eventContext
       * @param {function} func to call or store; this function contains its own wrapUp calls
       */
      'actOnContext': function(eventContext, func) {
        var that = this;
        // only act if we've been given a real eventContext that hasn't been handled or already begun processing
        if (eventContext == null || eventContext.handled == true || eventContext.action == null) {
          // otherwise just return a nice resolved deferred
          return getDeferred().resolve();
        }
        // flag that this context has now been through a handler
        eventContext.handled = true;
        // should we be nullifying this event
        if (eventContext.replaceEvent != null) {
          // process by calling null function then wrap up, instead of processing this event directly
          eventContext.action = function(){};
          // make sure replaceEvent function isn't used twice, if eventContext cascades to multiple events
          eventContext.replaceEvent = null;
          // optional debugging message
          if (debug && false) {
            console.log('replaceEvent used in place for '+this.render(eventContext)+', critical section left unchanged ('+this.render(this.critical_section)+')');
          }
          // call func with outer class context, then wrap up
          this.contextExecute(eventContext);
        }
        // test to see if any other event is in its critical section
        else if (this.critical_section == null) {
          // if not, flag event as in its critical section
          this.setCriticalSection(eventContext);
          // optional debugging message
          if (debug && false) {
            console.log('> entering fresh critical section (from null) for '+this.render(eventContext));
          }
          // call func with outer class context, then wrap up
          eventContext.action = func;
          this.contextExecute(eventContext);
        }
        // test to see if we're actually still in the same context (eventContext == critical_section)
        else if (eventContext.key == this.critical_section.key) {
          // we're reusing the same context, so just call and leave critical_section alone
          eventContext.action = func;
          this.contextExecute(eventContext);
        }
        // test to see if we're in the parent's context (parent eventContext == critical_section)
        else if (this.isParentOf(this.critical_section, eventContext)) {
          // call and leave critical_section alone
          eventContext.action = func;
          this.contextExecute(eventContext);
        }
        else {
          // delay func by queuing (parent on earliestAncestor), but clean chain
          eventContext.action = func
          this.contextDelayExecution(eventContext);
        }
        return eventContext.deferred;
      },

      /**
       * call function, then wrap up its context
       * @param {object} eventContext context to wrap up
       */
      'contextExecute': function(eventContext) {
        var that = this;
        var func = eventContext.action;
        var wrapUp = function() {
          that.resolve(eventContext);
        };
        if (typeof func == 'function') {
          // nullify eventContext.action so it cannot be re-called
          eventContext.action = null;
          $.when(func.call(outer_class)).always(wrapUp);
        } else {
          wrapUp();
        }
      },

      /**
       * work through ancestor chain, dump similar peers, attach this context
       * @param {object} eventContext context to attach
       */
      'contextDelayExecution': function(eventContext) {
        var that = this;
        // @deprecated remove any peers to this event from the queue first
        // this.dumpAncestors(this.getKeyFamily(eventContext.key), this.critical_section);
        // this event depends on the end of the current critical one's chain
        var lastDep = this.earliestAncestor(this.critical_section);
        // optional debugging message
        if (debug && false) {
          console.log('_ delaying critical section for '+this.render(eventContext));
        }
        // set this event up as dependent upon the lastDep (lastDep kicks eventContext)
        this.delay(lastDep, eventContext);
      },

      /**
       * work up through the parents and remove those matching key
       * @param {string} regkey regex pattern to match peers by family
       * @param {object} current root context in parent chain
       */
      'dumpAncestors': function(regkey, current) {
        var re = new RegExp(regkey, 'g');
        // start with root's parent because we don't want to dump current critial_section
        current = current.parent;
        while ((current != null) && (current.parent != null)) {
          // check to see if current is dumpable and if key matches regkey
          if (current.dumpable && (current.key.match(re) != null)) {
            // remove ancestor from parent chain; point at next in chain/null
            current = this.deleteAncestor(current);
          } else {
            // move on to next iteration
            current = current.parent;
          }
        }
      },

      /**
       * remove an ancestor from the parent chain
       * @param {object} current eventContex to remove from parent chain
       * @return {object} next eventContext in chain after deleted one, or null if none
       */
      'deleteAncestor': function(current) {
        var parent = current.parent;
        var children = current.deps;
        // tell the children initially that they no longer have a parent
        for (var i=0 ; i<children.length ; ++i) {
          children[i].parent = null;
        }
        // if there is a parent, setup each child
        if (parent != null) {
          // remove current as child of parent
          var ref = parent.deps.indexOf(current);
          if (ref != -1) {
            // delete this dep from parent
            parent.deps.splice(ref, 1);
          }
          // add children to parent
          for (var i=0 ; i<children.length ; ++i) {
            this.parent(children[i], parent);
          }
        }
        // test to see if we've seen the handler for this already
        if (current.handled) {
          // remove ancestor from eventQueue all together; 
          eventQueue.resolve(current);
        } else {
          // leave dumped event in queue to catch handler, but force expiry
          if (current.expires == null) {
            current.expires = eventQueue.getTime() + eventQueue.TIMEOUT_expireEVENT;
          }
        }
        // update count
        this.dump_count++;
        // optional debugging
        if (debug && true) {
          var logstr = 'D dumped event['+current.key+']';
          if (children.length > 0) {
            logstr += ', reparented '+children.length+' child:0['+children[0].key+']';
          }
          if (parent != null) {
            logstr += ' to parent['+parent.key+']'; 
          } else {
            logstr += ', no parent';
          }
          console.log(logstr);
        }
        // return parent, or null if there's none
        return parent;
      },

      /**
       * work up through the parents to find the oldest ancestor
       * @param {object} current
       * @return {object} earliest ancestor (end of parent chain)
       */
      'earliestAncestor': function(current) {
        while ((current != null) && (current.parent != null)) {
          current = current.parent;
        }
        return current;
      },

      /**
       * @param {object} s1 event context
       * @param {object} s2 event context
       * @return {boolean} true if s1 is a parent of s2
       */
      'isParentOf': function(s1, s2) {
        while (s2.parent != null) {
          if (s2.parent == s1) {
            return true;
          }
          // make s2 its parent and test again
          s2 = s2.parent;
        }
        return false;
      },

      /**
       * @param {object} s1 event context
       * @param {object} s2 event context
       * @return {boolean} true if s1 and s2 are the same context
       */
      'equals': function(s1, s2) {
        // for now, just compare memory pointers
        return (s1 == s2);
      },

      /**
       * @param {object} object to resolve and remove if found
       * @param {mixed} returnValue optional value to return via resolve
       * @return {object} jQuery deferred
       */
      'resolve': function(obj, returnValue) {
        if (obj != null) {
          // remove this object from the eventQueue
          var ref = this.removeObj(obj);
          if (debug && false) {
            console.log('Q resolve event context[' + this.render(obj) + '], qlen now '+this.getSize());
          }
          // resolve its deferred if set
          if (obj.deferred != null) {
            obj.deferred.resolve(returnValue);
          }
          // if object has a parent, update it
          if (obj.parent != null) {
            this.parentResolve(obj, obj.parent);
          }
        }
        // always return a resolved deferred
        return getDeferred().resolve(returnValue);
      },

      /**
       * tell parent that one of its child objects has been resolved
       * @param {object} obj child that's been resolved
       * @param {object} parentContext context to update
       */
      'parentResolve': function(obj, parentContext) {
        // remove this from parent's outstanding deps
        var ref = parentContext.deps.indexOf(obj);
        if (ref != -1) {
          // delete this dep from parent
          parentContext.deps.splice(ref, 1);
        }
        // if we've resolved all the parent's deps
        if (parentContext.deps.length == 0) {
          if (debug && false) {
            console.log('U processing next/parent context[' + this.render(obj.parent) + '], following resolution of context[' + this.render(obj) + ']');
          }
          // process parent
          this.setCriticalSection(parentContext);
          this.contextExecute(parentContext);
        }
        // flag as no longer parented
        obj.parent = null;
      },

      /**
       * @param {object} object to reject and remove if found
       * @param {mixed} returnValue optional value to return via reject
       * @return {object} jQuery deferred
       */
      'reject': function(obj, returnValue) {
        if (obj != null) {
          // remove this object from the eventQueue
          var ref = this.removeObj(obj);
          if (debug && true) {
            console.log('Q rejected event context[' + this.render(obj) + '], qlen now '+this.getSize());
          }
          // reject its deferred if set
          if (obj.deferred != null) {
            return obj.deferred.reject(returnValue);
          }
        }
        // always return a rejected deferred
        return getDeferred().reject(returnValue);
      },

      lastEntry: null
    });
  };

  /** 
   * The eventQueue is used:
   * - to stop the hashChanged listener from firing for certain hash changes
   * - to enable promises on certain event
   * - to bridge promises between fire_ and handler
   */
  var eventQueue = createEventQueue(this);

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
  var fireHashUpdate = function(options, push, eventContext) {
    var hash = '', fromHash, readback;
    // start with defaults
    var obj = getDefaults();
    // overwrite with current hash values
    fromHash = hashParse(getHash());
    merge(obj, fromHash);
    // overwrite with options
    merge(obj, options);
    // convert to hash string
    hash = hashGenerate(obj);
    // always create a context [so we can resolve something], but parent it only if eventContext is not undefined
    var localContext = eventQueue.pushOrParent({
      'key': 'hash:'+hash,
      'comment': 'localContext for fire_hashUpdate'
    }, eventContext);
    // if hash would have no effect (would not trigger handlerHashChanged)
    if (hashEquals(getHash(), hash)) {
      return eventQueue.resolve(localContext);
    } else {
      hashSetTo(hash, push);
      // @todo test; instant firing doesn't seem to save much time
      if (false) {
        // manually fire the handler instantly, even before the event trickles through
        handlerHashChanged(exp.stringHASHBANG + hash);
      }
      // localContext is resolved by handlerHashChanged
      return localContext.deferred;
    }
  };

  /**
   * change the visible portion of the page by moving the scrollbars
   * @param {object} target position
   *        {int} scrollLeft distance from left of page in pixels
   *        {int} scrollTop  distance from top of page in pixels
   * @param {object} [eventContext] optional event context for decorating an existing deferred
   * @param {int} [animate] duration of scroll animation, or 0 to pop
   * @return {object} jQuery deferred
   */
  var fireScrollUpdate = function(target, eventContext, animate) {
    var that = this;
    if (animate == undefined) {
      animate = false;
    }
    // create a context, but parent it only if eventContext is not undefined
    var localContext = eventQueue.pushOrParent({
      'key': 'scroll:'+'x='+target.scrollLeft+'&y='+target.scrollTop,
      'comment': 'localContext for fire_scrollUpdate'
    }, eventContext);
    if (debug && true) {
      console.log('* fired scroll event '+eventQueue.render(localContext));
    }
    // fire event: change the scroll position
    fireScrollBuffered(target, animate);
    // if we've yet to setup an event handler
    if (this.bindToScroll_static == undefined) {
      // manually call handler
      handlerScrolled({}, target.scrollLeft, target.scrollTop);
    } else {
      // @todo test; instant firing doesn't seem to save much time
      if (false) {
        // manually fire the handler instantly, even before the event trickles through
        handlerScrolled({}, target.scrollLeft, target.scrollTop);
      }
    }
    // localContext is resolved by handlerScrolled
    return localContext.deferred;
  };

  /**
   * animate scroll to new position, or pop if fullscreen
   * @param  {object} target {...} multiple properties to animate
   * @param  {int} animate duration of animation, or zero to pop
   */
  var fireScrollBuffered = function(target, animate) {
    if (animate > 0) {
      // for some reason can't cache this selector
      $('html, body').finish().animate(target, animate);      
    } else {
      // comes through as single event
      if (typeof(target.scrollLeft) != 'undefined') {
        $document.scrollLeft(target.scrollLeft);
      }
      if (typeof(target.scrollTop) != 'undefined') {
        $document.scrollTop(target.scrollTop);
      }
    }
  };

  /**
   * change the visible portion of the page by moving the scrollbars
   * @param {int} key to fire press event for
   * @param {object} [eventContext] optional event context for decorating an existing deferred
   * @return {object} jQuery deferred
   */
  var fireKeyPress = function(key, eventContext) {
    var e = jQuery.Event( 'keydown', { which: key } );
    var localContext = eventQueue.pushOrParent({
      'key': 'keypress:key='+key,
      'comment': 'localContext for fire_keyPress (keyToPress '+key+')'
    });
    $document.trigger(e);
    return localContext.deferred;
  };

  // -------------------------
  // FUNCTIONS: event handlers
  // -------------------------

  /**
   * apply hash state (+current values for those unset) to page
   * downstream of: EVENT hash change
   * @param {string} hash that's been updated
   * @param {boolean} forceChange true to force the handler to reapply the hash state to the DOM [default: false]
   * @return {object} jQuery Deferred
   */
  var handlerHashChanged = function(hash, forceChange) {
    var that = this;
    // apply argument defaults
    if (forceChange == undefined) {
      forceChange = false;
    }
    // get context if we created the event, invent if it was user generated
    var eventContext = eventQueue.getOrInvent({
      'key': 'hash:'+hash,
      'comment': 'invented context for handlerHashChanged'
    });
    // start with defaults
    var obj = getDefaults();
    // overwrite with current hash values
    var fromHash = hashParse(hash);
    // check the hash values are valid, fallback to defaults if not
    if (!hashValidate(fromHash)) {
      console.log('illegal hash values, falling back to defaults');
    }
    merge(obj, fromHash);
    // update previous values if changed
    var cdirection = getDirection(), cbreadth = getBreadth(), cseq = getSeq(), coffseq = getOffseq(), ctheme = getTheme();
    if (cdirection != obj.direction) {
      state_previous['direction'] = cdirection;
    }
    if (cbreadth != obj.breadth) {
      state_previous['breadth'] = cbreadth;
    }
    if (cseq != obj.seq) {
      state_previous['seq'] = cseq;
    }
    if (coffseq != obj.offseq) {
      state_previous['offseq'] = coffseq;
    }
    if (ctheme != obj.theme) {
      state_previous['theme'] = ctheme;
    }
    // stage 1: apply [hash] state to DOM
    // direction changes potentially affect all images
    var directionChanged = setDirection(obj.direction);
    // breadth changes potentially affect all images
    var breadthChanged = setBreadth(obj.breadth);
    // seq changes at most only affect the image being selected
    var seqChanged = setSeq(obj.seq);
    // seqoffset changes at most only affect the images being viewed
    var offseqChanged = setOffseq(obj.offseq);
    // theme changes should affect no images
    var themeChanged = setTheme(obj.theme);
    // updates based on certain types of change
    if (breadthChanged || directionChanged || offseqChanged || forceChange) {
      refreshDynamicMajors(getBreadth(), getDirection());
      // clear cell-specific dimensions and read back positions
      cellsClear();
      visTableMajor.updateAll(getDirection(), $sfun_selectablecell);
    }
    // find out if we should trigger other events based on this hash change
    return eventQueue.actOnContext(eventContext, function(){
      // update images based on what changed
      if (seqChanged || offseqChanged || breadthChanged || directionChanged || forceChange) {
        // scroll to the selected image, which triggers refresh on all .visible images
        return envisionSeq(obj.seq, obj.offseq, eventContext);
      }
    });
  }

  /**
   * process or buffer events generated by window scrolling
   * @return {object} jQuery deferred
   * downstream of: EVENT scroll
   */
  var handlerScrolled = function(event, sx, sy) {
    var that = this;
    var key = 'scroll:'+'x='+sx+'&y='+sy;
    var eventContext = eventQueue.get(key);
    // if this is a fresh event that we didn't fire
    if (eventContext == null) {
      // don't process scroll event every time, buffer unless there's a context
      buffer('handlerScrolled_event',
      // function to execute if/when we are processing this event
      function() {
        // get context if we created the event, invent if it was user generated
        eventContext = eventQueue.getOrInvent({
          'key': key,
          // [browser-generated] scroll events can be dumped (superceded)
          // but if they come from fireScrollUpdate (with their own context)
          // that context may not be dumpable
          'dumpable': true,
          'comment': 'invented context for handlerScrolled'
        });
        // process this event if we're meant to
        return eventQueue.actOnContext(eventContext, function() {
          return handlerScrolled_eventProcess(event, sx, sy);
        });
      },
      // function to execute if we're dumping this event
      function(){}, 50);
    } else {
      // process this event if we're meant to as we originated it
      return eventQueue.actOnContext(eventContext, function() {
        return handlerScrolled_eventProcess(event, sx, sy);
      });
    }
  }

  /**
   * actually process the events
   * @return {object} jQuery deferred
   * downstream of: EVENT scroll
   */
  var handlerScrolled_eventProcess = function(event, sx, sy) {
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
    if (debug && false) {
      console.log('scroll dx[' + event.deltaX + '] dy[' + event.deltaY + '] factor[' + event.deltaFactor + ']');
    }
    // see if scroll has made any new images visible
    var scrolldir = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? 0 - event.deltaX : 0 - event.deltaY);
    return refreshVisibility(scrolldir);
  };

  /**
   * process events generated by key presses
   * downstream of: EVENT key pressed
   * @return {object} jQuery deferred
   */
  var handlerKeyPressed = function(event) {
    var that = this;
    // create an event context for this handler, or use stored one
    var eventContext = eventQueue.getOrInvent({
      'key': 'keypress:'+'key='+event.which,
      'comment': 'invented context for handlerKeyPressed'
    });
    // optional debugging information
    if (debug && false) {
      console.log('keydown event code['+event.which+']');
    }
    return eventQueue.actOnContext(eventContext, function() {
      // process key press
      switch (event.which) {

        // directory navigation
        case exp.KEY_ARROW_UP:
          if (event.altKey) {
            event.preventDefault();
            urlChangeUp();
          }
          break;

        // single image changes
        case exp.KEY_ARROW_LEFT:
          if (!event.altKey) {
            event.preventDefault();
            // advance to previous image
            return imageAdvanceBy(-1, eventContext);
          }
          break;
        case exp.KEY_ARROW_RIGHT:
        case exp.KEY_TAB:
        case exp.KEY_ARROW_DOWN:
          // advance to next image
          event.preventDefault();
          return imageAdvanceBy(1, eventContext);

        // page-wise navigation
        case exp.KEY_PAGE_UP:
        case exp.KEY_PAGE_DOWN:
          if (!event.ctrlKey) {
            event.preventDefault();
            // get cell count and round down
            var cellcount = getCellMajorCount(-1);
            var cellmajor = getCellMajor();
            // always animate
            eventContext.animate = exp.implicitScrollDURATION;
            // apply position change as relative offset
            var pagedir = (event.which == exp.KEY_PAGE_DOWN ? +1 : -1);
            // envisionPos() using relative offset
            if (getDirection() == 'x') {
              return envisionPos( {'scrollLeft': pagedir * cellcount * cellmajor }, eventContext, true);
            } else {
              return envisionPos( {'scrollTop': pagedir * cellcount * cellmajor }, eventContext, true);
            }
          }
          break;
        case exp.KEY_HOME:
          event.preventDefault();
          return imageAdvanceTo(0, eventContext);
        case exp.KEY_END:
          event.preventDefault();
          return imageAdvanceTo(getTotalEntries()-1, eventContext);
        case exp.KEY_RETURN:
          event.preventDefault();
          return imageToggleFullscreen(getSeq(), eventContext);

        // change breadth
        case exp.KEY_NUMBER_1:
          event.preventDefault();
          return fireHashUpdate( { 'breadth': 1 }, false, eventContext);
        case exp.KEY_NUMBER_2:
          event.preventDefault();
          return fireHashUpdate( { 'breadth': 2 }, false, eventContext);
        case exp.KEY_NUMBER_4:
          event.preventDefault();
          return fireHashUpdate( { 'breadth': 4 }, false, eventContext);
        case exp.KEY_NUMBER_8:
          event.preventDefault();
          return fireHashUpdate( { 'breadth': 8 }, false, eventContext);

        // plus and minus effectively zoom in and out using breadth
        case exp.KEY_PLUS:
        case exp.KEY_EQUALS:
          event.preventDefault();
          return fireHashUpdate( { 'breadth': getBreadthNext(getBreadth(), -1) }, false, eventContext);
        case exp.KEY_MINUS:
        case exp.KEY_UNDERSCORE:
          event.preventDefault();
          return fireHashUpdate( { 'breadth': getBreadthNext(getBreadth(), +1) }, false, eventContext);

        // change between horizontal and vertical
        case exp.KEY_H_UPPER:
        case exp.KEY_H_LOWER:
          event.preventDefault();
          var offseq = imageCentreOffseq('x');
          return fireHashUpdate( { 'direction': 'x', 'offseq': offseq }, false, eventContext);
        case exp.KEY_V_UPPER:
        case exp.KEY_V_LOWER:
          event.preventDefault();
          var offseq = imageCentreOffseq('y');
          return fireHashUpdate( { 'direction': 'y', 'offseq': offseq }, false, eventContext);
      }
    });
  };

  /**
   * process events generated by mouse wheel scrolling
   * mouseWheeled is a dumb event; we never fire it, so it doesn't have a context
   * downstream of: EVENT mouse wheeled
   */
  var handlerMouseWheeled = function(event) {
    var that = this;
    // work out what direction we're applying this mouse-wheel scroll to
    var direction = getDirection();
    var breadth = getBreadth();
    // scroll direction goes against change in Y (for both x and y directions)
    var scrolldir = 0 - event.deltaY;
    // get current scroll position
    var rounding = getGutter()+1;
    var next_pos, current_pos = (direction == 'x' ? $document.scrollLeft() : $document.scrollTop());
    // active mousewheel reaction is dependent on which direction we're flowing in
    if (imagesnap) {
      // calculate how many minor axis cells
      var advance_by = (scrolldir > 0 ? 1 : -1) * getBreadth();
      // find first spanning min boundary
      var current_ref = visTableMajor.findCompare(current_pos, exp.compareGTE, false);
      var next_ref = (current_ref + advance_by) % visTableMajor.getSize();
      next_pos = visTableMajor.key(next_ref);
      // increment next_pos by existing offseq
      var offseq = getOffseq();
      console.log(next_pos + ' + ' + offseq + ' = ' + (next_pos+offseq));
      next_pos -= offseq;
      // put into target object then crop against viewport
      var target = {};
      target[(direction == 'x' ? 'scrollLeft' : 'scrollTop')] = next_pos;
      fireScrollBuffered(cropScrollPositionAgainstViewport(target), exp.implicitScrollDURATION);
      event.preventDefault();
    } else {
      // if not snapping to images
      if (direction == 'x') {
        // use both axes to scroll along X
        next_pos = current_pos + (0 - event.deltaY) + event.deltaX;
        fireScrollBuffered( { 'scrollLeft': next_pos }, (likely_fluidScroll ? 0 : exp.implicitScrollDURATION));
        event.preventDefault();
      }
    }
    // optional debugging
    if (debug && true) {
      console.log('wheel dx[' + event.deltaX + '] dy[' + event.deltaY + '] factor[' + event.deltaFactor + ']');
    }
  };

  /**
   * process a click on an image
   * @param {object} $ent jQuery object
   * @param {string} selector (type.class) for the click target
   * @return {boolean} true if we processed the click (preventDefault)
   */
  var handlerImageClicked = function($ent, selector) {
    var seq = $ent.data('seq');
    switch (selector) {
      case 'input':
      case 'textarea':
        // leave form elements alone
        break;
      case 'span.editable':
        // if editing, a click elsewhere terminates the edit
        if (editing_metadata !== false) {
          imageTeardownEdit(editing_metadata);
        }
        // setup edit
        imageSetupEdit(seq);
        break;
      default:
        // if editing, a click elsewhere terminates the edit
        if (editing_metadata) {
          imageTeardownEdit(editing_metadata);
        }
        // select image, then toggle
        imageToggleFullscreen(seq);
        break;
    }
    if (debug && false) {
      console.log('bindToImageLinks click event on selector['+selector+']');
    }
    return true;
  };

  // ------------------
  // FUNCTIONS: helpers
  // ------------------

  /**
   * substitute values into a mustache template
   * @param {string} template in mustache format
   * @param {object} view collection of values to substitute
   * @return {string} output after substitution
   */
  var substitute = function(template, view) {
    var output = Mustache.render(template, view);
    return output;
  }

  /**
   * merge into obj1
   * overwrites obj1's values with obj2's and adds obj2's if non existent in obj1
   * @param obj1
   * @param obj2
   */
  var merge = function(obj1, obj2){
    for (var attrname in obj2) {
      obj1[attrname] = obj2[attrname];
    }
  }

  /**
   * buffer a frequently firing event
   * @param {string} name of buffer
   * @param {function} successCallback to call if we're executing this event
   * @param {function} dropCallback to call if we're dropping this event
   * @param {int} timeout in milliseconds, needs to be about 200ms for normal dragging
   */
  var buffer = function(name, successCallback, dropCallback, timeout) {
    // option to disable buffer
    var disabled = false;
    if (disabled) {
      return successCallback();
    }
    // reschedule is important when dragging, because the events come thick and fast
    var reschedule = true;
    if (typeof(this[name]) != 'undefined' && this[name]) {
      if (reschedule) {
        // timeout pending, delay it
        clearTimeout(this[name]);
        // reschedule it
        this[name] = setTimeout(this[name+'__function'], timeout);      
      }
      // drop current
      dropCallback();
    } else {
      // save callback function in case it needs rescheduling
      this[name+'__function'] = function() {
        successCallback();
        this[name] = null;
        this[name+'__function'] = null;
      };
      // schedule timeout
      this[name] = setTimeout(this[name+'__function'], timeout);
    }
  }

  /**
   * @param {jQuery} $entity the cell
   * @param {bool} True to include partially visible cells
   * @return {bool} True if this image is currently visible in the viewport
   */
  var isVisible = function($ent, partial) {
    if ($ent.hasClass('visible')) return true;
    if (partial && $ent.hasClass('vispart')) return true;
    return false;
  }

  /**
   * @param string
   *          to search within
   * @param string
   *          to search for
   * @return true if the haystack ends with the needle
   */
  var endswith = function(haystack, needle) {
    // roll on ECMAScript 6
    return haystack.indexOf(needle, haystack.length - needle.length) !== -1;
  }

  /**
   * strip any of the characters used in the stringHASHBANG from the start of the hash
   * @param {string} hash to strip
   * @return {string} stripped output
   */
  var stripBang = function(hash) {
    var output;
    // re = new RegExp('/^['+exp.stringHASHBANG+']*/','g');
    var re = new RegExp('^['+exp.stringHASHBANG+']','g');
    output = hash.replace(re,'');
    return output;
  }

  /**
   * @return {string} browser's hash without whatever stringHASHBANG we're using
   */
  var getHash = function() {
    return stripBang(History.getHash());
  }

  /**
   * @return {string} browser's hash minus a few attributes
   */
  var getFilteredHash = function() {
    return getHash();
  }

  /**
   * create a CSS class dynamically
   * http://stackoverflow.com/questions/1720320/how-to-dynamically-create-css-class-in-javascript-and-apply
   * @param  {string} selector e.g. '.classname'
   * @param  {string} style
   */
  var createCSSSelector = function(selector, style) {
    if(!document.styleSheets) {
      return null;
    }

    if(document.getElementsByTagName("head").length == 0) {
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
        } else
        if (mediaType == "object") {
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
    } else
    if (mediaType == "object") {
      for (var i = 0; i < styleSheet.cssRules.length; i++) {
        if (styleSheet.cssRules[i].selectorText && styleSheet.cssRules[i].selectorText.toLowerCase() == selector.toLowerCase()) {
          styleSheet.cssRules[i].style.cssText = style;
          return;
        }
      }
      styleSheet.insertRule(selector + "{" + style + "}", styleSheet.cssRules.length);
    }
  }

  /**
   * put cursor at the end of an input field
   * based on http://css-tricks.com/snippets/jquery/move-cursor-to-end-of-textarea-or-input/
   * @param {object} $field jQuery field
   */
  var fieldPutCursorAtEnd = function($field) {
    var element = $field[0];
    $field.focus();
    // use setSelectionRange if it exists (not in IE)
    if (element.setSelectionRange) {
      // double the length because Opera is inconsistent about whether a carriage return is one character or two
      var len = $field.val().length * 2;
      element.setSelectionRange(len, len);
    } else {
      // otherwise replace the contents with itself
      $field.val($field.val());
    }
  };

  // ---------------------
  // FUNCTIONS: deprecated
  // ---------------------

  // -----------------
  // FUNCTIONS: External API
  // -----------------

  var exp = {
    // queue function calls until document ready
    'q': [],

    /**
     * execute a function
     * @param {string} name function name
     * @param {[type]} obj  function arguments
     */
    'push': function(name, obj) {
      if (this.q == null) {
        // execute function immediately
      } else {
        // push function and call later
        this.q.push({ 'name': name, 'obj': obj });
      }
    },

    /**
     * execute contents of queue
     */
    'flush': function() {
      for (var i=0 ; i<this.q.length ; ++i) {
        // call queued function
        this['api_'+this.q[i].name](this.q[i].obj);
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
    compareGTE: 1,
    compareLTE: -1,

    /**
     * add a button to the header
     * @param {object} obj arguments
     */
    'api_headerAddButton': function(obj) {
      var output = substitute(obj.template, obj.view);
      // attach output to header
      $('.header').append(output);
      // allow element to bind its handlers
      obj.callback.call(obj.context, obj);
    },

    /**
     * register a layout engine
     * @param {object} obj arguments
     */
    'api_registerLayout': function(obj) {
      layoutManager.push(obj);
      // allow element to bind its handlers
      obj.callback.call(obj.context);
    },

    /**
     * register a tool
     * @param {object} obj arguments
     */
    'api_registerTool': function(obj) {
      toolManager.push(obj);
      // allow element to bind its handlers
      obj.callback.call(obj.context);
    },

    /**
     * jQuery selector caching
     * @param {string} seq
     * @return {object} cached jQuery object
     */
    'api_$img': function(seq) {
      return $img(seq);
    },

    /**
     * ingest default values
     * @param {obj} list list of defaults
     */
    'api_setDefaults': function(list) {
      for (var key in list) {
        state_default[key] = list[key];
      }
    },

    /**
     * @param {string} regkey key as regular expression
     * @param {boolean} wait for context if it doesn't exist
     * @return {object} eventContext.deferred if found, a resolved deferred if not
     */
    'api_bindToContext': function(regkey, wait) {
      // find last matching key
      var ref = eventQueue.findRegex(regkey, true);
      if (ref == -1) {
        return getDeferred().resolve();
      }
      var context = eventQueue.select(ref);
      if (context == null) {
        if (wait) {
          // create an eventContext ahead of the event we're waiting for
          var context = eventQueue.push({
            'key': regkey,
            'comment': 'localContext for api_bindToContext key['+regkey+']'
          });
        } else {
          // if not waiting, just return a resolved deferred
          return getDeferred().resolve();
        }
      }
      return context.deferred;
    },

    /**
     * @return {object} jQuery object for cell
     */
    'api_getCell': function(seq) {
      return $img(seq);
    },

    /**
     * @return {int} Width of alley in pixels
     */
    'api_getAlley': function() {
      return getAlley();
    },

    /**
     * @return {int} Width of gutter in pixels
     */
    'api_getGutter': function() {
      return getGutter();
    },

    /**
     * @return {string} direction of current view
     */
    'api_getDirection': function() {
      return getDirection();
    },

    /**
     * @return {int} breadth of current view
     */
    'api_getBreadth': function() {
      return getBreadth();
    },

    /**
     * @return {int} currently selected entity
     */
    'api_getSeq': function() {
      return getSeq();
    },

    /**
     * @return {int} return viewport width/height
     */
    'api_getViewportWidth': function() {
      return getViewportWidth();
    },
    'api_getViewportHeight': function() {
      return getViewportHeight();
    },

    /**
     * @return {object} jQuery object for sfun layout root
     */
    'api_getLayoutRoot': function() {
      return $sfun_flow;
    },

    /**
     * @return {int} total number of entries
     */
    'api_getTotalEntries': function() {
      return getTotalEntries();
    },

    /**
     * @param {int} round non-zero to round to the nearest whole cell
     *   negative to round down, positive to round up
     * @return {float} number of cells on the major axis
     */
    'api_getCellMajorCount': function(round) {
      return getCellMajorCount(round);
    },

    /**
     * @return {object} visibility table for major axis
     */
    'api_getVisTableMajor': function() {
      return visTableMajor;
    },

    /**
     * @return {object} event queue
     */
    'api_getEventQueue': function() {
      return eventQueue;
    },

    /**
     * @return {int} last thumb's longest edge
     */
    'api_getLastLongest': function() {
      return last_longest;
    },

    /**
     * @param {object} $ent cell to check (and re-set) bounds for
     */
    'api_setBound': function($ent) {
      return setBound($ent, true);
    },

    /**
     * @param {int} value to set for thumb's longest edge
     */
    'api_setLastLongest': function(llong) {
      last_longest = llong;
    },

    /**
     * @param {object} jQuery cell to load contained images
     * @return {object} jQuery deferred
     */
    'api_waitLoadCell': function($cell) {
      var recurse = false;
      return waitLoadedGetResolution($cell, recurse);
    },

    /**
     * trigger a click and allow caller to bind to its context
     * @param {object} $ent jQuery entity to click
     * @return {object} jQuery deferred
     */
    'api_triggerClick': function($ent) {
      $ent.trigger('click');
      // get earliest context for current [post-click] hash
      var context = eventQueue.get(getHash());
      if (context == null) {
        return getDeferred().resolve();
      }
      return context.deferred;
    },

    /**
     * helper function to make testing key presses easier
     */
    'api_triggerKeypress': function(key) {
      return fireKeyPress(key);
    },

    /**
     * fire scroll update
     * @param {object} pos  {scrollLeft, scrollTop} new scroll coordinate
     * @param {boolean} numb true to numb listener
     * @return {object} jQuery deferred
     */
    'api_triggerScroll': function(pos, numb) {
      if (numb == undefined) {
        numb = false;
      }
      if (numb) {
        // create a null context to numb the event listener
        var localContext = eventQueue.push({
          'replaceEvent': true,
          'comment': 'localContext for api_triggerScroll, numb listener'
        });
        return envisionPos(pos, localContext);
      }
      return envisionPos(pos);
    },
 
    /**
     * jump to a specific image
     * @param {int} seq image to advance to
     */
    'api_imageAdvanceTo': function(seq) {
      return imageAdvanceTo(seq);
    },

    /**
     * @return {real} mod function that works with negative numbers
     */
    'api_negative_mod': function(x, m) {
      if (x < 0) return (x+m);
      return x % m;
    },

    /** 
     * @param {real} k value to round
     * @param {int} dp number of decimal places to round to (0 by default)
     * @return {real} number rounded to dp
     */
    'api_round': function(k, dp) {
      if (dp == undefined) {
        dp = 0;
      }
      var scalar = Math.pow(10, dp);
      return Math.round(k * scalar) / scalar;
    },

    // Test suite support functions

    /**
     * @return {object} visibility table for major axis
     */
    'api_createVisTable': function() {
      return createVisTable();
    },

    // no comma on last entry
    lastEntry: true
  };

  // call init function then return API object
  init();
  return exp;

})(jQuery, undefined);