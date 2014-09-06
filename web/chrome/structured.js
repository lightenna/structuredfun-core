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

/**
 * StructuredFun javascript
 */
window.sfun = (function($, undefined) {

  // ---------
  // POLYFILLS
  // ---------

  // jQuery selector refresh
  $.fn.refresh = function() {
      return $(this.selector);
  };

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
  // last image maxlongest, to shortcut reres using thumb size
  var last_max_longest = null;

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

  // jQuery selector caching
  var $img = function(seq) {
    // if we haven't yet cached the selector, or the last time it didn't exist
    if ($sfun_selectablecell_img[seq] == undefined || !$sfun_selectablecell_img[seq].length) {
      $sfun_selectablecell_img[seq] = $('#seq-'+seq);
    }
    // return cached jQuery object
    return $sfun_selectablecell_img[seq];
  }

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
        // render Mustache templates
        $sfun_selectablecell.find('img').each(function() {
          var template = $(this).data('template-src');
          if (template != undefined) {
            Mustache.parse(template);
          }
        });
        // process state in page HTML next
        state_previous['direction'] = state_default['direction'] = getDirection();
        state_previous['breadth'] = state_default['breadth'] = getBreadth();
        state_previous['seq'] = state_default['seq'] = 0;
        state_previous['offseq'] = state_default['offseq'] = 0;
        // bind to page
        bindToHeaderLinks();
        bindToHotKeys();
        bindToImageLinks();
        // if we're sideways scrolling, bind to scroll event
        setDirection(getDirection());
        // update vistable
        visTableMajor.updateAll(getDirection(), $sfun_selectablecell);
        // execute queue of API calls
        exp.flush();
        // process state if set in URL (hash) first
        handlerHashChanged(getHash(), true);
        // don't bind to event handlers until we've started the initial hash (in its critical section)
        bindToHashChange();
        bindToScroll();
        // attach listener to window for resize (rare, but should update)
        $window.resize(function() {
          buffer('init_resized',
          // process event
          function() {
            // flush cache
            getViewportWidth(true);
            getViewportHeight(true);
            // resize may have shown more images, so refresh visibility
            refreshVisibility(0);          
          },
          // do nothing if dumped
          function(){},
          50); // 50ms
        });

        // DELETE ME
        // dirty test to shortcut suite
        var k = that;
        $('.header').append('<p><a id="endkey" class="endkey" href="">Endkey</a></p>');
        $('.endkey').click(function(event) {
          event.preventDefault();
          exp.api_triggerKeypress(exp.KEY_END).done(function() {
            alert('key press returned');
          });
        });

      });
    }
  };

  // ----------------
  // FUNCTIONS: cells
  // ----------------

  /**
   * @todo this currently assume that every cell is the same width on the major axis
   * @return {float} number of cells along the major axis
   */
  var getCountMajor = function() {
    return 4;
  };

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
      var $loadable = $ent.find('.loadable');
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
      // when layoutManager completes a resize, capture cell boundaries
      // @todo restrict update to range.first_1 to range.last_n
      visTableMajor.updateAll(getDirection(), $sfun_selectablecell);
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
    var $loadable = $ent.find('> .container > .loadable');
    if ($loadable.length) {
      // load thumbnail by swapping in src, if src not already set [async]
      var attr = $loadable.attr('src');
      if (typeof attr === 'undefined' || attr === false) {
        // if we have already reres'd another image, use its size instead of the default thumbnail size
        if ((last_max_longest != null) && $loadable.hasClass('reresable')) {
          var highres = substitute($loadable.data('template-src'), { 'maxwidth': last_max_longest, 'maxheight': last_max_longest } );
          $loadable.attr('src', highres);
        } else {
          // otherwise just use desrc
          $loadable.attr('src', $loadable.data('desrc'));          
        }
      }
    }
    // optionally recurse on sub-cells
    if (recurse) {
      $ent.find('.subcell').each(function() {
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
    var $boundable = $ent.find('.loadable');
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
    var $reresable = $ent.find('.reresable');
    var $metric = $ent.find('.imgmetric');
    var perc;
    if ($metric.length && $reresable.length) {
      var width_current = $reresable.width(), height_current = $reresable.height();
      var width_native = $reresable.data('native-width'), height_native = $reresable.data('native-height');
      // calculate percentage based on image area, or width
      // perc = Math.round((width_current * height_current) * 100 / (width_native * height_native));
      perc = Math.round(width_current * 100 / width_native);
      if (debug && false) {
        // show the size of the image that's been loaded into this img container
        $metric.find('span.width').html(Math.round($reresable.data('loaded-width')));
        $metric.find('span.height').html(Math.round($reresable.data('loaded-height')));
        $metric.find('span.size').show();
      } else {
        // update with current image width and height
        $metric.find('span.width').html(Math.round(width_current));
        $metric.find('span.height').html(Math.round(height_current));
      }
      if (!isNaN(perc)) {
        $metric.find('span.perc').html(perc+'%').show();
      }
      // analyse to see if we're over/under the native res
      if (width_current > width_native || height_current > height_native) {
        $metric.removeClass('super').addClass('sub');
      } else {
        $metric.removeClass('sub').addClass('super');          
      }
    }
  };

  /**
   * check that the image metric is in the right place
   */
  var refreshMetricPosition = function($ent) {
    var $metric = $ent.find('.imgmetric');
    if ($metric.length) {
      var $image = $ent.find('.reresable');
      if ($image.length) {
        var position = $image.offset();
        // move the metric to the corner of the image using absolute coords
        $metric.css( { 'top': position.top, 'left': position.left });
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
      if ($ent.length) {
        // create and resolve a local context to allow us to numb listener
        var localContext = eventQueue.push({
          'key': 'selected:seq='+$ent.data('seq'),
          'comment': 'localContext for refreshSelected (image-'+$ent.data('seq')+')',
          'replaceEvent': true
        });
        // use hash to select new and deselect old, but numb listener and parent deferred
        return imageAdvanceTo($ent.data('seq'), localContext);
      }
    }
    return getDeferred().resolve();
  };

  /**
   * Check the display resolution of the image and swap out src if higher res available 
   * @return {object} jQuery deferred
   */
  var refreshResolution = function($ent) {
    var that = this;
    var $reresable = $ent.find('.reresable');
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
            last_max_longest = brackWidth;
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
            last_max_longest = brackHeight;
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
   * @return {object} jQuery deferred
   */
  var refreshMetadata = function($ent) {
    var that = this;
    var $reresable = $ent.find('.reresable');
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
            // if we get a response, set the missing metadata to the image
            $reresable.data('native-width', data.meta.width);
            $reresable.data('native-height', data.meta.height);
            if (debug && false) {
              console.log('image-'+$ent.data('seq')+': received native width['+$reresable.data('native-width')+'] height['+$reresable.data('native-height')+']');
            }
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
   * @param {object} $ent jQuery entity
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
    return refreshAnImageSet($(container_selector+' .selectablecell.visnear'), (last_max_longest == null));
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
            defs.push(refreshImageResolution($(this), true));
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
        handlerScrolled(event);
        event.preventDefault();
      });
      $window.mousewheel(function(event) {
        handlerMouseWheeled(event);
      });
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
      $html.removeClass('theme-dark');
      event.preventDefault();
    });
    $('#theme-dark').click(function(event) {
      $html.addClass('theme-dark');
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
   */
  var bindToImageLinks = function() {
    var that = this;
    // bind to click using delegated event handler (http://api.jQuery.com/on/), instead of individual N handlers
    $sfun.on('click', '.selectablecell a.media-container', function(event) {
      // select image, then toggle
      var seq = $(this).parents('.selectablecell').data('seq');
      imageToggleFullscreen(seq);
      event.preventDefault();
    });
  };

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
    var $loadable = $ent.find('> .container > .loadable');
    if ($loadable.length) {
      var principalDeferred = getDeferred();
      defs.push(principalDeferred);
      // update loaded resolution
      var im = new Image();
      im.onload = function() {
        $loadable.data('loaded-width', im.width);
        $loadable.data('loaded-height', im.height);
        // never update the ratio, but set if unset
        if ($loadable.data('ratio') == undefined) {
          $loadable.data('ratio', im.width / im.height);
        }
        // if we've loaded the image for the first time, swap it in (fallback)
        if ($loadable.attr('src') == undefined) {
          $loadable.attr('src', im.src);
        }
        im = null;
        if (debug && false) {
          console.log('image-'+$ent.data('seq')+': loaded resolution updated ['+$loadable.data('loaded-width')+','+$loadable.data('loaded-height')+']');
        }
        // notify promise of resolution
        principalDeferred.resolve();
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
      $ent.find('.subcell').each(function() {
        defs.push(waitLoadedGetResolution($(this), false));
      });
    }
    // wait for all deps to be resolved (includes principal)
    $.when.apply($, defs).done(wrapUp);
    return deferred;
  };

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
   * get cell size for first cell
   * @return {float} current size of cell along the major axis
   */
  var getCellSize = function() {
    if (getDirection() == 'x') {
      return $sfun_selectablecell_first.width();
    } else {
      return $sfun_selectablecell_first.height();
    }
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
    return { 'direction': state_default['direction'], 'breadth': state_default['breadth'], 'seq': state_default['seq'], 'offseq': state_default['offseq'] };
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
    }
    $sfun_flow.addClass('flow-' + breadth);
    return changed;
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
  }

  /**
   * set bounds for a cell
   * @param {object} $ent jQuery entity
   * @param {boolean} recurse true to recurse on subcells
   */
  var setBound = function($ent, recurse) {
    var that = this;
    var $boundable = $ent.find('> .container > .boundable');
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
      $ent.find('.subcell').each(function() {
        // only do 1 level of recursion
        setBound($(this), false);
      });
    }
  }

  /**
   * @param {object} target position
   *        {int} left distance from left of page in pixels
   *        {int} top  distance from top of page in pixels
   * @return {object} target position cropped against viewport
   */
  var cropScrollPositionAgainstViewport = function(target) {
    return {
      'left': exp.api_round(Math.max(0, Math.min(target.left, $document.width() - getViewportWidth())), 0),
      'top': exp.api_round(Math.max(0, Math.min(target.top, $document.height() - getViewportHeight())), 0)
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
      var target = { 'left': (direction == 'x' ? position.left - offseq : 0), 'top': (direction == 'x' ? 0 : position.top - offseq) };
      // pass target to shared function
      return envisionPos(target, eventContext);
    }
    return getDeferred().resolve();
  };

  /** 
   * ensure that a given target position lies within the current viewport
   * @param {object} target {left, top} position in pixels
   * @param {object} [eventContext] optional event context to attach this to
   * @return {object} jQuery deferred
   */
  var envisionPos = function(target, eventContext) {
    var direction = getDirection();
    // crop the target position against reachable bounds
    target = cropScrollPositionAgainstViewport(target);
    // work out whether we're currently at the target position
    var fireScroll = false;
    var scroll = { 'top': $document.scrollTop(), 'left': $document.scrollLeft() };
    // check to see if our current scroll position reflects the target position
    if (direction == 'x') {
      if (target.left != scroll.left) {
        fireScroll = true;
      }
    } else {
      if (target.top != scroll.top) {
        fireScroll = true;
      }
    }
    // if we are at the position, just refresh visibilty
    if (!fireScroll) {
      return refreshVisibility(0);
    }
    // otherwise scroll to the target position
    return fireScrollUpdate(target, eventContext);
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
    var reach = getBreadth() * exp.breadthMULTIPLIER;
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
    var $reresable = $ent.find('.reresable');
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
        if ($reresable.data('ratio') == undefined) {
          $reresable.data('ratio', this.width / this.height);
        }
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
    // update using hash change
    return fireHashUpdate( { 'seq': seq }, false, eventContext);
  };

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
        // toggle using hash change
        if (getBreadth() == 1) {
          return fireHashUpdate( { 'breadth': state_previous['breadth'], 'seq': seq }, false, eventContext);
        } else {
          return fireHashUpdate( { 'breadth': 1, 'seq': seq }, false, eventContext);
        }
        break;
      case 'directory':
        var $clickable = $ent.find('.clickable');
        if ($clickable.length) {
          window.location = $clickable.attr('href');
        }
        break;
    }
    return eventQueue.resolve(eventContext);
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

  // ---------------
  // FUNCTIONS: hash
  // ---------------

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
      // strip leading #! if set
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
        // binary search
        var minRef = 0;
        var maxRef = this.getSize() - 1;
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
       * update coordinates stored for each cell
       * @param {string} direction x or y
       * @param {object} $sfun_selectablecell jQuery list of cells
       */
      'updateAll': function(direction, $sfun_selectablecell) {
        var vt = this;
        // wipe previous table
        vt.wipe();
        // read in new values
        $sfun_selectablecell.each(function() {
          var $ent = $(this);
          var position = $ent.offset();
          // create object
          var obj = {
            '$ent': $ent,
            'key': (direction == 'x' ? position.left : position.top)
          };
          // push object into hashTable
          vt.push(obj);
        });
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
      // FUNCTIONS
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

      // reference to outer class
      sfun: outer_class,

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
          partial);
        // if the object expires, schedule its removal
        if (obj.expires) {
          // clear old timeout
          if (that.expiry_handler != null) {
            clearTimeout(that.expiry_handler);
          }
          // schedule a check after the timeout
          this.expiry_handler = setTimeout(function() {
            that.checkExpiries();
          }, this.TIMEOUT_expireEVENT);
        }
        // push
        var ref = this._push(obj);
        // optional debugging message
        if (debug && true) {
          console.log('+ pushed event context[' + this.render(obj) + '], qlen now '+(this.getSize()));
        }
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
        return this.parent(obj, parent);
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
          // store parent relationship (bidirectionally)
          obj.parent = parentContext;
          parentContext.deps[parentContext.deps.length] = obj;
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
          // store parent relationship (bidirectionally)
          obj.parent = parentContext;
          parentContext.deps[parentContext.deps.length] = obj;
          // child inherits certain parental attributes
          obj.replaceEvent = parentContext.replaceEvent;
          // optional debugging
          if (debug && true) {
            console.log('  - placed child event context[' + this.render(obj) + '] into parent context['+this.render(obj.parent)+'], q len now '+this.getSize());
          }
        }
        return obj;
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
          if (debug && true) {
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
            // flag that nothing is in its critical section
            that.critical_section = null;
          }
        };
        this.critical_section = eventContext;
        this.critical_section.deferred.done(scheduleCriticalReset);
      },

      /**
       * process act-on-event decision
       * event contexts only get resolved when they've done their work
       * actOnContext takes a context, so consider unhandled[] (which is upstream in getOrInvent)
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
          if (debug && true) {
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
          if (debug && true) {
            console.log('> entering critical section for '+this.render(eventContext));
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
          $.when(func.call(sfun)).always(wrapUp);
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
        // remove any peers to this event from the queue first
        this.dumpAncestors(this.getKeyFamily(eventContext.key), this.critical_section);
        // @todo could optimise this slightly inefficient repeat find
        // this event depends on the end of the current critical one's chain
        var lastDep = this.earliestAncestor(this.critical_section);
        // optional debugging message
        if (debug && true) {
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
          // test to see if current key matches regkey
          if (current.key.match(re) != null) {
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
          if (debug && true) {
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
          if (debug && true) {
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
   * @return {object} updated event context
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
      // localContext is resolved by handlerHashChanged
      return localContext.deferred;
    }
  };

  /**
   * @return {real} height of viewport in pixels
   */
  var getViewportHeight = function(force) {
    if (this.getViewportHeight_static == undefined || force) {
      var $yard = $('#sfun-yardstick-y');
      if ($yard.length) {
        this.getViewportHeight_static = $yard.height();
      } else {
        // fall back to window
        this.getViewportHeight_static = $window.height();
      }
    }
    return this.getViewportHeight_static;
  };

  /**
   * @return {real} width of viewport in pixels
   */
  var getViewportWidth = function(force) {
    if (this.getViewportWidth_static == undefined || force) {
      var $yard = $('#sfun-yardstick-x');
      if ($yard.length) {
        this.getViewportWidth_static = $yard.width();
      } else {
        // fall back to window
        this.getViewportWidth_static = $window.width();
      }
    }
    return this.getViewportWidth_static;
  };

  /**
   * change the visible portion of the page by moving the scrollbars
   * @param {object} target position
   *        {int} left distance from left of page in pixels
   *        {int} top  distance from top of page in pixels
   * @param {object} [eventContext] optional event context for decorating an existing deferred
   * @return {object} jQuery deferred
   */
  var fireScrollUpdate = function(target, eventContext) {
    var that = this;
    // create a context, but parent it only if eventContext is not undefined
    var localContext = eventQueue.pushOrParent({
      'key': 'scroll:'+'x='+target.left+'&y='+target.top,
      'comment': 'localContext for fire_scrollUpdate'
    }, eventContext);
    if (debug && true) {
      console.log('* fired scroll event '+eventQueue.render(localContext));
    }
    // fire event: change the scroll position (comes through as single event)
    $document.scrollLeft(target.left);
    $document.scrollTop(target.top);
    // if we've yet to setup an event handler
    if (this.bindToScroll_static == undefined) {
      // manually call handler
      handlerScrolled({});
    }
    // localContext is resolved by handlerScrolled
    return localContext.deferred;
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
    var cdirection = getDirection(), cbreadth = getBreadth(), cseq = getSeq(), coffseq = getOffseq();
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
    // stage 1: apply [hash] state to DOM
    // direction changes potentially affect ??? images
    var directionChanged = setDirection(obj.direction);
    // breadth changes potentially affect all images
    var breadthChanged = setBreadth(obj.breadth);
    // seq changes at most only affect the image being selected
    var seqChanged = setSeq(obj.seq);
    // seqoffset changes at most only affect the images being viewed
    var offseqChanged = setOffseq(obj.offseq);
    // updates based on certain types of change
    if (breadthChanged || directionChanged || forceChange) {
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
  var handlerScrolled = function(event) {
    var that = this;
    var sx = $document.scrollLeft(), sy = $document.scrollTop();
    // get context if we created the event, invent if it was user generated
    var eventContext = eventQueue.getOrInvent({
      'key': 'scroll:'+'x='+sx+'&y='+sy,
      'comment': 'invented context for handlerScrolled'
    });
    // process this event if we're meant to
    return eventQueue.actOnContext(eventContext, function() {
      // // don't process scroll event every time, buffer (dump duplicates)
      // buffer('handlerScrolled_event',
      // // function to execute if/when we are processing this event
      // function() {
        return handlerScrolled_eventProcess(event, sx, sy);
      // },
      // // function to execute if we're dumping this event
      // wrapUp, 250);      
    });
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
        case exp.KEY_ARROW_LEFT:
          if (!event.altKey) {
            event.preventDefault();
            // advance to previous image
            return imageAdvanceBy(-1, eventContext);
          }
          break;
        case exp.KEY_ARROW_UP:
          if (event.altKey) {
            event.preventDefault();
            urlChangeUp();
          }
          break;
        case exp.KEY_ARROW_RIGHT:
        case exp.KEY_TAB:
        case exp.KEY_ARROW_DOWN:
          // advance to next image
          event.preventDefault();
          return imageAdvanceBy(1, eventContext);
        case exp.KEY_PAGE_UP:
          if (!event.ctrlKey) {
            event.preventDefault();
            return imageAdvanceBy(-1 * getCountMajor() * getBreadth(), eventContext);
          }
          break;
        case exp.KEY_PAGE_DOWN:
          if (!event.ctrlKey) {
            event.preventDefault();
            return imageAdvanceBy(1 * getCountMajor() * getBreadth(), eventContext);
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
        case exp.KEY_NUMBER_1:
          event.preventDefault();
          return fireHashUpdate( { 'breadth': 1 }, false, eventContext);
        case exp.KEY_NUMBER_2:
          event.preventDefault();
          returnfireHashUpdate( { 'breadth': 2 }, false, eventContext);
        case exp.KEY_NUMBER_4:
          event.preventDefault();
          return fireHashUpdate( { 'breadth': 4 }, false, eventContext);
        case exp.KEY_NUMBER_8:
          event.preventDefault();
          return fireHashUpdate( { 'breadth': 8 }, false, eventContext);
      }
    });
  }

  /**
   * process events generated by mouse wheel scrolling
   * mouseWheeled is a dumb event; we never fire it, so it doesn't have a context
   * downstream of: EVENT mouse wheeled
   */
  var handlerMouseWheeled = function(event) {
    var that = this;
    // work out what direction we're applying this mouse-wheel scroll to
    var direction = getDirection();
    // active mousewheel reaction is dependent on which direction we're flowing in
    if (direction == 'x') {
      event.preventDefault();
      var xpos = $document.scrollLeft();
      // get current cell size
      var cellsize = getCellSize();
      // if not currently aligned to cells, get extra gap to next cell boundary
      var scrolldir = 0 - event.deltaY;
      // optional debugging
      if (debug && true) {
        console.log('wheel dx[' + event.deltaX + '] dy[' + event.deltaY + '] factor[' + event.deltaFactor + ']');
      }
      // calculate increment based on cell snap
      var cellsnap = true;
      var increment;
      if (cellsnap) {
        // if scrolling right/fwd (+ve), align to right edge; if scrolling left/back (-ve), align to left
        increment = xpos + (scrolldir * cellsize);
      } else {
        increment = xpos + (scrolldir * event.deltaFactor * exp.scrollMULTIPLIER);
      }
      // get current x position, increment and write back, firing scroll event
      envisionPos( { 'left': increment, 'top':0 } );
    }
  }

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

    stringHASHBANG: '#!',
    pullImgSrcTHRESHOLD: 20,
    scrollMULTIPLIER: 12,
    breadthMULTIPLIER: 4,
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
     * @return {float} number of cells on the major axis
     */
    'api_getCountMajor': function() {
      return getCountMajor();
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
     * @param {object} $ent cell to check (and re-set) bounds for
     */
    'api_setBound': function($ent) {
      return setBound($ent, true);
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
     * @param {object} pos  {left, top} new scroll coordinate
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
     * @param {int} dp number of decimal places to round to
     * @return {real} number rounded to dp
     */
    'api_round': function(k, dp) {
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