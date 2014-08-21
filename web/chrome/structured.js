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
  // CONSTANTS
  // and private variables
  // ---------

  var debug = true;
  // default values for view state
  this.default = [];
  // the previous values for the view state (1 generation)
  this.previous = [];
  // ms to wait after resize event before re-bound/re-res
  this.resizeTimeout = null;
  // default selector used to select top-level container
  this.containerSelector = '#sfun';

  // jquery cache
  var $document = $(document);
  var $window = $(window);
  var $html = $('html');
  var $sfun;
  var $sfun_flow;
  var $sfun_selectablecell;
  var $sfun_selectablecell_first;
  var $sfun_selectedcell = [];
  var $sfun_selectablecell_img = [];
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

  this.init = function() {
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
        $sfun = $(that.containerSelector);
        $sfun_flow = $(that.containerSelector+'.flow');
        $sfun_selectablecell = $(that.containerSelector+' > .selectablecell');
        $sfun_selectablecell_first = $(that.containerSelector+' > .selectablecell:first');
        // render Mustache templates
        $sfun_selectablecell.find('img').each(function() {
          var template = $(this).data('template-src');
          if (template != undefined) {
            Mustache.parse(template);
          }
        });
        // process state in page HTML next
        that.previous['direction'] = that.default['direction'] = that.getDirection();
        that.previous['breadth'] = that.default['breadth'] = that.getBreadth();
        that.previous['seq'] = that.default['seq'] = 0;
        that.previous['offseq'] = that.default['offseq'] = 0;
        // bind to page
        that.bindToScroll();
        that.bindToHeaderLinks();
        that.bindToHotKeys();
        that.bindToHashChange();
        that.bindToImageLinks();
        // if we're sideways scrolling, bind to scroll event
        that.setDirection(that.getDirection());
        // update vistable
        that.visTableMajor.updateAll(that.getDirection(), $sfun_selectablecell);
        // execute queue of API calls
        that.export.flush();
        // process state if set in URL (hash) first
        that.handler_hashChanged(that.getHash(), true);
        // attach listener to window for resize (rare, but should update)
        $window.resize(function() {
          that.buffer('init_resized',
          // process event
          function() {
            // flush cache
            this.getViewportWidth(true);
            this.getViewportHeight(true);
            // resize may have shown more images, so refresh visibility
            that.refreshVisibility(0);          
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
          k.export.api_triggerKeypress(k.export.KEY_END).done(function() {
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
  this.getCountMajor = function() {
    return 4;
  };

  /**
   * check that ratio is set for each of the images
   * @param  {object} range {first_1, last_n} range of sequence numbers
   * @todo optimise
   */
  this.checkRatios = function(range) {
    var deferred = $.Deferred();
    var defs = [];
    var wrapUp = function() {
      deferred.resolve();
    }
    for (var i = range.first_1 ; i<= range.last_n ; ++i) {
      var jqEnt = $img(i);
      var jqLoadable = jqEnt.find('.loadable');
      if (jqLoadable.data('ratio') == undefined) {
        // wait for image to be loaded in order to get ratio
        defs[defs.length] = this.waitLoadedGetResolution(jqEnt).done(function() {
          that.setBound(jqEnt);
        });
      }
    }
    $.when.apply($, defs).always(wrapUp);
    return deferred;
  }

  /** 
   * @return {object} jQuery deferred
   */
  this.cellsResize = function() {
    var that = this;
    var deferred = $.Deferred();
    var vis = this.getVisibleBoundaries();
    var wrapUp = function() {
      // when layoutManager completes a resize, capture cell boundaries
      // @todo restrict update to range.first_1 to range.last_n
      that.visTableMajor.updateAll(that.getDirection(), $sfun_selectablecell);
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
    // set range as visible cells including visnear
    range = this.calcVisnear(vis.first, vis.last);
    // add selected to range
    range.selected = $sfun_selectedcell.data('seq');
    // set ratio for images within range
    this.checkRatios(range).done(function() {
      // get the current layoutManager, if we have one
      var layout = that.layoutManager.select(0);
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
  }

  /**
   * clear previously assigned cell-specific width and height
   */
  this.cellsClear = function() {
    // @todo call layout_cellsClear
    $('.cell-specific').css( { 'width':'', 'height':'' } ).removeClass('cell-specific').removeClass('visible vispart visnear');
  }

  // ------------------
  // FUNCTIONS: refresh
  // ------------------

  /**
   * update (x/y)-bound on boundable image in cell
   * @param jQuery cell that may have changed size
   * @return {object} $.Deferred
   */
  this.loadThumbRefreshBounds = function(jqEnt) {
    // find boundable entity
    var jqBoundable = jqEnt.find('.loadable');
    if (jqBoundable.length) {
      // 1. update loaded resolution if necessary first
      if (jqBoundable.data('loaded-width') == undefined || jqBoundable.data('loaded-height') == undefined) {
        // if waitLoadedGetResolution succeeds, use loaded-width/height
        return this.waitLoadedGetResolution(jqEnt).done(function() {
          // 2a. once we've got the loaded- dimensions, check bounds
          setBound(jqEnt);
        });
      } else {
        // 2b. as we've already got the loaded- dimensions, check bounds
        setBound(jqEnt);
      }
    }
    // return a resolved deferred
    return $.Deferred().resolve();
  };

  /**
   * Read data about the image and update metric display
   * @param {object} jqEnt jQuery object for image
   */
  this.refreshMetric = function(jqEnt) {
    // find the imgmetric if it's set
    var jqReresable = jqEnt.find('.reresable');
    var jqMetric = jqEnt.find('.imgmetric');
    var perc;
    if (jqMetric.length && jqReresable.length) {
      var width_current = jqReresable.width(), height_current = jqReresable.height();
      var width_native = jqReresable.data('native-width'), height_native = jqReresable.data('native-height');
      // calculate percentage based on image area, or width
      // perc = Math.round((width_current * height_current) * 100 / (width_native * height_native));
      perc = Math.round(width_current * 100 / width_native);
      if (debug && false) {
        // show the size of the image that's been loaded into this img container
        jqMetric.find('span.width').html(Math.round(jqReresable.data('loaded-width')));
        jqMetric.find('span.height').html(Math.round(jqReresable.data('loaded-height')));
        jqMetric.find('span.size').show();
      } else {
        // update with current image width and height
        jqMetric.find('span.width').html(Math.round(width_current));
        jqMetric.find('span.height').html(Math.round(height_current));
      }
      if (!isNaN(perc)) {
        jqMetric.find('span.perc').html(perc+'%').show();
      }
      // analyse to see if we're over/under the native res
      if (width_current > width_native || height_current > height_native) {
        jqMetric.removeClass('super').addClass('sub');
      } else {
        jqMetric.removeClass('sub').addClass('super');          
      }
    }
  };

  /**
   * check that the image metric is in the right place
   */
  this.refreshMetricPosition = function(jqEnt) {
    var jqMetric = jqEnt.find('.imgmetric');
    if (jqMetric.length) {
      var jqImg = jqEnt.find('.reresable');
      if (jqImg.length) {
        var position = jqImg.offset();
        // move the metric to the corner of the image using absolute coords
        jqMetric.css( { 'top': position.top, 'left': position.left });
      }
    }
  };

  /**
   * refresh the cell.visible status on all/some of the entries
   * @param {int} scrolldir direction of scroll (+ve/-ve) or 0 for no scroll
   * @return {object} jQuery deferred
   */
  this.refreshVisibility = function(scrolldir) {
    var that = this;
    // always test all images for visibility, reres, check selection
    return this.setVisibleAll(true).always(function() {
      that.refreshSelected(scrolldir);
    });
  };

  /** 
   * refresh the selected entry after a visibility change
   * @param {int} scrolldir direction of scroll (+ve/-ve) or 0 for no scroll
   * @return {object} jQuery deferred
   */
  this.refreshSelected = function(scrolldir) {
    var jqEnt = $sfun_selectedcell;
    // if no selection, or the current selection isn't visible
    if (!jqEnt.length || !jqEnt.hasClass('visible')) {
      if (debug && false) {
        console.log('previously selected image '+jqEnt.data('seq')+' no longer visible');
      }
      // find the next visible one in the scroll direction
      jqEnt = $(this.containerSelector+' .selectablecell.visible:'+(scrolldir > 0 ? 'first' : 'last'));
      if (jqEnt.length) {
        // create and resolve a local context to allow us to numb listener
        var localContext = this.eventQueue.push({
          'replaceEvent': function(){},
          'comment': 'localContext for refreshSelected (image-'+jqEnt.data('seq')+')'
        });
        // use hash to select new and deselect old, but numb listener and parent deferred
        return this.imageAdvanceTo(jqEnt.data('seq'), localContext);
      }
    }
    return $.Deferred().resolve();
  };

  /**
   * Check the display resolution of the image and swap out src if higher res available 
   * @return {object} jQuery deferred
   */
  this.refreshResolution = function(jqEnt) {
    var that = this;
    var jqReresable = jqEnt.find('.reresable');
    if (!jqReresable.length) {
      return $.Deferred().resolve();
    }
    // don't attempt to check image resolution on directory
    var type = this.getType(jqEnt);
    if (!(type == 'image' || type == 'video')) {
      return $.Deferred().resolve();
    }
// DELETE ME
console.log('starting imageReres-'+jqEnt.data('seq')+', adding class reresing');
    // flag this image as updating its resolution
    jqEnt.addClass('reresing');
    // create local deferred and local wrapUp
    var deferred = $.Deferred();
    var wrapUp = function() {
// DELETE ME
console.log('passing back to imageReres-'+jqEnt.data('seq')+' to resolve');
      // remove reresing status and refreshMetric
      jqEnt.removeClass('reresing');
      that.refreshMetric(jqEnt);
      // resolve deferred
      deferred.resolve();
    };
    // loaded width/height should be set when thumbnail/last reres loaded
    var loadedWidth = jqReresable.data('loaded-width');
    var loadedHeight = jqReresable.data('loaded-height');
    var imageContainerWidth = jqReresable.width() * window.devicePixelRatio;
    var imageContainerHeight = jqReresable.height() * window.devicePixelRatio;
    // try and refresh the metadata
    this.refreshMetadata(jqEnt)
    .done(function() {
      // if successful, use metadata to make decision about reres
      var nativeWidth = jqReresable.data('native-width');
      var nativeHeight = jqReresable.data('native-height');
      // analyse
      var resbracket = 250, brackWidth, brackHeight;
      var bigger = imageContainerWidth > loadedWidth || imageContainerHeight > loadedHeight;
      var available = loadedWidth < nativeWidth || loadedHeight < nativeHeight;
      // optional debugging
      if (debug && true) {
        console.log('image-'+jqEnt.data('seq')+': checking resolution w['+imageContainerWidth+'] h['+imageContainerHeight+'] nativeWidth['+nativeWidth+'] nativeHeight['+nativeHeight+'] loadedWidth['+loadedWidth+'] loadedHeight['+loadedHeight+']');
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
// DELETE ME
console.log('passing on to imageReres-'+jqEnt.data('seq'));
            // swap out image and wait for swap to complete
            that.imageReres(jqEnt, that.substitute(jqReresable.data('template-src'), { 'maxwidth': brackWidth } )).always(wrapUp);
          } else {
            wrapUp();
          }
        } else {
          // same but pivot on height rather than width
          brackHeight = Math.min(Math.ceil(imageContainerHeight/resbracket) * resbracket, nativeHeight);
          if (brackHeight > loadedHeight) {
// DELETE ME
console.log('passing on to imageReres-'+jqEnt.data('seq'));
            // swap out image and wait for swap to complete
            that.imageReres(jqEnt, that.substitute(jqReresable.data('template-src'), { 'maxheight': brackHeight } )).always(wrapUp);
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
      if (typeof(jqReresable.data('loaded-width')) != 'undefined' && typeof(jqReresable.data('loaded-height')) != 'undefined') {
        if ((imageContainerWidth > loadedWidth) || (imageContainerHeight > loadedHeight)) {
          // don't know native width, so just request at loadedWidth/Height
          that.imageReres(jqEnt, that.substitute(jqReresable.data('template-src'), { 'maxwidth': imageContainerWidth, 'maxheight': imageContainerHeight } )).always(wrapUp);
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
  this.refreshMetadata = function(jqEnt) {
    var that = this;
    var jqReresable = jqEnt.find('.reresable');
    if (jqReresable.length && jqReresable.data('meta-src')) {
      // test to see if we have the metadata
      if (typeof(jqReresable.data('native-width')) == 'undefined' || typeof(jqReresable.data('native-height')) == 'undefined') {
        var deferred = $.Deferred();
        // fire ajax request
        $.ajax({
          url: jqReresable.data('meta-src'),
          dataType: 'json',
        })
        .done(function(data, textStatus, jqXHR) {
          if (typeof(data.meta) != 'undefined') {
            // if we get a response, set the missing metadata to the image
            jqReresable.data('native-width', data.meta.width);
            jqReresable.data('native-height', data.meta.height);
            if (debug && false) {
              console.log('image-'+jqEnt.data('seq')+': received native width['+jqReresable.data('native-width')+'] height['+jqReresable.data('native-height')+']');
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
          console.log('image-'+jqEnt.data('seq')+': fired request for native width and height');
        }
        return deferred;
      } else {
        // no need to update metadata
        return $.Deferred().resolve();
      }
    }
    // if we couldn't find a suitable candidate and get it's metadata, fail out the deferred
    return $.Deferred().reject();
  };

  /**
   * refresh a single image, but ensure that it's loaded first
   * @param {object} jqEnt jquery entity
   * @param {boolean} reres also refresh the image's resolution
   * @return {object} jQuery deferred
   */
  this.refreshImageResolution = function(jqEnt, reres) {
    var that = this;
    var deferred = $.Deferred();
    // final stage is to refresh the metric
    var wrapUp = function() {
      // update metric
      that.refreshMetric(jqEnt);
      // resolve deferred
      deferred.resolve();
    };
    if (reres) {
      // change out the image for a better resolution if one's available
      this.refreshResolution(jqEnt).always(function() {
// DELETE ME
console.log('resolved refresh-Image-function-'+jqEnt.data('seq'));
        wrapUp();
      });
    } else {
      wrapUp();
    }
    return deferred;
  };

  /**
   * refresh all visible images
   * @param {object} jqEnt jquery entity
   * @return {object} jQuery deferred
   */
  this.refreshImageSet = function() {
    var that = this;
    var selector = that.containerSelector+' .selectablecell.visible, '+that.containerSelector+' .selectablecell.vispart';
    var jqVisibles = $(selector);
    if (jqVisibles.length) {
      var deferred = $.Deferred();
      var defs = [];
      // // stage 1a: make sure thumbnails loaded and refresh bounds as a batch
      jqVisibles.each(function() {
        var jqEnt = $(this);
        defs.push(that.loadThumbRefreshBounds(jqEnt));
      });
      // stage 1b: refresh cell dimensions
      defs.push(that.cellsResize());
      $.when.apply($, defs).always(function() {
        defs = [];
        // refresh jqVisibles because resize may have added more visible/vispart cells
        jqVisibles = $(selector);
        // stage 3: refresh resolutions as a batch
        jqVisibles.each(function() {
          var jqEnt = $(this);
          defs.push(that.refreshImageResolution(jqEnt, true));
        });
        $.when.apply($, defs).always(function() {
          // finally resolve
          deferred.resolve();
        });
      });
      return deferred;
    }
    return $.Deferred().resolve();
  };

  // ------------------
  // FUNCTIONS: Binding
  // ------------------

  /**
   * process events generated by mouse wheel/trackpad scrolling
   */
  this.bindToScroll = function() {
    var that = this;
    $window.scroll(function(event) {
      that.handler_scrolled(event);
      event.preventDefault();
    });
    $window.mousewheel(function(event) {
      that.handler_mouseWheeled(event);
    });
  };

  /**
   * turn header links into clickable buttons
   */
  this.bindToHeaderLinks = function() {
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
      that.fire_hashUpdate( { 'direction': 'x' }, false);
      event.preventDefault();
    });
    $('#flow-y').click(function(event) {
      that.fire_hashUpdate( { 'direction': 'y' }, false);
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
      that.fire_hashUpdate( { 'breadth': 1 }, false);
      event.preventDefault();
    });
    $('#flow-2').click(function(event) {
      that.fire_hashUpdate( { 'breadth': 2 }, false);
      event.preventDefault();
    });
    $('#flow-4').click(function(event) {
      that.fire_hashUpdate( { 'breadth': 4 }, false);
      event.preventDefault();
    });
    $('#flow-8').click(function(event) {
      that.fire_hashUpdate( { 'breadth': 8 }, false);
      event.preventDefault();
    });
    
  };

  /**
   * Bind to hotkeys for navigation
   */
  this.bindToHotKeys = function() {
    var that = this;
    $document.keydown(function(event) {
      that.handler_keyPressed(event);
    });
  };

  /**
   * listen for changes to the hash
   * see https://github.com/browserstate/history.js
   */
  this.bindToHashChange = function() {
    var that = this;
    // bind to the hash change (not state hashes)
    History.Adapter.bind(window, 'anchorchange', function(event) {
      event.preventDefault();
      that.handler_hashChanged(that.getHash());
    });
  };

  /**
   *  if the image is clicked, redirect to in-page image
   */
  this.bindToImageLinks = function() {
    var that = this;
    // bind to click using delegated event handler (http://api.jquery.com/on/), instead of individual N handlers
    $sfun.on('click', '.selectablecell a.media-container', function(event) {
      // select image, then toggle
      var seq = $(this).parents('.selectablecell').data('seq');
      // seq changes don't go into history
      that.fire_hashUpdate( { 'seq': seq }, false);
      // this is a bit nasty, because it's doing 2 hash updates in quick succession
      that.imageToggleFullscreen();
      event.preventDefault();
    });
  };

  // ------------------
  // FUNCTIONS: getters
  // ------------------

  /**
   * updated loaded-width and loaded-height data attributes
   * @param {jQuery object} jqEnt image to check
   * @return {object} jQuery deferred
   */
  this.waitLoadedGetResolution = function(jqEnt) {
    var jqLoadable = jqEnt.find('.loadable');
    if (jqLoadable.length) {
      // create local context for async processing
      var deferred = $.Deferred();
      // update loaded resolution
      var im = new Image();
      im.onload = function() {
        jqLoadable.data('loaded-width', im.width);
        jqLoadable.data('loaded-height', im.height);
        // never update the ratio, but set if unset
        if (jqLoadable.data('ratio') == undefined) {
          jqLoadable.data('ratio', im.width / im.height);
        }
        im = null;
        if (debug && false) {
          console.log('image-'+jqEnt.data('seq')+': loaded resolution updated ['+jqLoadable.data('loaded-width')+','+jqLoadable.data('loaded-height')+']');
        }
        // notify promise of resolution
        deferred.resolve();
      }
      // if the src attribute is defined, use it
      if (jqLoadable.attr('src') != undefined) {
        im.src = jqLoadable.attr('src');
      } else {
        // otherwise use data-desrc (thumbnail hasn't been loaded before)
        im.src = jqLoadable.data('desrc');
      }
      if (debug && false) {
        console.log('image-'+jqEnt.data('seq')+': fired update loaded resolution request');
      }
      // return local context so that when we complete (resolve), our parents can execute
      return deferred;
    }
    // if there are no loadable images, return a resolved deferred
    return $.Deferred().resolve();
  };

  /**
   * Get the real flow direction, not just what the class says because the browser might not support all directions
   * (needs flexbox)
   * @return current flow direction
   */
  this.getDirection = function() {
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
  this.getBreadth = function() {
    var breadth = 2;
    var jq = $sfun;
    if (jq.hasClass('flow-1')) breadth = 1;
    if (jq.hasClass('flow-4')) breadth = 4;
    if (jq.hasClass('flow-8')) breadth = 8;
    return breadth;
  };

  /**
   * page scroll offset to sequence number is stored in the html tag [default to 0]
   * @return {int} scroll offset to seq
   */
  this.getOffseq = function() {
    var offseq = $html.data('offseq');
    if (offseq == undefined) {
      return 0;
    }
    return offseq;
  }

  /**
   * @return {float} current size of cell along the major axis
   */
  this.getCellSize = function() {
    // get first cell
    var jq = $sfun_selectablecell_first;
    if (this.getDirection() == 'x') {
      return jq.width();
    } else {
      return jq.height();
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
  this.getDefaults = function() {
    return { 'direction': this.default['direction'], 'breadth': this.default['breadth'], 'seq': this.default['seq'], 'offseq': this.default['offseq'] };
  }

  /**
   * @param {int} edge majoraxis value of edge to find cell at
   */
  this.getCellAt = function(edge) {
    // START HERE
    // think hashTable of cell edges, zero-based
  };

  /** 
   * @param {int} scrolldir Direction [and amount] of scroll
   * @param {int} edgeAlign majoraxis value of edge to align to
   */
  this.getCellAlignExtra = function(scrolldir, edgeAlign) {
    var extra = 0;
    // find cell
    var matchCell = this.getCellAt(edgeAlign);
    // get edges of cell
    // see if we're aligned
    if (1 == 0) {
      // find next edge in scroll direction
    }
    return extra;
  };

  /**
   * @return {int} sequence number of currently selected cell [default to 0]
   */
  this.getSeq = function() {
    var jqEnt = $sfun_selectedcell;
    if (!jqEnt.length) {
      return 0;
    }
    var seq = jqEnt.data('seq');
    if (seq == undefined) {
      return 0;
    }
    return seq;
  };

  /**
   * @return {int} total number of entities (max entry seq+1)
   */
  this.getTotalEntries = function() {
    var jq = $(this.containerSelector+' .selectablecell:last');
    return (parseInt(jq.data('seq'))+1);
  };

  /**
   * @return {string} type of entity
   */
  this.getType = function(jqEnt) {
    if (jqEnt.hasClass('image-type')) {
      return 'image';
    } else if (jqEnt.hasClass('video-type')) {
      return 'video';
    } else if (jqEnt.hasClass('directory-type')) {
      return 'directory';
    }
  };

  /**
   * @return {int} width of page outer border (gutter) in pixels [default 0]
   */
  this.getGutter = function() {
    if (this.getGutter_static == undefined) {
      var jqGut = $('#gutterball');
      if (jqGut.length) { 
        this.getGutter_static = jqGut.width();
      } else {
        this.getGutter_static = 0;
      }
    } 
    return this.getGutter_static;
  }

  /**
   * @return {int | bool} next sequence number, or false on failure
   */
  this.getNextSeq = function(seq, increment) {
    var startingPointSeq = seq;
    do {
      seq = (seq+increment) % this.getTotalEntries();
      // wrap around
      if (seq < 0 && increment < 0) {
        seq = this.getTotalEntries()-1;
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
  this.getDeferred = function() {
    return new $.Deferred();
  };

  // ------------------
  // FUNCTIONS: setters
  //   all called downstream of events
  // ------------------

  /**
   * set all 'flow' elements to flow in the direction
   * downstream of: EVENT
   */
  this.setDirection = function(direction) {
    var changed = (this.getDirection() !== direction);
    var invdir = (direction == 'x' ? 'y' : 'x');
    $sfun_flow.addClass('flow-' + direction).removeClass('flow-' + invdir);
    return changed;
  };

  /**
   * set the width of the screen flow
   * e.g. number of cells vertically if in vertical mode
   * downstream of: EVENT
   */
  this.setBreadth = function(breadth) {
    var changed = (this.getBreadth() !== breadth);
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
   * downstream of: EVENT
   */
  this.setSeq = function(seq) {
    var changed = (this.getSeq() !== seq);
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
  this.setOffseq = function(offseq) {
    var current = $html.data('offseq');
    var changed = (current !== offseq && current !== undefined);
    $html.data('offseq', offseq);
    return changed;
  }

  /**
   * @param {object} jQuery entity
   * downstream of: EVENT
   */
  this.setBound = function(jqEnt) {
    var jqBoundable = jqEnt.find('.boundable');
    if (jqBoundable.length) {
      // detect if the image is bound by width/height in this container
      var ix = jqBoundable.data('loaded-width'), iy = jqBoundable.data('loaded-height');
      // read container width/height
      var cx = jqEnt.width(), cy = jqEnt.height();
      var cratio = cx / cy;
      if (debug && false) {
        console.log('image-'+jqEnt.data('seq')+': ['+ix+','+iy+'] checking bound within ['+cx+','+cy+']');
      }
      var iratio = ix / iy;
      var direction = ((cratio / iratio) > 1.0 ? 'y' : 'x');
      var invdir = (direction == 'x' ? 'y' : 'x');
      if (debug && false) {
        console.log('cx[' + cx + '] cy[' + cy + '] cratio[' + cratio + '], ix[' + ix + '] iy[' + iy + '] iratio['
            + iratio + ']: ' + (cratio / iratio).toPrecision(3) + '= ' + direction + '-bound');
      }
      // apply class to image
      jqBoundable.addClass(direction + '-bound').removeClass(invdir + '-bound');
    }
  }

  /**
   * @param {object} target position
   *        {int} left distance from left of page in pixels
   *        {int} top  distance from top of page in pixels
   * @return {object} target position cropped against viewport
   */
  this.cropScrollPositionAgainstViewport = function(target) {
    return {
      'left': this.export.api_round(Math.max(0, Math.min(target.left, $document.width() - this.getViewportWidth())), 0),
      'top': this.export.api_round(Math.max(0, Math.min(target.top, $document.height() - this.getViewportHeight())), 0)
    };
  }

  /** 
   * ensure that a given image lies within the current viewport
   * @param {int} seq image sequence number
   * @param {int} scroll offset to seq image [default: 0]
   * downstream of: EVENT
   * @return {object} jQuery deferred
   */
  this.envisionSeq = function(seq, offseq) {
    var jqEnt = $img(seq);
    var direction = this.getDirection();
    if (offseq == undefined) {
      offseq = 0;
    }
    // if we found the cell
    if (jqEnt.length) {
      // get the cell's position
      var position = jqEnt.offset();
      // work out the target position
      var target = { 'left': (direction == 'x' ? position.left - offseq : 0), 'top':(direction == 'x' ? 0 : position.top - offseq) };
      // crop the target position against reachable bounds
      target = this.cropScrollPositionAgainstViewport(target);
      // work out whether we're currently at the target position
      var fireScroll = false;
      var scroll = { 'top': $window.scrollTop(), 'left': $window.scrollLeft() };
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
        return this.refreshVisibility(0);
      }
      // otherwise scroll to the target position
      return this.fire_scrollUpdate( target );
    }
    return $.Deferred().resolve();
  };

  /**
   * Work out what cells are visible at the moment
   * @return {object} describing visible cells
   *   first:seq of first visible, last:seq of last visible
   */
  this.getVisibleBoundaries = function() {
    var vis = {};
    var min, max;
    // cells' offset is a couple of pixels left of image
    var rounding = this.getGutter()+1;
    var direction = this.getDirection();
    // get screen bounds along major axis (min and max)
    if (direction == 'x') {
      // min is left bar minus rounding for border/margin
      min = $document.scrollLeft() - rounding;
      // max is right bar minus rounding for border/margin
      max = $document.scrollLeft() + this.getViewportWidth() - rounding;
    } else {
      min = $document.scrollTop() - rounding;
      max = $document.scrollTop() + this.getViewportHeight() - rounding;
    }
    // find first spanning min boundary
    var firstRef = this.visTableMajor.findCompare(min, this.export.compareGTE, false);
    var firstMatch = this.visTableMajor.select(firstRef);
    if (firstMatch != -1) {
      vis.first = firstMatch.jqEnt.data('seq');
    }
    // find last spanning max boundary
    var lastRef = this.visTableMajor.findCompare(max, this.export.compareLTE, true);
    var lastMatch = this.visTableMajor.select(lastRef);
    if (lastMatch != -1) {
      vis.last = lastMatch.jqEnt.data('seq');
    }
    // assume all visibles are non-partial, then test
    vis.lastFirstPartial = -1;
    vis.firstLastPartial = 99999;
    // check first visibles for partial visibility
    for (var i = vis.first ; i <= vis.last ; ++i) {
      var jqEnt = $('#seq-'+i);
      var position = jqEnt.offset();
      var posMajor = (direction == 'x' ? position.left : position.top);
      if (posMajor < min) {
        vis.lastFirstPartial = i;
      } else {
        // don't do further than first non-partial
        break;
      }
    }
    // check last visibles for partial visibility
    for (var i = vis.last ; i >= vis.first ; i--) {
      var jqEnt = $('#seq-'+i);
      var position = jqEnt.offset();
      var posMajor = (direction == 'x' ? position.left + jqEnt.width() : position.top + jqEnt.height());
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
  this.setVisibleAll = function(thenRefresh) {
    var that = this;
    var jqCells = $sfun_selectablecell;
    // test to see if we found any selectable cells
    if (jqCells.length) {
      var deferred = $.Deferred();
      var defs = [];
      var wrapUp = function() {
        // resolve the deferred
        deferred.resolve();
      }
      // clear all the visible images
      jqCells.removeClass('visible vispart visnear');
      // derive boundaries of visible cells
      var vis = this.getVisibleBoundaries();
      for (var i = vis.first ; i <= vis.last ; i++) {
        var vistype = ((i <= vis.lastFirstPartial || i >= vis.firstLastPartial) ? 'vispart' : 'visible');
        that.setImageVisibilityClass($('#seq-'+i), vistype);
      }
      if (thenRefresh) {
        // now batch process all the visibles
        that.refreshImageSet().done(wrapUp);
      } else {
        wrapUp();
      }
      // now request visnear images, but don't wait for them (async, not resync)
      this.setVisnear(vis);
      return deferred;
    }
    return $.Deferred().resolve();
  };

  /**
   * either flag an image as visible or not visible
   * @param {jQuery} jqEnt image
   * @param {string} 'visible' true to make visible, 'not visible' to hide
   *   or 'visnear' to make visible but not re-res
   */
  this.setImageVisibilityClass = function(jqEnt, vis) {
    var that = this;
    if (debug && false) {
      console.log('image-'+jqEnt.data('seq')+': making '+vis);
    }
    // process visibility string
    if (vis == 'not-visible') {
      // make it not-visible
      jqEnt.removeClass('visible');
    } else {
      // vis/visnear: make its src show, if not there already [async]
      var jqReresable = jqEnt.find('.reresable');
      if (jqReresable.length) {
        var attr = jqReresable.attr('src');
        if (typeof attr === 'undefined' || attr === false) {
          jqReresable.attr('src', jqReresable.data('desrc'));
        }
      }
      if (vis == 'visnear') {
        // mark image as near visible
        jqEnt.removeClass('vispart visible').addClass('visnear');
      } else if (vis == 'vispart') {
        // make it visible (may have previously been visnear)
        jqEnt.removeClass('visnear visible').addClass('vispart');
      } else if (vis == 'visible') {
        // make it visible (may have previously been visnear)
        jqEnt.removeClass('vispart visnear').addClass('visible');
      }
    }
  };

  /**
   * @param  {int} first_np1 first visible is visnear_n+1
   * @param  {int} last_0 last visible is visnear_0
   * @return {object} {last_1, last_n, first_1, first_n}
   */
  this.calcVisnear = function(first_np1, last_0) {
    var cellcount = this.getTotalEntries();
    var reach = this.getBreadth() * this.export.breadthMULTIPLIER;
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
   */
  this.setVisnear = function(vis) {
    // find visnear first and last visible
    var range = this.calcVisnear(vis.first, vis.last);
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
        this.setImageVisibilityClass($('#seq-'+i), 'visnear');
      }
    }
    // only do first visnear if there are some entries BEFORE visibles
    if (range.first_n != vis.first) {
      // request visnear (before visibles), async
      for (var i = range.first_1 ; i <= range.first_n ; i++) {
        this.setImageVisibilityClass($('#seq-'+i), 'visnear');
      }
    }
  }

  // --------------------
  // FUNCTIONS: image ops
  // --------------------

  /**
   * Swap out image using a temporary image (to get triggered on load event)
   * Can't just switch src on jqEnt, because that image is already loaded
   * Firebug doesn't show the updated data- attributes, but they are updated
   * @return {object} jQuery deferred
   */
  this.imageReres = function(jqEnt, path) {
    var that = this;
    var jqReresable = jqEnt.find('.reresable');
    if (jqReresable.length) {
      var deferred = $.Deferred();
      // create temporary image container
      var img = $('<img id="dynamic" />');
      // attach listener to catch when the new image has loaded
      img.attr('src', path).one('load', function() {
        // now that it's pre-cached by the temp, apply to original image
        jqReresable.attr('src', path);
        // store loaded width and height
        jqReresable.data('loaded-width', this.width);
        jqReresable.data('loaded-height', this.height);
        // never update the ratio, but set if unset
        if (jqReresable.data('ratio') == undefined) {
          jqReresable.data('ratio', this.width / this.height);
        }
        if (debug && false) {
          console.log('image-'+jqEnt.data('seq')+': swapped out for ('+jqReresable.data('loaded-width')+','+jqReresable.data('loaded-height')+')');
        }
        that.refreshMetric(jqEnt);
        // flag as reres'd, no longer reresing
        jqEnt.removeClass('reresing');
        // notify promise of resolution
        deferred.resolve();
      }).each(function() {
        if(this.complete) $(this).load();
      });
      // return local context so that when we complete (resolve), our parents can execute
      return deferred;
    }
// DELETE ME
console.log('without-reresingImage-'+jqEnt.data('seq'));
    jqEnt.removeClass('reresing');
    return $.Deferred().resolve();
  };

  /**
   * advance forward or back by a certain number of images in the sequence
   * @param {int} increment positive to go to next, negative for previous
   * @param {object} eventContext optional event context for decorating an existing deferred
   * @return {object} jQuery deferred
   */
  this.imageAdvanceBy = function(increment, eventContext) {
    var that = this;
    // start with the current image
    var seq = this.getSeq();
    var wrapUp = function() {
      if (eventContext) {
        return that.eventQueue.resolve(eventContext);
      }
      return $.Deferred().resolve();
    }
    if (seq >= 0 && seq < this.getTotalEntries()) {
      // iterate to find next image
      if ((seq = this.getNextSeq(seq, increment)) !== false) {
        return this.imageAdvanceTo(seq, eventContext).done(wrapUp);
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
  this.imageAdvanceTo = function(seq, eventContext) {
    // update using hash change
    return this.fire_hashUpdate( { 'seq': seq }, false, eventContext);
  };

  /**
   * switch between the default breadth and fullscreen
   * @param {object} eventContext optional event context for decorating an existing deferred
   * @return {object} jQuery deferred
   */
  this.imageToggleFullscreen = function(eventContext) {
    var jqEnt = $sfun_selectedcell;
    switch (this.getType(jqEnt)) {
      case 'image':
        // toggle using hash change
        if (this.getBreadth() == 1) {
          return this.fire_hashUpdate( { 'breadth': this.previous['breadth'] }, false, eventContext);
        } else {
          return this.fire_hashUpdate( { 'breadth': 1 }, false, eventContext);
        }
        break;
      case 'directory':
        var jqClickable = jqEnt.find('.clickable');
        if (jqClickable.length) {
          window.location = jqClickable.attr('href');
        }
        break;
    }
    return this.eventQueue.resolve(eventContext);
  };

  // ------------------
  // FUNCTIONS: URL ops
  // ------------------

  /**
   * change up a directory
   */
  this.urlChangeUp = function() {
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
      var filteredHash = this.getFilteredHash();
      // redirect to new page
      this.urlGoto(newUrl + this.export.stringHASHBANG + filteredHash);
    }
    return false;
  };

  /**
   * redirect to another url
   * @param {string} newUrl new location
   */
  this.urlGoto = function(newUrl) {
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
  this.hashGenerate = function(obj) {
    var hash = '';
    for (var key in obj) {
        // only set name:value pair if not default
      if (obj[key] == this.default[key]) {
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
   * @param  {string} h1 first hash
   * @param  {string} h2 second hash
   * @return {boolean} true if the two hashes are equivalent
   */
  this.hashEquals = function(h1, h2) {
    return(h1 == h2);
  };

  /**
   * parse out integers from hash attributes
   * @param {string} hash string
   * @return {object} hash values as an object
   */
  this.hashParse = function(hash) {
    var output = {};
    // look for hash arguments
    if (hash.length > 1) {
      // strip leading #! if set
      var hblen = this.export.stringHASHBANG.length;
      if (hash.substr(0, hblen) == this.export.stringHASHBANG) {
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
  this.hashValidate = function(hash) {
    var deleteCount = 0;
    for (var attrname in hash) {
      switch(attrname) {
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
  };

  // --------------------------
  // LIBRARY: generic hashTable
  // --------------------------

  /**
   * create a generic hashTable
   * @param {string} namearg name of the table (used for debugging messages)
   * @return {object} hashTable object
   */
  this.createHashTable = function(namearg) {
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
        this.length = 0;
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
        return this._push(obj);
      },

      /**
       * actually push obj onto queue
       * @param {object} obj to push
       */
      '_push': function(obj) {
        var ref = this.length;
        // store ID and ready for next ID request
        obj.id = this.counter++;
        // store in object array
        this.objarr[ref] = obj;
        // store in the index array(s), allow duplicate keys
        this.keyarr[ref] = obj.key;
        // increment length (by refreshing it)
        this.length = this.objarr.length;
        // optional debugging
        if (debug && false) {
          console.log('pushed object['+this.render(obj)+'] on to ref['+ref+'] '+this.name+' hashTable, now has '+this.length+'elements');
        }
        return obj;
      },

      /**
       * @return {string} render simple string of object
       */
      'render': function(obj) {
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
        var maxRef = this.length - 1;
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
          if (minRef < 0 || minRef >= this.length) return -1;
          // work forwards looking for identical value to first >= key
          return this.find(currentElement, false);
        } else {
          if (maxRef < 0 || maxRef >= this.length) return -1;
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
        // update outer length for continuity
        this.length = this.objarr.length;
      },

      /**
       * This can be used just prior to a _push to get the ID that will be assigned by that _push
       * @return {int} object counter in the hashTable
       */
      'getCounter': function() {
        return this.counter;
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
       * @param  {int} ref position in table
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
  this.createVisTable = function() {
    return $.extend(this.createHashTable('visTable'), {

      // FUNCTIONS

      /**
       * update coordinates stored for each cell
       * @param  {string} direction x or y
       * @param  {object} jqCells jQuery list of cells
       */
      'updateAll': function(direction, jqCells) {
        var vt = this;
        // wipe previous table
        vt.wipe();
        // read in new values
        jqCells.each(function() {
          var jqEnt = $(this);
          var position = jqEnt.offset();
          // create object
          var obj = {
            'jqEnt': jqEnt,
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
  this['visTableMajor'] = this.createVisTable();

  /**
   * create a specialised hashTable for visTableMajor
   */
  this.createLayoutManager = function() {
    return $.extend(this.createHashTable('layoutManager'), {
      // FUNCTIONS
      'lastEntry': null
    });
  }

  /** 
   * The layoutManager is used:
   * - to store an indexed list of layout methods
   */
  this['layoutManager'] = this.createLayoutManager();

  /**
   * create a specialised hashTable for the eventQueue
   * @return {object} hashTable object
   */
  this.createEventQueue = function() {
    return $.extend(this.createHashTable('eventQueue'), {

      // CONSTANTS

      // time after which scroll events expire
      TIMEOUT_expireEVENT: 10000,

      // default event object 
      'defaultEventObject': {
        'key': '<unset:',
        // don't replace the event handler
        'replaceEvent': null,
        // don't create a deferred
        'deferred': null,
        // has no parent
        'parent': null,
        // has no dependencies
        'deps': null,
        // never expires
        'expires': null,
        // comment is an empty string (for rendering)
        'comment': ''
      },

      // VARIABLES

      // expiry timeout callback
      'expiryHandler': null,

      // FUNCTIONS

      /**
       * @return {string} render simple string of object
       */
      'render': function(obj) {
        var output = obj.id + ':' + obj.key + ', ' + obj.deferred.state();
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
        for (var i=0 ; i<this.length ; ++i) {
          obj = this.objarr[i];
          if (obj.expires != null) {
            if (timenow > obj.expires) {
              if (debug) {
                console.log('expiring eventContext['+obj.key+']');
              }
              this.resolve(obj);
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
        // create new deferred, but ignore if already set in partial
        var deferred = $.Deferred();
        // compose new object ($.extend gives right to left precedence)
        var obj = $.extend({}, this.defaultEventObject, {
          'key': this.defaultEventObject.key + this.getCounter() + '>',
          'deferred': deferred,
          'deps': []
        }, partial);
        // optional debugging message
        if (debug && true) {
          console.log('+ pushed event context[' + this.render(obj) + '], q'+(this.length+1));
        }
        // if the object expires, schedule its removal
        if (obj.expires) {
          // clear old timeout
          if (that.expiryHandler != null) {
            clearTimeout(that.expiryHandler);
          }
          // schedule a check after the timeout
          this.expiryHandler = setTimeout(function() {
            that.checkExpiries();
          }, this.TIMEOUT_expireEVENT);
        }
        // push
        return this._push(obj);
      },

      /**
       * push event object or merge if a peer is set
       * @param {object} partial fields to override defaults
       */
      'pushOrMerge': function(partial, peer) {
        var obj = {};
        if (typeof(peer) != 'undefined') {
          obj = peer;
          // remove old object from queue
          this.removeObj(peer);
          // aggregate the comments to enable clearer historical tracking
          if (partial.comment) {
            partial.comment += ', was ' + obj.comment;
          }
          if (debug && true) {
            console.log('- deprecated event context[' + this.render(peer) + '] in favour of [see next pushed], q'+this.length);
          }
        }
        // overwrite obj fields with partial values
        return this.push($.extend(obj, partial));
      },

      /**
       * push event object onto event queue and setup parenting
       * can only cope with 1:1 parent:child relationships
       * @param {object} partial fields to override defaults
       */
      'pushChild': function(parentContext, partial) {
        var that = this;
        // push partial in normal way
        var obj = this.push(partial);
        if (typeof(parentContext) != 'undefined' && parentContext) {
          // store parent relationship
          obj.parent = parentContext;
          parentContext.deps[parentContext.deps.length] = obj;
          // setup promise on resolution of child to resolve parent
          obj.deferred.done(function() {
            // test to see if parent has outstanding deps
            var ref = parentContext.deps.indexOf(obj);
            if (ref != -1) {
              // delete this dep from parent
              parentContext.deps.splice(ref, 1);
            }
            // if we've resolved all the deps, resolve this promise
            if (parentContext.deps.length == 0) {
              if (debug && true) {
                console.log('resolved context[' + that.render(obj) + '], resolving parent context[' + that.render(obj.parent) + ']');
              }
              resolve(parentContext);
            } else {
              if (debug && true) {
                console.log('resolved context[' + that.render(obj) + '], waiting parent context[' + that.render(obj.parent) + ']');
              }              
            }
          });
          if (debug && true) {
            console.log('  -> pushed event has parent context[' + this.render(obj.parent) + ']');
          }
        }
        return obj;
      },

      /** 
       * interface function to get from table
       * @param {string} key to search for
       * @param {bool} [alsoRemove] true to delete matched elements
       * @return {object} matched object or null if not found
       */
      'get': function(key, alsoRemove) {
        var obj = this._get(key, alsoRemove);
        if (debug && true) {
          if (obj != null) {
            console.log('- pulled event context[' + this.render(obj) + '], q'+this.length);
          } else {
            console.log('unfilled get request for key[' + key + ']');
          }
        }
        return obj;
      },

      /** 
       * @param {object} partial fields to override defaults
       * @param {bool} [alsoRemove] true to delete matched elements
       * @return {object} matched object or created object
       */
      'getOrInvent': function(partial, alsoRemove) {
        var retrieved = null;
        if (typeof(partial.key) != 'undefined') {
          retrieved = this.get(partial.key, alsoRemove);
        }
        if (typeof(alsoRemove) == 'undefined') {
          alsoRemove = false;
        }
        if (retrieved == null) {
          // create object using shallow copy of defaults, then overwrite set fields
          retrieved = this.invent(partial);
          // only store if we're not removing
          if (!alsoRemove) {
            this.push(retrieved);
          }
        } else {
          // aggregate the comments to enable clearer historical tracking
          if (retrieved.comment) {
            retrieved.comment += ', instead of ' + partial.comment;
          }
          if (debug && true) {
            console.log(' - pulled not invented context[' + this.render(retrieved) + '], q'+this.length);
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
        var retrieved = $.extend({}, this.defaultEventObject, {
          'deferred': $.Deferred(),
          'deps': [],
        }, partial);
        return retrieved;
      },

      /**
       * wrap up act-on-event decision (include lookup)
       * @param {string} key to search for
       * @return {boolean} true if we should act on this event, false to ignore it (alternative called) 
       */
      'actOnEvent': function(key) {
        // try and find an eventQueue object corresponding to this event (and pop if found)
        var eventContext = this.get(key, true);
        return this.actOnContext(eventContext);
      },

      /**
       * wrap up act-on-event decision
       * @param {object} eventContext
       * @return {boolean} true if we should act on this event, false to ignore it (alternative called) 
       */
      'actOnContext': function(eventContext) {
        if (eventContext != null) {
          // see how the eventContext is defined
          if (typeof(eventContext.replaceEvent) != 'undefined' && eventContext.replaceEvent) {
            // process by calling replaceEvent instead of processing this event directly
            eventContext.replaceEvent.call(this);
            // flag that we're no longer going to process this event
            return false;
          }
        }
        // if we've no reason to ignore the event, then act on it
        return true;
      },

      /**
       * setup s2 as a dependency of s1
       * @param  {object} s1 destination event context
       * @param  {object} s2 source event context
       * @return {object} s1 after aggregation
       */
      'aggregate': function(s1, s2) {
        // check that they're not equal (unbranched return of eventContext by subfunction)
        if (!this.equals(s1, s2)) {
          // check that s2 is a child of s1
          if (s2.parent == s1) {
            s1.deps[s1.deps.length] = s2;
          }
        }
        return s1;
      },

      /**
       * @param  {object} s1 event context
       * @param  {object} s2 event context
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
        // remove this object from the eventQueue
        var ref = this.removeObj(obj);
        if (debug && true) {
          console.log('- resolve event context[' + this.render(obj) + '], q'+this.length);
        }
        // resolve its deferred if set
        if (obj.deferred != null) {
          return obj.deferred.resolve(returnValue);
        }
        // always return a resolved deferred
        return $.Deferred().resolve(returnValue);
      },

      lastEntry: null
    });
  };

  /** 
   * The eventQueue is used:
   * - to stop the hashChanged listener from firing for certain hash changes
   * - to enable promises on certain event
   * - to bridge promises between fire_ and handler_
   */
  this['eventQueue'] = this.createEventQueue();

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
  this.fire_hashUpdate = function(options, push, eventContext) {
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
    var localContext = this.eventQueue.pushOrMerge({
      'key': 'hash:'+hash,
      'comment': 'localContext for fire_hashUpdate'
    }, eventContext);
    // if hash would have no effect (would not trigger handler_hashChanged)
    if (this.hashEquals(this.getHash(), hash)) {
      return this.eventQueue.resolve(localContext);
    } else {
      // fire event: change the window.location.hash, allow handler_ to resolve context
      if (push) {
        History.pushState({}, null, this.export.stringHASHBANG + hash);
      } else {
        // -- doesn't always work!
        History.replaceState({}, 'Image', this.export.stringHASHBANG + hash);
        // have to read it back and check; History hashes come back without #
        readback = History.getHash();
        if ((this.export.stringHASHBANG + hash) != ('#'+readback)) {
          // -- leaves a messy history trail
          window.location.hash = this.export.stringHASHBANG + hash;
        }
      }
      // localContext is resolved by handler_hashChanged
      return localContext.deferred;
    }
  };

  /**
   * @return {real} height of viewport in pixels
   */
  this.getViewportHeight = function(force) {
    if (this.getViewportHeight_static == undefined || force) {
      var jqYard = $('#sfun-yardstick-y');
      if (jqYard.length) {
        this.getViewportHeight_static = jqYard.height();
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
  this.getViewportWidth = function(force) {
    if (this.getViewportWidth_static == undefined || force) {
      var jqYard = $('#sfun-yardstick-x');
      if (jqYard.length) {
        this.getViewportWidth_static = jqYard.width();
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
  this.fire_scrollUpdate = function(target, eventContext) {
    var that = this;
    // create a context, but parent it only if eventContext is not undefined
    var localContext = this.eventQueue.pushOrMerge({
      'key': 'scroll:'+'x='+target.left+'&y='+target.top,
      'comment': 'localContext for fire_scrollUpdate',
      'expires': this.eventQueue.getTime() + this.eventQueue.TIMEOUT_expireEVENT
    }, eventContext);
    // fire event: change the scroll position (comes through as single event)
    $document.scrollLeft(target.left);
    $document.scrollTop(target.top);
    // localContext is resolved by handler_scrolled
    return localContext.deferred;
  };

  /**
   * change the visible portion of the page by moving the scrollbars
   * @param {int} key to fire press event for
   * @param {object} [eventContext] optional event context for decorating an existing deferred
   * @return {object} jQuery deferred
   */
  this.fire_keyPress = function(key, eventContext) {
    var e = jQuery.Event( 'keydown', { which: key } );
    var localContext = this.eventQueue.pushOrMerge({
      key: 'keypress:key='+key,
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
  this.handler_hashChanged = function(hash, forceChange) {
    var that = this;
    // apply argument defaults
    if (forceChange == undefined) {
      forceChange = false;
    }
    // get context if we created the event, invent if it was user generated
    var eventContext = this.eventQueue.getOrInvent({
      'key': 'hash:'+hash,
      'comment': 'invented context for handler_hashChanged'
    });
    var wrapUp = function() {
      // return via resolve
      return that.eventQueue.resolve(eventContext);
    }
    // start with defaults
    var obj = this.getDefaults();
    // overwrite with current hash values
    var fromHash = this.hashParse(hash);
    // check the hash values are valid, fallback to defaults if not
    if (!this.hashValidate(fromHash)) {
      console.log('illegal hash values, falling back to defaults');
    }
    this.merge(obj, fromHash);
    // update previous values if changed
    var cdirection = this.getDirection(), cbreadth = this.getBreadth(), cseq = this.getSeq(), coffseq = this.getOffseq();
    if (cdirection != obj.direction) {
      this.previous['direction'] = cdirection;
    }
    if (cbreadth != obj.breadth) {
      this.previous['breadth'] = cbreadth;
    }
    if (cseq != obj.seq) {
      this.previous['seq'] = cseq;
    }
    if (coffseq != obj.offseq) {
      this.previous['offseq'] = coffseq;
    }
    // stage 1: apply [hash] state to DOM
    // direction changes potentially affect ??? images
    var directionChanged = this.setDirection(obj.direction);
    // breadth changes potentially affect all images
    var breadthChanged = this.setBreadth(obj.breadth);
    // seq changes at most only affect the image being selected
    var seqChanged = this.setSeq(obj.seq);
    // seqoffset changes at most only affect the images being viewed
    var offseqChanged = this.setOffseq(obj.offseq);
    // updates based on certain types of change
    if (breadthChanged || directionChanged || forceChange) {
      // clear cell-specific dimensions and read back positions
      this.cellsClear();
      this.visTableMajor.updateAll(this.getDirection(), $sfun_selectablecell);
    }
    // find out if we should trigger other events based on this hash change
    if (this.eventQueue.actOnContext(eventContext)) {
      // update images based on what changed
      if (seqChanged || offseqChanged || breadthChanged || directionChanged || forceChange) {
        // scroll to the selected image, which triggers refresh on all .visible images
        return this.envisionSeq(obj.seq, obj.offseq).done(wrapUp);
      // } else {
      //   // if nothing's changed, at least refresh visible images (e.g. first load from seq=0)
      //   return this.refreshVisibility(0).done(wrapUp);
      }
    }
    return wrapUp();
  }

  /**
   * process or buffer events generated by window scrolling
   * @return {object} jQuery deferred
   * downstream of: EVENT scroll
   */
  this.handler_scrolled = function(event) {
    var that = this;
    var sx = $document.scrollLeft(), sy = $document.scrollTop();
    // get context if we created the event, invent if it was user generated
    var eventContext = this.eventQueue.getOrInvent({
      'key': 'scroll:'+'x='+sx+'&y='+sy,
      'comment': 'invented context for handler_scrolled'
    });
    var wrapUp = function() {
      return that.eventQueue.resolve(eventContext);
    }
    // process this event if we're meant to
    if (this.eventQueue.actOnContext(eventContext)) {
      // don't process scroll event every time, buffer (dump duplicates)
//       this.buffer('handler_scrolled_eventProcess',
//       // function to execute if/when we are processing this event
//       function() {
        return that.handler_scrolled_eventProcess(event, sx, sy).done(wrapUp);
//       },
//       // function to execute if we're dumping this event
//       wrapUp, 250);
    } else {
      // if we're not acting on the context, wrap it up
      return wrapUp();
    }
  }

  /**
   * actually process the events
   * @return {object} jQuery deferred
   * downstream of: EVENT scroll
   */
  this.handler_scrolled_eventProcess = function(event, sx, sy) {
    // invert deltas to match scroll wheel
    if (this.scroll_lastX == undefined) {
      event.deltaX = 0 - sx;
      event.deltaY = 0 - sy;
    } else {
      event.deltaX = 0 - (sx - this.scroll_lastX);
      event.deltaY = 0 - (sy - this.scroll_lastY);
    }
    event.deltaFactor = 1;
    // remember scroll coords for next time
    this.scroll_lastX = sx;
    this.scroll_lastY = sy;
    if (debug && false) {
      console.log('scroll dx[' + event.deltaX + '] dy[' + event.deltaY + '] factor[' + event.deltaFactor + ']');
    }
    // see if scroll has made any new images visible
    var scrolldir = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? 0 - event.deltaX : 0 - event.deltaY);
    return this.refreshVisibility(scrolldir);
  };

  /**
   * process events generated by mouse wheel scrolling
   * downstream of: EVENT mouse wheeled
   * @return {object} jQuery deferred
   */
  this.handler_mouseWheeled = function(event) {
    var that = this;
    var cellsnap = true;
    // work out what direction we're applying this mouse-wheel scroll to
    var direction = this.getDirection();
    // active mousewheel reaction is dependent on which direction we're flowing in
    if (direction == 'x') {
      event.preventDefault();
      // invent context as all mouse wheel events are user generated
      var eventContext = this.eventQueue.invent({
        'key': 'wheel:dir='+direction,
        'comment': 'invented context for handler_mouseWheeled'
      });
      var wrapUp = function() {
        return that.eventQueue.resolve(eventContext);
      }
      var xpos = $document.scrollLeft();
      // get current cell size
      var cellsize = this.getCellSize();
      // if not currently aligned to cells, get extra gap to next cell boundary
      var scrolldir = 0 - event.deltaY;
        // @todo include extra
      // optional debugging
      if (debug && false) {
        console.log('wheel dx[' + event.deltaX + '] dy[' + event.deltaY + '] factor[' + event.deltaFactor + ']');
      }
      // calculate increment based on cell snap
      var increment;
      if (cellsnap) {
        // if scrolling right/fwd (+ve), align to right edge; if scrolling left/back (-ve), align to left
        var extra = this.getCellAlignExtra(scrolldir, scrolldir > 0 ? xpos + this.getViewportWidth() : xpos);
        increment = xpos + (scrolldir * cellsize) + extra;
      } else {
        increment = xpos + (scrolldir * event.deltaFactor * this.export.scrollMULTIPLIER);
      }
      // get current x position, increment and write back, firing scroll event
      return this.fire_scrollUpdate( { 'left': increment, 'top':0 } ).done(wrapUp);
    }
    return $.Deferred().resolve();
  }

  /**
   * process events generated by key presses
   * downstream of: EVENT key pressed
   * @return {object} jQuery deferred
   */
  this.handler_keyPressed = function(event) {
    var that = this;
    // create an event context for this handler, or use stored one
    var eventContext = this.eventQueue.getOrInvent({
      'key': 'keypress:'+'key='+event.which,
      'comment': 'invented context for handler_keyPressed'
    });
    var wrapUp = function() {
      return that.eventQueue.resolve(eventContext);
    }
    // optional debugging information
    if (debug && false) {
      console.log('keydown event code['+event.which+']');
    }
    // process key press
    switch (event.which) {
      case that.export.KEY_ARROW_LEFT:
        if (!event.altKey) {
          event.preventDefault();
          // advance to previous image
          return that.imageAdvanceBy(-1, eventContext).done(wrapUp);
        }
        break;
      case that.export.KEY_ARROW_UP:
        if (event.altKey) {
          event.preventDefault();
          that.urlChangeUp();
        }
        break;
      case that.export.KEY_ARROW_RIGHT:
      case that.export.KEY_TAB:
      case that.export.KEY_ARROW_DOWN:
        // advance to next image
        event.preventDefault();
        return that.imageAdvanceBy(1, eventContext).done(wrapUp);
      case that.export.KEY_PAGE_UP:
        if (!event.ctrlKey) {
          event.preventDefault();
          return that.imageAdvanceBy(-1 * that.getCountMajor() * that.getBreadth(), eventContext).done(wrapUp);
        }
        break;
      case that.export.KEY_PAGE_DOWN:
        if (!event.ctrlKey) {
          event.preventDefault();
          return that.imageAdvanceBy(1 * that.getCountMajor() * that.getBreadth(), eventContext).done(wrapUp);
        }
        break;
      case that.export.KEY_HOME:
        event.preventDefault();
        return that.imageAdvanceTo(0, eventContext).done(wrapUp);
      case that.export.KEY_END:
        event.preventDefault();
        return that.imageAdvanceTo(that.getTotalEntries()-1, eventContext).done(wrapUp);
      case that.export.KEY_RETURN:
        event.preventDefault();
        return that.imageToggleFullscreen(eventContext).done(wrapUp);
      case that.export.KEY_NUMBER_1:
        event.preventDefault();
        return that.fire_hashUpdate( { 'breadth': 1 }, false, eventContext).done(wrapUp);
      case that.export.KEY_NUMBER_2:
        event.preventDefault();
        returnthat.fire_hashUpdate( { 'breadth': 2 }, false, eventContext).done(wrapUp);
      case that.export.KEY_NUMBER_4:
        event.preventDefault();
        return that.fire_hashUpdate( { 'breadth': 4 }, false, eventContext).done(wrapUp);
      case that.export.KEY_NUMBER_8:
        event.preventDefault();
        return that.fire_hashUpdate( { 'breadth': 8 }, false, eventContext).done(wrapUp);
    }
    return wrapUp();
  }

  // ------------------
  // FUNCTIONS: helpers
  // ------------------

  /**
   * substitute values into a mustache template
   * @param  {string} template in mustache format
   * @param  {object} view collection of values to substitute
   * @return {string} output after substitution
   */
  this.substitute = function(template, view) {
    var output = Mustache.render(template, view);
    return output;
  }

  /**
   * merge into obj1
   * overwrites obj1's values with obj2's and adds obj2's if non existent in obj1
   * @param obj1
   * @param obj2
   */
  this.merge = function(obj1, obj2){
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
  this.buffer = function(name, successCallback, dropCallback, timeout) {
    // option to disable buffer
    var disabled = false;
    if (disabled) {
      return successCallback();
    }
    // reschdule is important when dragging, because the events come thick and fast
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
   * @param {jQuery} jqEntity the cell
   * @param {bool} True to include partially visible cells
   * @return {bool} True if this image is currently visible in the viewport
   */
  this.isVisible = function(jqEnt, partial) {
    if (jqEnt.hasClass('visible')) return true;
    if (partial && jqEnt.hasClass('vispart')) return true;
    return false;
  }

  /**
   * @param string
   *          to search within
   * @param string
   *          to search for
   * @return true if the haystack ends with the needle
   */
  this.endswith = function(haystack, needle) {
    // roll on ECMAScript 6
    return haystack.indexOf(needle, haystack.length - needle.length) !== -1;
  }

  /**
   * strip any of the characters used in the stringHASHBANG from the start of the hash
   * @param {string} hash to strip
   * @return {string} stripped output
   */
  this.stripBang = function(hash) {
    var output;
    // re = new RegExp('/^['+this.export.stringHASHBANG+']*/','g');
    re = new RegExp('^['+this.export.stringHASHBANG+']','g');
    output = hash.replace(re,'');
    return output;
  }

  /**
   * @return {string} browser's hash without whatever stringHASHBANG we're using
   */
  this.getHash = function() {
    return this.stripBang(History.getHash());
  }

  /**
   * @return {string} browser's hash minus a few attributes
   */
  this.getFilteredHash = function() {
    return this.getHash();
  }

  // ---------------------
  // FUNCTIONS: deprecated
  // ---------------------

  // -----------------
  // FUNCTIONS: External API
  // -----------------

  var that = this;
  this.export = {
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

    KEY_ARROW_LEFT: 37,
    KEY_ARROW_RIGHT: 39,
    KEY_ARROW_UP: 38,
    KEY_ARROW_DOWN: 40,
    KEY_TAB: 9,
    KEY_HOME: 36,
    KEY_END: 35,
    KEY_PAGE_UP: 33,
    KEY_PAGE_DOWN: 34,
    KEY_SHIFT: 16,
    KEY_CTRL: 17,
    KEY_ALT: 18,
    KEY_RETURN: 13,
    KEY_NUMBER_1: 49,
    KEY_NUMBER_2: 50,
    KEY_NUMBER_4: 52,
    KEY_NUMBER_8: 56,

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
      var output = that.substitute(obj.template, obj.view);
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
      that.layoutManager.push(obj);
      // allow element to bind its handlers
      obj.callback.call(obj.context, $sfun_selectablecell);
    },

    /**
     * @return {object} jQuery object for cell
     */
    'api_getCell': function(seq) {
      return $img(seq);
    },

    /**
     * @return {string} direction of current view
     */
    'api_getDirection': function() {
      return that.getDirection();
    },

    /**
     * @return {int} breadth of current view
     */
    'api_getBreadth': function() {
      return that.getBreadth();
    },

    /**
     * @return {int} return viewport width/height
     */
    'api_getViewportWidth': function() {
      return that.getViewportWidth();
    },
    'api_getViewportHeight': function() {
      return that.getViewportHeight();
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
      return that.getTotalEntries();
    },

    /**
     * @return {float} number of cells on the major axis
     */
    'api_getCountMajor': function() {
      return that.getCountMajor();
    },

    /**
     * @return {object} visibility table for major axis
     */
    'api_getVisTableMajor': function() {
      return that.visTableMajor;
    },

    /**
     * @param {object} jqEnt cell to check (and re-set) bounds for
     */
    'api_setBound': function(jqEnt) {
      return that.setBound(jqEnt);
    },

    /**
     * helper function to make testing key presses easier
     */
    'api_triggerKeypress': function(key) {
      return that.fire_keyPress(key);
    },

    /**
     * fire scroll update
     * @param  {object} pos  {left, top} new scroll coordinate
     * @param  {boolean} numb true to numb listener
     * @return {object} jQuery deferred
     */
    'api_triggerScroll': function(pos, numb) {
      if (numb == undefined) {
        numb = false;
      }
      if (numb) {
        // create a null context to numb the event listener
        var localContext = that.eventQueue.push({
          'replaceEvent': function(){},
          'comment': 'localContext for api_triggerScroll, numb listener'
        });
        return that.fire_scrollUpdate(pos, localContext);
      }
      return that.fire_scrollUpdate(pos);
    },
 
    /**
     * jump to a specific image
     * @param {int} seq image to advance to
     */
    'api_imageAdvanceTo': function(seq) {
      return that.imageAdvanceTo(seq);
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
      return that.createVisTable();
    },

    // no comma on last entry
    lastEntry: true
  };

  // call init function then return API object
  this.init();
  return this.export;

})(jQuery, undefined);