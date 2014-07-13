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

  var debug = true;

  // default values for view state
  this.default = [];

  // the previous values for the view state (1 generation)
  this.previous = [];

  // ms to wait after resize event before re-bound/re-res
  this.resizeTimeout = null;
  // for screenpc width/height, set using px/pc
  this.setScreenPcUsing = null;

  // ---------
  // FUNCTIONS
  // ---------

  this.init = function() {
    var that = this;
    // initialise vars
    this.setScreenPcUsing = 'pc';
    $(document).ready(function() {
      // process state in page HTML next
      that.previous['direction'] = that.default['direction'] = that.getDirection();
      that.previous['breadth'] = that.default['breadth'] = that.getBreadth();
      that.previous['seq'] = that.default['seq'] = 0;
      // bind to page
      that.bindToScroll();
      that.bindToHeaderLinks();
      that.bindToHotKeys();
      that.bindToHashChange();
      that.bindToImageLinks();
      // if we're sideways scrolling, bind to scroll event
      that.setDirection(that.getDirection());
      // find all screenpc elements, extract pc and store as data- attribute
      that.cellsInit();
      // on page load, browser will scroll to the top, prepare to jump back
      that.eventQueue.push({
        key: 'scroll:x=0&y=0',
        comment: 'nullify false scroll event',
        replaceEvent: function() {
          // manually jump back to the right place by firing handler_hashChanged
          that.handler_hashChanged(that.getHash()).done(function() {
            // need to force back to correct position
            that.setScrollPosition(that.getSeq());            
          });
        }
      });
      // process state if set in URL (hash) first
      that.handler_hashChanged(that.getHash());
      // execute queue of API calls
      that.export.flush();
      // attach listener to window for resize (rare, but should update)
      $(window).resize(function() {
        // if we're already timing out, delay for another x milliseconds
        if (that.resizeTimeout != null) {
          clearTimeout(this.resizeTimeout);
        }
        that.resizeTimeout = setTimeout(function() {
          // resize may have shown more images, so refresh visibility
          that.refreshVisibility(0);
        }, 50); // 50 ms
      });
    });
  };

  // ----------------
  // FUNCTIONS: cells
  // ----------------

  /**
   * initialise the cells
   */
  this['cellsInit'] = function() {
    var that = this;
    $('ul.flow .selectablecell').each(function() {
      that.cellsGenerateDataPerc($(this));
    });
    // not currently using this
    // cells are simple percentages
    // cellsRefresh();
  };

  /**
   * Extract percentage and store as data- attribute
   * @param {object} Query object
   * @param {string} {width|height} axis to extract percentage for
   */
  this['cellsGenerateDataPerc'] = function(jqEnt) {
    var pc
    pc = jqEnt.width() * 100 / $(window).width();
    jqEnt.data('screenpc-width', pc);
    pc = jqEnt.height() * 100 / $(window).height();
    jqEnt.data('screenpc-height', pc);
  };

  /**
   * @todo this currently assume that every cell is the same width on the major axis
   * @return {float} number of cells along the major axis
   */
  this['cellsCountMajor'] = function() {
    var direction = this.getDirection();
    var jqEnt = $('ul.flow .selectablecell:first');
    if (direction == 'x') {
      var pc = parseInt(jqEnt.data('screenpc-width'));
    } else {
      var pc = parseInt(jqEnt.data('screenpc-height'));
    }
    return (100 / pc);
  };

  // ------------------
  // FUNCTIONS: refresh
  // ------------------

  /**
   * update (x/y)-bound on boundable image in cell
   * @param jQuery cell that may have changed size
   * @return {object} $.Deferred
   */
  this['refreshBounds'] = function(jqEnt) {
    // find boundable entity
    var jqBoundable = jqEnt.find('.boundable');
    if (jqBoundable.length) {
      // 1. update loaded resolution if necessary first
      if (jqBoundable.data('loaded-width') == undefined || jqBoundable.data('loaded-height') == undefined) {
        // if getLoadedResolution succeeds, use loaded-width/height
        return this.getLoadedResolution(jqEnt).done(function() {
          // read container width/height
          var cx = jqEnt.width(), cy = jqEnt.height();
          var cratio = cx / cy;
          // detect if the image is bound by width/height in this container
          var ix = jqBoundable.data('loaded-width'), iy = jqBoundable.data('loaded-height');
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
        });
      }
    }
    // return a resolved deferred
    return $.Deferred().resolve();
  };

  /**
   * Read data about the image and update metric display
   * @param {object} jqEnt jQuery object for image
   */
  this['refreshMetric'] = function(jqEnt) {
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
  this['refreshMetricPosition'] = function(jqEnt) {
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
  this['refreshVisibility'] = function(scrolldir) {
    var that = this;
    // always test all images for visibility
    return this.setVisibleAll().always(function() {
      that.refreshSelected(scrolldir);
    });
  };

  /** 
   * refresh the selected entry after a visibility change
   * @param {int} scrolldir direction of scroll (+ve/-ve) or 0 for no scroll
   * @return {object} jQuery deferred
   */
  this['refreshSelected'] = function(scrolldir) {
    var jqEnt = $('ul.flow .selectablecell.selected');
    if (!jqEnt.hasClass('visible')) {
      if (debug && false) {
        console.log('previously selected image '+jqEnt.data('seq')+' no longer visible');
      }
      // find the next visible one in the scroll direction
      jqEnt = $('ul.flow .selectablecell.visible:'+(scrolldir > 0 ? 'first' : 'last'));
      if (jqEnt.length) {
        // create and resolve a local context to allow us to numb listener
        var localContext = eventQueue.push({
          'replaceEvent': function(){},
          'comment': 'localContext for refreshSelected (image-'+jqEnt.data('seq')+')'
        });
        // use hash to select new and deselect old, but numb listener and parent deferred
        return that.imageAdvanceTo(jqEnt.data('seq'), localContext);
      }
    }
    return $.Deferred().resolve();
  };

  /**
   * Check the display resolution of the image and swap out src if higher res available 
   * @return {object} jQuery deferred
   */
  this['refreshResolution'] = function(jqEnt) {
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
    // request for metadata, but only do stuff if we get metadata back
    return this.refreshMetadata(jqEnt).done(function() {
      // fetch loaded, native and current image dimensions
      var loadedWidth = jqReresable.data('loaded-width');
      var loadedHeight = jqReresable.data('loaded-height');
      var nativeWidth = jqReresable.data('native-width');
      var nativeHeight = jqReresable.data('native-height');
      var imageWidth = jqReresable.width() * window.devicePixelRatio;
      var imageHeight = jqReresable.height() * window.devicePixelRatio;
      // analyse
      var resbracket = 250, brackWidth, brackHeight;
      var bigger = imageWidth > loadedWidth || imageHeight > loadedHeight;
      var available = loadedWidth < nativeWidth || loadedHeight < nativeHeight;
      // optional debugging
      if (debug && false) {
        console.log('image-'+jqEnt.data('seq')+': checking resolution w['+imageWidth+'] h['+imageHeight+'] nativeWidth['+nativeWidth+'] nativeHeight['+nativeHeight+'] loadedWidth['+loadedWidth+'] loadedHeight['+loadedHeight+']');
      }
      // test to see if we're displaying an image at more than 100%
      if (bigger && available) {
        // only need to think about one dimension, because ratio of image is fixed
        var majorw = (imageWidth >= imageHeight);
        // but that dimension has to be the major dimension 
        if (majorw) {
          // find the smallest resbracket less than nativeWidth, but greater that loadedWidth
          brackWidth = Math.min(Math.ceil(imageWidth/resbracket) * resbracket, nativeWidth);
          // could have resized down, so only swap the image if the brackWidth is greater that the current loaded
          if (brackWidth > loadedWidth) {
            // swap out image, but don't wait for swap to complete
            return that.imageReres(jqEnt, jqReresable.data('base-src') + 'maxwidth='+brackWidth);
          }
        } else {
          // same but pivot on height rather than width
          brackHeight = Math.min(Math.ceil(imageHeight/resbracket) * resbracket, nativeHeight);
          if (brackHeight > loadedHeight) {
            // swap out image, but don't wait for swap to complete
            return that.imageReres(jqEnt, jqReresable.data('base-src') + 'maxheight='+brackHeight);
          }
        }
      }
      // if we didn't swap out this image, update imgmetric
      // @todo maybe can comment this
      return that.refreshMetric(jqEnt);
    });
  };

  /**
   * Request metadata about this image from the server if we don't have it
   * @return {object} jQuery deferred
   */
  this['refreshMetadata'] = function(jqEnt) {
    var that = this;
    var jqReresable = jqEnt.find('.reresable');
    if (jqReresable.length) {
      // test to see if we have the metadata
      if (typeof(jqReresable.data('native-width')) == 'undefined' || typeof(jqReresable.data('native-height')) == 'undefined') {
        var deferred = $.Deferred();
        // fire ajax request
        $.ajax({
          url: jqReresable.attr('src').replace('image','imagemeta'),
          dataType: 'json',
        })
        .done(function( data ) {
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
        });
        if (debug && false) {
          console.log('image-'+jqEnt.data('seq')+': fired request for native width and height');
        }
        return deferred;
      }
    }
    return $.Deferred().resolve();
  };

  /**
   * refresh a single image, but ensure that it's loaded first
   * @param {object} jqEnt jquery entity
   * @param {boolean} reres also refresh the image's resolution
   * @return {object} jQuery deferred
   */
  this['refreshImage'] = function(jqEnt, reres) {
    // final stage is to refresh the metric
    var doMetric = function() {
      // update metric
      that.refreshMetric(jqEnt);
      that.refreshMetricPosition(jqEnt);
    };
    // refresh the bounds of the image
    return this.refreshBounds(jqEnt).always(function() {
      if (reres) {
        // change out the image for a better resolution if one's available
        that.refreshResolution(jqEnt).always(doMetric);        
      } else {
        doMetric();
      }
    });
  };

  /**
   * refresh all visible images
   * @param {object} jqEnt jquery entity
   * @return {object} jQuery deferred
   */
  this['refreshVisibleImages'] = function() {
    var that = this;
    var jqVisibles = $('ul.flow .selectablecell.visible');
    if (jqVisibles.length) {
      var deferred = $.Deferred();
      var defs = [];
      jqVisibles.each(function() {
        var jqEnt = $(this);
        defs.push(that.refreshImage(jqEnt, true));
      });
      $.when.apply($, defs).always(function() {
        deferred.resolve();
      })
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
  this['bindToScroll'] = function() {
    var that = this;
    $(window).scroll(function(event) {
      that.handler_scrolled(event);
      event.preventDefault();
    });
    $(window).mousewheel(function(event) {
      that.handler_mouseWheeled(event);
      event.preventDefault();
    });
  };

  /**
   * turn header links into clickable buttons
   */
  this['bindToHeaderLinks'] = function() {
    var that = this;
    // fade out header, then setup hover listeners
    $('.header').css('opacity', 0.5).hover(function(event) {
      // animate header open to full screen width
      $(this).stop(true, false).animate( { width: '100%', opacity: 1.0 }, 100);
      event.preventDefault();      
    }, function(event) {
      // leave header up for 2s, then collapse back down
      $(this).stop(true, false).delay(2000).animate( { width: '2.0em', opacity: 0.5 }, 100);
    });
    // horizontal or vertical layout
    $('#flow-x').click(function(event) {
      that.setDirection('x');
      that.checkVisibleImages(false);
      event.preventDefault();
    });
    $('#flow-y').click(function(event) {
      that.setDirection('y');
      that.checkVisibleImages(false);
      event.preventDefault();
    });
    // light or dark theme
    $('#theme-light').click(function(event) {
      $('html').removeClass('theme-dark');
      event.preventDefault();
    });
    $('#theme-dark').click(function(event) {
      $('html').addClass('theme-dark');
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
  this['bindToHotKeys'] = function() {
    var that = this;
    $(document).keydown(function(event) {
      that.handler_keyPressed(event);
    });
  };

  /**
   * listen for changes to the hash
   * see https://github.com/browserstate/history.js
   */
  this['bindToHashChange'] = function() {
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
  this['bindToImageLinks'] = function() {
    var that = this;
    // bind to click using delegated event handler (http://api.jquery.com/on/), instead of individual N handlers
    $('ul.flow').on('click', '.selectablecell a.media-container', function(event) {
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
  this['getLoadedResolution'] = function(jqEnt) {
    var jqBoundable = jqEnt.find('.boundable');
    if (jqBoundable.length) {
      // create local context for async processing
      var deferred = $.Deferred();
      // update loaded resolution
      var im = new Image();
      im.onload = function() {
        jqBoundable.data('loaded-width', im.width);
        jqBoundable.data('loaded-height', im.height);
        im = null;
        if (debug && false) {
          console.log('image-'+jqEnt.data('seq')+': loaded resolution updated ['+jqBoundable.data('loaded-width')+','+jqBoundable.data('loaded-height')+']');
        }
        // notify promise of resolution
        deferred.resolve();
      }
      im.src = jqBoundable.attr('src');
      if (debug && false) {
        console.log('image-'+jqEnt.data('seq')+': fired update loaded resolution request');
      }
      // return local context so that when we complete (resolve), our parents can execute
      return deferred;
    }
    return $.Deferred().resolve();
  };

  /**
   * Get the real flow direction, not just what the class says because the browser might not support all directions
   * (needs flexbox)
   * @return current flow direction
   */
  this['getDirection'] = function() {
    var direction = 'y';
    if ($('html').hasClass('flexbox') && $('html').hasClass('flow-x')) {
      direction = 'x';
    }
    return direction;
  };

  /**
   * Get the flow breadth
   * @return current flow breadth
   */
  this['getBreadth'] = function() {
    var breadth = 2;
    var jq = $('ul.flow');
    if (jq.hasClass('flow-1')) breadth = 1;
    if (jq.hasClass('flow-4')) breadth = 4;
    if (jq.hasClass('flow-8')) breadth = 8;
    return breadth;
  };

  /**
   * @return {float} current size of cell along the major axis
   */
  this['getCellSize'] = function() {
    // get first cell
    var jq = $('ul.flow li:first');
    if (this.getDirection() == 'x') {
      return jq.width();
    } else {
      return jq.height();
    }
  };

  /**
   * @param {int} edge majoraxis value of edge to find cell at
   */
  this['getCellAt'] = function(edge) {
    // START HERE
    // think hashTable of cell edges, zero-based
  };

  /** 
   * @param {int} scrolldir Direction [and amount] of scroll
   * @param {int} edgeAlign majoraxis value of edge to align to
   */
  this['getCellAlignExtra'] = function(scrolldir, edgeAlign) {
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
   * @return {jQuery} selected entity
   */
  this['getSelected'] = function() {
    var jqEnt = $('ul.flow .selectablecell.selected')
    return jqEnt;
  };

  /**
   * @return {int} sequence number of currently selected cell
   */
  this['getSeq'] = function() {
    var jqEnt = this.getSelected();
    // jq.data returns undefined (not 0) if not set, so first-run safe
    return jqEnt.data('seq');
  };

  /**
   * @return {int} total number of entities (max entry seq+1)
   */
  this['getTotalEntries'] = function() {
    var jq = $('ul.flow .selectablecell:last')
    return (parseInt(jq.data('seq'))+1);
  };

  /**
   * @return {string} type of entity
   */
  this['getType'] = function(jqEnt) {
    if (jqEnt.hasClass('image-type')) {
      return 'image';
    } else if (jqEnt.hasClass('video-type')) {
      return 'video';
    } else if (jqEnt.hasClass('directory-type')) {
      return 'directory';
    }
  };

  /**
   * return a shared deferred if one exists, or create one if not
   * @return {jQuery} deferred
   */
  this['getDeferred'] = function() {
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
  this['setDirection'] = function(direction) {
    var invdir = (direction == 'x' ? 'y' : 'x');
    $('.flow').addClass('flow-' + direction).removeClass('flow-' + invdir);
  };

  /**
   * set the width of the screen flow
   * e.g. number of cells vertically if in vertical mode
   * downstream of: EVENT
   */
  this['setBreadth'] = function(breadth) {
    var changed = (this.getBreadth() !== breadth);
    if (!changed) return false;
    // remove all the other breadths
    for (var i=1 ; i <= 8 ; i=i*2) {
      // don't remove the breadth we're setting
      if (i == breadth) {
        continue;
      }
      $('.flow').removeClass('flow-'+i);
    }
    $('.flow').addClass('flow-' + breadth);
    return changed;
  };

  /**
   * @param int sequence number of image to make current
   * downstream of: EVENT
   */
  this['setSeq'] = function(seq) {
    var changed = (this.getSeq() !== seq);
    if (!changed) return false;
    var jqCurrent, position;
    // deselect old image
    $('ul.flow .selectablecell.selected').removeClass('selected');
    // select new image
    jqCurrent = $('#seq-'+seq);
    jqCurrent.addClass('selected');
    return changed;
  };

  /** 
   * ensure that a given image lies within the current viewport
   * @param {int} seq image sequence number
   * downstream of: EVENT
   * @return {object} jQuery deferred
   */
  this['setScrollPosition'] = function(seq) {
    var jqEnt = $('#seq-'+seq);
      // if we found the cell
    if (jqEnt.length) {
      if (!this.isVisible(jqEnt, true)) {
        if (this.getDirection() == 'x') {
          // get coordinate of selected image's cell
          position = jqEnt.offset();
          return this.fire_scrollUpdate(position.left, 0);
        } else {
          position = jqEnt.offset();
          return this.fire_scrollUpdate(0, position.top);
        }
      } else {
        // manually refresh the visible images
        return this.refreshVisibility(0);
      }
    }
    return $.Deferred().resolve();
  };

  /**
   * Loop through all images
   * @todo optimise
   * @return {object} jQuery deferred
   */
  this['setVisibleAll'] = function() {
    var that = this;
    var jqCells = $('ul.flow .selectablecell');
    if (jqCells.length) {
      var deferred = $.Deferred();
      var defs = [];
      // clear all the visible images
      jqCells.removeClass('visible');
      // then recalculate them
      jqCells.each(function() {
        var jqEnt = $(this);
        if (that.isVisible(jqEnt, true)) {
          defs.push(that.setVisibleImage(jqEnt, 'visible'));
        } else {
          // don't test, because setVis(false) is just a .removeClass()
          defs.push(that.setVisibleImage(jqEnt, 'not-visible'));
        }
      });
      // aggregate all the deferreds
      $.when.apply($, defs).always(function() {
        deferred.resolve();
      });
      // now request nearvis images, but don't wait for them (async, not resync)
      var cellcount = that.getTotalEntries();
      // hunt for first and last visible
      var first_np1 = $('ul.flow .selectablecell.visible:first').data('seq'), last_0 = $('ul.flow .selectablecell.visible:last').data('seq');
      // compute those near the last visible
      var last_1 = (last_0 + 1) % cellcount;
      var last_n = (last_0 + that.getBreadth() * that.export.BREADTH_MULTIPLIER) % cellcount;
      var first_n = negative_mod(first_np1 - 1, cellcount);
      var first_1 = negative_mod(first_np1 - that.getBreadth() * that.export.BREADTH_MULTIPLIER, cellcount);
      // catch situation where wraparound means that for loop won't work
      if (last_1 > last_n) {
        last_n = cellcount-1;
      }
      if (first_n < first_1) {
        first_n = 0;
      }
      // optional debugging
      if (debug && false) {
        console.log('images-('+first_1+' to '+first_n+'): making nearvis (before visibles)');
      }
      if (debug && false) {
        console.log('images-('+last_1+' to '+last_n+'): making nearvis (after visibles)');
      }
      // request nearvis (after visibles), async
      for (var i = last_1 ; i <= last_n ; i++) {
        that.setVisibleImage($('#seq-'+i), 'nearvis');
      }
      // request nearvis (before visibles), async
      for (var i = first_1 ; i <= first_n ; i++) {
        that.setVisibleImage($('#seq-'+i), 'nearvis');
      }
      return deferred;
    }
    return $.Deferred().resolve();
  };

  /**
   * either flag an image as visible or not visible
   * @param {jQuery} jqEnt image
   * @param {string} 'visible' true to make visible, 'not visible' to hide
   *   or 'nearvis' to make visible but not re-res
   * @return {object} jQuery deferred
   */
  this['setVisibleImage'] = function(jqEnt, vis) {
    if (debug && false) {
      console.log('image-'+jqEnt.data('seq')+': making '+vis);
    }
    // process visibility string
    if (vis == 'not-visible') {
      // make it not-visible
      jqEnt.removeClass('visible');
    } else {
      // vis/nearvis: make its src show, if not there already
      var jqReresable = jqEnt.find('.reresable');
      if (jqReresable.length) {
        var attr = jqReresable.attr('src');
        if (typeof attr === 'undefined' || attr === false) {
          jqReresable.attr('src', jqReresable.data('desrc'));
        }
      }
      if (vis == 'nearvis') {
        // mark image as near visible
        jqEnt.addClass('nearvis');
        // refresh image, but don't update its resolution
        return this.refreshImage(jqEnt, false);
      } else if (vis == 'visible') {
        // make it visible (may have previously been nearvis)
        jqEnt.removeClass('nearvis').addClass('visible');
        // when an image becomes visible refresh all its facets
        return this.refreshImage(jqEnt, true);
      }
    }
    return $.Deferred().resolve();
  };

  // --------------------
  // FUNCTIONS: image ops
  // --------------------

  /**
   * Swap out image using a temporary image (to get triggered on load event)
   * Can't just switch src on jqEnt, because that image is already loaded
   * Firebug doesn't show the updated data- attributes, but they are updated
   * @return {object} jQuery deferred
   */
  this['imageReres'] = function(jqEnt, path) {
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
        if (debug && false) {
          console.log('image-'+jqEnt.data('seq')+': swapped out for ('+jqReresable.data('loaded-width')+','+jqReresable.data('loaded-height')+')');
        }
        that.refreshMetric(jqEnt);
        // notify promise of resolution
        deferred.resolve();
      }).each(function() {
        if(this.complete) $(this).load();
      });
      // return local context so that when we complete (resolve), our parents can execute
      return deferred;
    }
    return $.Deferred().resolve();
  };

  /**
   * advance forward or back by a certain number of images in the sequence
   * @param {int} increment positive to go to next, negative for previous
   * @param {object} eventContext optional event context for decorating an existing deferred
   * @return {object} jQuery deferred
   */
  this['imageAdvanceBy'] = function(increment, eventContext) {
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
        return this.imageAdvanceTo(seq, eventContext).then(wrapUp);
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
  this['imageAdvanceTo'] = function(seq, eventContext) {
    // update using hash change
    return this.fire_hashUpdate( { 'seq': seq }, false, eventContext);
  };

  /**
   * switch between the default breadth and fullscreen
   * @param {object} eventContext optional event context for decorating an existing deferred
   * @return {object} jQuery deferred
   */
  this['imageToggleFullscreen'] = function(eventContext) {
    var jqEnt = this.getSelected();
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
  this['urlChangeUp'] = function() {
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
      this.urlGoto(newUrl + this.export.HASHBANG + filteredHash);
    }
    return false;
  };

  /**
   * redirect to another url
   * @param {string} newUrl new location
   */
  this['urlGoto'] = function(newUrl) {
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
  this['hashGenerate'] = function(obj) {
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
   * parse out integers from hash attributes
   * @param {string} hash string
   * @return {object} hash values as an object
   */
  this['hashParse'] = function(hash) {
    var output = {};
    // look for hash arguments
    if (hash.length > 1) {
      // strip leading #! if set
      var hblen = this.export.HASHBANG.length;
      if (hash.substr(0, hblen) == this.export.HASHBANG) {
        hash = hash.substr(hblen);
      }
      // override defaults if set
      var hashpairs = hash.split('&');
      for (var i=0 ; i<hashpairs.length ; ++i) {
        // var eqpos = hashpairs[i].indexOf('=');
        var components = hashpairs[i].split('=');
        // adding elements to an object using array syntax (unknown name)
        output[components[0]] = parseInt(components[1]);
      }
    }
    return output;
  };

  /**
   * check that the values in this object are valid
   * @param {object} hash name:value pairs
   * @return {boolean} true if they're ok
   */
  this['hashValidate'] = function(hash) {
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
  this['createHashTable'] = function(namearg) {
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
        // store in the index array(s)
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
       * @param {string} key to search for
       * @return {int} array reference or -1 if not found
       */
      'find': function(key) {
        var ref = this.keyarr.indexOf(key);
        return ref;
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
       * @return {object} matched object or null if not found
       */
      'get': function(key, alsoRemove) {
        return this._get(key, alsoRemove);
      },

      /** 
       * actually get object from table
       * @param {string} key to search for
       * @param {bool} [alsoRemove] true to delete matched elements
       * @return {object} matched object or null if not found
       */
      '_get': function(key, alsoRemove) {
        var ref = this.find(key);
        if (debug && false) {
          console.log('get requested for key[' + key + ']');
        }
        if (typeof(alsoRemove) == 'undefined') {
          alsoRemove = false;
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

      lastEntry: null
    };
  }

  /**
   * create a specialised hashTable for the eventQueue
   * @return {object} hashTable object
   */
  this['createEventQueue'] = function() {
    return $.extend(this.createHashTable('eventQueue'), {
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
        // comment is an empty string (for rendering)
        'comment': ''
      },

      /**
       * @return {string} render simple string of object
       */
      'render': function(obj) {
        var output = obj.key + ', ' + obj.deferred.state();
        if (obj.comment) {
          output += ', ' + obj.comment;
        }
        if (obj.deps.length) {
          output += ', ' + obj.deps.length + ' deps';
        }
        return output;
      },

      /**
       * push event object onto event queue
       * @param {object} partial fields to override defaults
       */
      'push': function(partial) {
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
          if (debug && true) {
            console.log('- deprecated event context[' + this.render(peer) + '], q'+this.length);
          }
          // aggregate the comments to enable clearer historical tracking
          if (partial.comment) {
            partial.comment += ', was ' + obj.comment;
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
          obj.deferred.then(function() {
            // test to see if parent has outstanding deps
            var ref = parentContext.deps.indexOf(obj);
            if (ref != -1) {
              // delete this dep from parent
              parentContext.deps.splice(ref, 1);
            }
            // if we've resolved all the deps, resolve this promise
            if (parentContext.deps.length == 0) {
              if (debug) {
                console.log('resolved context[' + that.render(obj) + '], resolving parent context[' + that.render(obj.parent) + ']');
              }
              resolve(parentContext);
            } else {
              if (debug) {
                console.log('resolved context[' + that.render(obj) + '], waiting parent context[' + that.render(obj.parent) + ']');
              }              
            }
          });
          if (debug) {
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
            this.resolve(eventContext);
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
       * @return {object} jQuery deferred
       */
      'resolve': function(obj) {
        // remove this object from the eventQueue
        var ref = this.removeObj(obj);
        if (ref != -1 && debug && true) {
          console.log('- resolved event context[' + this.render(obj) + '], q'+this.length);
        }
        // resolve its deferred if set
        if (obj.deferred != null) {
          return obj.deferred.resolve();
        }
        // always return a resolved deferred
        return $.Deferred().resolve();
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
  this['fire_hashUpdate'] = function(options, push, eventContext) {
    var hash = '', fromHash, readback;
    // start with defaults
    var obj = { 'breadth': this.default['breadth'], 'seq': this.default['seq']};
    // overwrite with current hash values
    fromHash = this.hashParse(this.getHash());
    this.merge(obj, fromHash);
    // overwrite with options
    this.merge(obj, options);
    // convert to hash string
    hash = this.hashGenerate(obj);
    // create a context, but parent it only if eventContext is not undefined
    var localContext = eventQueue.pushOrMerge({
      'key': 'hash:'+hash,
      'comment': 'localContext for fire_hashUpdate'
    }, eventContext);
    // fire event: change the window.location.hash
    if (push) {
      History.pushState({}, null, this.export.HASHBANG + hash);
    } else {
      // -- doesn't always work!
      History.replaceState({}, 'Image', this.export.HASHBANG + hash);
      // have to read it back and check; History hashes come back without #
      readback = History.getHash();
      if ((this.export.HASHBANG + hash) != ('#'+readback)) {
        // -- leaves a messy history trail
        window.location.hash = this.export.HASHBANG + hash;
      }
    }
    // localContext is resolved by handler_hashChanged
    return localContext.deferred;
  };

  /**
   * change the visible portion of the page by moving the scrollbars
   * @param {int} left distance from left of page in pixels
   * @param {int} top  distance from top of page in pixels
   * @param {object} [eventContext] optional event context for decorating an existing deferred
   * @return {object} jQuery deferred
   */
  this['fire_scrollUpdate'] = function(left, top, eventContext) {
    // create a context, but parent it only if eventContext is not undefined
    var localContext = eventQueue.pushOrMerge({
      'key': 'scroll:'+'x='+left+'&y='+top,
      'comment': 'localContext for fire_scrollUpdate'
    }, eventContext);
    // fire event: change the scroll position (comes through as single event)
    $(document).scrollLeft(left);
    $(document).scrollTop(top);
    // localContext is resolved by handler_scrolled
    return localContext.deferred;
  };

  /**
   * change the visible portion of the page by moving the scrollbars
   * @param {int} key to fire press event for
   * @param {object} [eventContext] optional event context for decorating an existing deferred
   * @return {object} jQuery deferred
   */
  this['fire_keyPress'] = function(key, eventContext) {
    var e = jQuery.Event( 'keydown', { which: key } );
    var localContext = eventQueue.pushOrMerge({
      key: 'keypress:key='+key,
      'comment': 'localContext for fire_keyPress (keyToPress '+key+')'
    });
    $(document).trigger(e);
    return localContext.deferred;
  }

  // -------------------------
  // FUNCTIONS: event handlers
  // -------------------------

  /**
   * apply hash state (+current values for those unset) to page
   * downstream of: EVENT hash change
   * @param {string} hash that's been updated
   * @return {object} jQuery Deferred
   */
  this['handler_hashChanged'] = function(hash) {
    var that = this;
    // get context if we created the event, invent if it was user generated
    var eventContext = this.eventQueue.getOrInvent({
      'key': 'hash:'+hash,
      'comment': 'invented context for handler_hashChanged'
    }, true);
    var wrapUp = function() {
      return that.eventQueue.resolve(eventContext);
    }
    // first of all find out if we should actually process this hash change
    if (this.eventQueue.actOnContext(eventContext)) {
      // keep track of whether this update could have affected all images and selected images
      var breadthChanged = false;
      var seqChanged = false;
      // start with defaults
      var obj = { 'breadth': this.default['breadth'], 'seq': this.default['seq']};
      // overwrite with current hash values
      var fromHash = this.hashParse(hash);
      // check the hash values are valid, fallback to defaults if not
      if (!this.hashValidate(fromHash)) {
        console.log('illegal hash values, falling back to defaults');
      }
      this.merge(obj, fromHash);
      // update previous values if changed
      var cbreadth = this.getBreadth(), cseq = this.getSeq();
      if (cbreadth != obj.breadth) {
        this.previous['breadth'] = cbreadth;
      }
      if (cseq != obj.seq) {
        this.previous['seq'] = cseq;
      }
      // stage 1: apply [hash] state to DOM
      // breadth changes potentially affect all images
      breadthChanged = this.setBreadth(obj.breadth);
      // seq changes at most only affect the image being selected
      seqChanged = this.setSeq(obj.seq);
      if (seqChanged || breadthChanged) {
        // scroll to the selected image, which triggers refreshImage on all .visible images
        return this.setScrollPosition(obj.seq).then(wrapUp);
      }
      else if (breadthChanged) {
        return this.refreshVisibleImages().then(wrapUp);
      }
    }
    return wrapUp();
  }

  /**
   * process events generated by window scrolling
   * downstream of: EVENT scroll
   */
  this['handler_scrolled'] = function(event) {
    var that = this;
    var sx = $(document).scrollLeft(), sy = $(document).scrollTop();
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
      return this.refreshVisibility(scrolldir).then(wrapUp);
    }
    return wrapUp();
  }

  /**
   * process events generated by mouse wheel scrolling
   * downstream of: EVENT mouse wheeled
   * @return {object} jQuery deferred
   */
  this['handler_mouseWheeled'] = function(event) {
    var that = this;
    // work out what direction we're applying this mouse-wheel scroll to
    var direction = this.getDirection();
    // active mousewheel reaction is dependent on which direction we're flowing in
    if (direction == 'x') {
      // invent context as all mouse wheel events are user generated
      var eventContext = this.eventQueue.invent({
        'key': 'wheel:dir='+direction,
        'comment': 'invented context for handler_mouseWheeled'
      });
      var wrapUp = function() {
        return that.eventQueue.resolve(eventContext);
      }
      var xpos = $(document).scrollLeft();
      // get current cell size
      var cellsize = this.getCellSize();
      // if not currently aligned to cells, get extra gap to next cell boundary
      var scrolldir = 0 - event.deltaY;
      // if scrolling right/fwd (+ve), align to right edge; if scrolling left/back (-ve), align to left
      var extra = this.getCellAlignExtra(scrolldir, scrolldir > 0 ? xpos + $(window).width() : xpos);
      // optional debugging
      if (debug && false) {
        console.log('wheel dx[' + event.deltaX + '] dy[' + event.deltaY + '] factor[' + event.deltaFactor + ']');
      }
      // get current x position, increment and write back, firing scroll event
      return this.fire_scrollUpdate(xpos + (scrolldir * cellsize), 0).then(wrapUp);
    }
    return $.Deferred().resolve();
  }

  /**
   * process events generated by key presses
   * downstream of: EVENT key pressed
   * @return {object} jQuery deferred
   */
  this['handler_keyPressed'] = function(event) {
    var that = this;
    // create an event context for this handler, or use stored one
    var eventContext = this.eventQueue.getOrInvent({
      'key': 'keypress:'+'key='+event.which,
      'comment': 'invented context for handler_keyPressed'
    }, true);
    var wrapUp = function() {
      return that.eventQueue.resolve(eventContext);
    }
return wrapUp();
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
          return that.imageAdvanceBy(-1, eventContext).then(wrapUp);
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
        return that.imageAdvanceBy(1, eventContext).then(wrapUp);
      case that.export.KEY_PAGE_UP:
        if (!event.ctrlKey) {
          event.preventDefault();
          return that.imageAdvanceBy(-1 * that.cellsCountMajor() * that.getBreadth(), eventContext).then(wrapUp);
        }
        break;
      case that.export.KEY_PAGE_DOWN:
        if (!event.ctrlKey) {
          event.preventDefault();
          return that.imageAdvanceBy(that.cellsCountMajor() * that.getBreadth(), eventContext).then(wrapUp);
        }
        break;
      case that.export.KEY_HOME:
        event.preventDefault();
        return that.imageAdvanceTo(0).then(wrapUp);
      case that.export.KEY_END:
        event.preventDefault();
        return that.imageAdvanceTo(that.getTotalEntries()-1, eventContext).then(wrapUp);
      case that.export.KEY_RETURN:
        event.preventDefault();
        return that.imageToggleFullscreen(eventContext).then(wrapUp);
      case that.export.KEY_NUMBER_1:
        event.preventDefault();
        return that.fire_hashUpdate( { 'breadth': 1 }, false, eventContext).then(wrapUp);
      case that.export.KEY_NUMBER_2:
        event.preventDefault();
        returnthat.fire_hashUpdate( { 'breadth': 2 }, false, eventContext).then(wrapUp);
      case that.export.KEY_NUMBER_4:
        event.preventDefault();
        return that.fire_hashUpdate( { 'breadth': 4 }, false, eventContext).then(wrapUp);
      case that.export.KEY_NUMBER_8:
        event.preventDefault();
        return that.fire_hashUpdate( { 'breadth': 8 }, false, eventContext).then(wrapUp);
    }
    return wrapUp();
  }

  // ------------------
  // FUNCTIONS: helpers
  // ------------------

  this['negative_mod'] = function(x, m) {
    if (x < 0) return (x+m);
    return x;
  }

  /**
   * merge into obj1
   * overwrites obj1's values with obj2's and adds obj2's if non existent in obj1
   * @param obj1
   * @param obj2
   */
  this['merge'] = function(obj1, obj2){
    for (var attrname in obj2) {
      obj1[attrname] = obj2[attrname];
    }
  }

  /**
   * @param {jQuery} jqEntity the cell
   * @param {bool} True to include partially visible cells
   * @return {bool} True if this image is currently visible in the viewport
   */
  this['isVisible'] = function(jqEnt, partial) {
    var rounding = 5;
    // get coordinate of selected image's cell
    var position = jqEnt.offset();
    // if horizontal (flow-x), scroll horizontally
    if (this.getDirection() == 'x') {
      // min is left bar (-1 for border) and a cell's width to include partials
      var min = $(document).scrollLeft() + rounding - (partial ? jqEnt.width() : 0);
      // max is right bar (+1 for border) less a cell's width to exclude partials
      var max = $(window).width() + $(document).scrollLeft() - rounding - (partial ? 0 : jqEnt.width());
      if (debug && false) {
        console.log('min['+min+'] max['+max+'] position['+position.left+']');
      }
      return (position.left >= min && position.left <= max);
    } else {
      var min = $(document).scrollTop();
      var max = $(window).height() + $(document).scrollTop() - jqEnt.height();
      return (position.top >= min && position.top <= max);
    }
  }

  /**
   * @return {int | bool} next sequence number, or false on failure
   */
  this['getNextSeq'] = function(seq, increment) {
    var startingPointSeq = seq;
    do {
      seq = (seq+increment) % this.getTotalEntries();
      // wrap around
      if (seq < 0 && increment < 0) {
        seq = this.getTotalEntries()-1;
      }
      if ($('#seq-'+seq).length) {
        return seq;
      }
    } while (seq != this.startingPointSeq);
    return false;
  }

  /**
   * @param string
   *          to search within
   * @param string
   *          to search for
   * @return true if the haystack ends with the needle
   */
  this['endswith'] = function(haystack, needle) {
    // roll on ECMAScript 6
    return haystack.indexOf(needle, haystack.length - needle.length) !== -1;
  }

  /**
   * strip any of the characters used in the hashbang from the start of the hash
   * @param {string} hash to strip
   * @return {string} stripped output
   */
  this['stripBang'] = function(hash) {
    var output;
    // re = new RegExp('/^['+this.export.HASHBANG+']*/','g');
    re = new RegExp('^['+this.export.HASHBANG+']','g');
    output = hash.replace(re,'');
    return output;
  }

  /**
   * @return {string} browser's hash without whatever hashbang we're using
   */
  this['getHash'] = function() {
    return this.stripBang(History.getHash());
  }

  /**
   * @return {string} browser's hash minus a few attributes
   */
  this['getFilteredHash'] = function() {
    return this.getHash();
  }

  // ---------------------
  // FUNCTIONS: deprecated
  // ---------------------

  // -----------------
  // FUNCTIONS: External API
  // -----------------

  that = this;
  this['export'] = {
    // queue function calls until document ready
    q: [],

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

    HASHBANG: '#!',
    pullImgSrcTHRESHOLD: 20,
    BREADTH_MULTIPLIER: 4,

    /**
     * add a button to the header
     * @param {object} obj arguments
     */
    'api_headerAddButton': function(obj) {
      var output;
      Mustache.parse(obj.template);
      output = Mustache.render(obj.template, obj.view);
      // attach output to header
      $('.header').append(output);
      // allow element to bind its handlers
      obj.callbackBind.call(this, obj);
    },

    /**
     * @return {int} breadth of current view
     */
    'api_getBreadth': function() {
      return that.getBreadth();
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
    'api_cellsCountMajor' : function() {
      return that.cellsCountMajor();
    },

    /**
     * helper function to make testing key presses easier
     */
    'api_triggerKeypress': function(key) {
      return that.fire_keyPress(key);
    },

    /**
     * jump to a specific image
     * @param {int} seq image to advance to
     */
    'api_imageAdvanceTo': function(seq) {
      return that.imageAdvanceTo(seq);
    },

    // no comma on last entry
    lastEntry: true
  };

  // call init function then return API object
  this.init();
  return this['export'];

})(jQuery, undefined);