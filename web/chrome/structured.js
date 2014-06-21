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
      // on page load, browser will scroll to the top, prepare to ignore it
      that.eventNumbQueue.push('scroll:x=0&y=0');
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
          // resize could have shown more images
          that.refreshVisibility(0);
        }, 50); // 50 ms
      });
    });
  };

  /**
   * Request metadata about this image from the server
   */
  this['checkMetadata'] = function(jqEnt) {
    var that = this;
    var jqReresable = jqEnt.find('.reresable');
    if (jqReresable.length) {
      $.ajax({
        url: jqReresable.attr('src').replace('image','imagemeta'),
        dataType: 'json',
      })
      .done(function( data ) {
        that.processMetadata(jqEnt, data);
      });
      if (debug && false) {
        console.log('firing metadata request for image-'+jqEnt.data('seq'));
      }
    }
  };

  /**
   * Store processed metadata in data- attributes if returned
   */
  this['processMetadata'] = function(jqEnt, data) {
    if (typeof(data.meta) != 'undefined') {
      var jqReresable = jqEnt.find('.reresable');
      if (jqReresable.length) {
        jqReresable.data('native-width', data.meta.width);
        jqReresable.data('native-height', data.meta.height);
        // trigger image resolution check again now that we've updated data- attributes
        if (debug && false) {
          console.log('processing metadata request for image-'+jqEnt.data('seq'));
          console.log('received metadata width['+jqReresable.data('native-width')+'] height['+jqReresable.data('native-height')+']');
        }
        this.refreshResolution(jqEnt);
      }
    }
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
  }

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
  }

  // ------------------
  // FUNCTIONS: refresh
  // ------------------

  /**
   * update (x/y)-bound on boundable image in cell
   * @param jQuery cell that may have changed size
   */
  this['refreshBounds'] = function(jqEnt) {
    // use jQuery deferred promises
    var deferred = new $.Deferred();
    // find boundable entity
    var jqBoundable = jqEnt.find('.boundable');
    if (jqBoundable.length) {
      // queue up the bound checking
      deferred.then(function(jqEnt) {
        // read container width/height
        var cx = jqEnt.width(), cy = jqEnt.height();
        var cratio = cx / cy;
        // detect if the image is bound by width/height in this container
        var ix = jqBoundable.data('loaded-width'), iy = jqBoundable.data('loaded-height');
        if (debug && false) {
          console.log('image-'+jqEnt.data('seq')+' ['+ix+','+iy+'] checking bound within ['+cx+','+cy+']');
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
      // but update loaded resolution if necessary first
      if (jqBoundable.data('loaded-width') == undefined || jqBoundable.data('loaded-height') == undefined) {
        if (debug && false) {
          console.log('image-'+jqEnt.data('seq')+' update loaded resolution');
        }
        this.getLoadedResolution(jqEnt, deferred);
      } else {
        // either way flag that this image has loaded-width/height updated
        deferred.resolve(jqEnt);
      }
    }
    // return object so that outside code can queue functions to get notified on resolve
    // but restrict using promise() so we cannot interfere with it
    return deferred.promise();
  };

  /**
   * Read data about the image and update metric display
   * @param  {object} jqEnt jQuery object for image
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
  }

  /**
   * check that the image metric is in the right place
   */
  this['refreshMetricPosition'] = function(jqEnt) {
    var jqMetric = jqEnt.find('.imgmetric');
    if (jqMetric.length) {
      var position = jqEnt.offset();
      // move the metric to the corner of the image using absolute coords
      jqMetric.css( { 'top': position.top, 'left': position.left });
    }
  }

  /**
   * refresh the cell.visible status on all/some of the entries
   * @param  {int} scrolldir direction of scroll (+ve/-ve) or 0 for no scroll
   */
  this['refreshVisibility'] = function(scrolldir) {
    // always test all images for visibility
    this.setVisibleAll();
    // check to see if the selected image is now no longer visible
    this.refreshSelected(scrolldir);
  }

  /** 
   * refresh the selected entry after a visibility change
   * @param  {int} scrolldir direction of scroll (+ve/-ve) or 0 for no scroll
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
        // use hash to select new and deselect old, but numb listener
        that.imageAdvanceTo(jqEnt.data('seq'), true);
      }
    }
  }

  /**
   * Check the display resolution of the image and swap out src if higher res available 
   */
  this['refreshResolution'] = function(jqEnt) {
    var jqReresable = jqEnt.find('.reresable');
    if (!jqReresable.length) {
      return;
    }
    var nativeWidth = jqReresable.data('native-width');
    var nativeHeight = jqReresable.data('native-height');
    var swappedOut = false, metaedOut = false;
    // don't attempt to check image resolution on directory
    var type = this.getType(jqEnt);
    if (!(type == 'image' || type == 'video')) {
      return;
    }
    if (debug && false) {
      console.log('image-'+jqEnt.data('seq')+': checking resolution');
    }
    // test to see if we're displaying an image at more than 100%
    if (typeof(nativeWidth) == 'undefined' || typeof(nativeHeight) == 'undefined') {
      // fire request for metadata, then callback this (refreshResolution) function later
      this.checkMetadata(jqEnt);
      metaedOut = true;
    } else {
      var resbracket = 250, brackWidth, brackHeight;
      var imageWidth = jqReresable.width() * window.devicePixelRatio;
      var imageHeight = jqReresable.height() * window.devicePixelRatio;
      var loadedWidth = jqReresable.data('loaded-width');
      var loadedHeight = jqReresable.data('loaded-height');
      var bigger = imageWidth > loadedWidth || imageHeight > loadedHeight;
      var available = loadedWidth < nativeWidth || loadedHeight < nativeHeight;
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
            this.imageReres(jqReresable, jqReresable.data('base-src') + 'maxwidth='+brackWidth);
            swappedOut = true;
            // console.log('swap imageWidth['+imageWidth+'] brackWidth['+brackWidth+']');        
          }
        } else {
          // same but pivot on height rather than width
          brackHeight = Math.min(Math.ceil(imageHeight/resbracket) * resbracket, nativeHeight);
          if (brackHeight > loadedHeight) {
            this.imageReres(jqEnt, jqReresable.data('base-src') + 'maxheight='+brackHeight);
            swappedOut = true;
          }
        }
      }
    }
    // if we didn't swap out this image or go off to check its metadata, update imgmetric
    // @todo maybe can comment this
    if (!swappedOut && !metaedOut) {
      this.refreshMetric(jqEnt);
    }
    if (debug && false) {
      console.log('checking '+jqEnt.data('seq')+' w['+imageWidth+'] h['+imageHeight+'] nativeWidth['+nativeWidth+'] nativeHeight['+nativeHeight+'] loadedWidth['+loadedWidth+'] loadedHeight['+loadedHeight+']');
    }
  };

  /**
   * refresh a single image, but ensure that it's loaded first
   * @param  {jQuery} jqEnt image
   */
  this['refreshImage'] = function(jqEnt) {
    var that = this;
    // check the image bound (asynchronous)
    this.refreshBounds(jqEnt)
    .then(function(jqEnt) {
      // change out the image for a better resolution if one's available
      that.refreshResolution(jqEnt);
      // update metric
      that.refreshMetric(jqEnt);
      that.refreshMetricPosition(jqEnt);    
    });
  }

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
  }

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
      that.hashUpdate( { 'breadth': 1 }, false, false);
      event.preventDefault();
    });
    $('#flow-2').click(function(event) {
      that.hashUpdate( { 'breadth': 2 }, false, false);
      event.preventDefault();
    });
    $('#flow-4').click(function(event) {
      that.hashUpdate( { 'breadth': 4 }, false, false);
      event.preventDefault();
    });
    $('#flow-8').click(function(event) {
      that.hashUpdate( { 'breadth': 8 }, false, false);
      event.preventDefault();
    });
    
  };

  /**
   * Bind to hotkeys for navigation
   */
  this['bindToHotKeys'] = function() {
    var that = this;
    $(document).keydown(function(event){
      if (debug && true) {
        console.log('keydown event code['+event.which+']');
      }
      switch (event.which) {
        case that.export.KEY_ARROW_LEFT:
          if (!event.altKey) {
            // advance to previous image
            that.imageAdvanceBy(-1, false);
            event.preventDefault();
          }
          break;
        case that.export.KEY_ARROW_UP:
          if (event.altKey) {
            that.urlChangeUp();
            event.preventDefault();
          }
          break;
        case that.export.KEY_ARROW_RIGHT:
        case that.export.KEY_TAB:
        case that.export.KEY_ARROW_DOWN:
          // advance to next image
          that.imageAdvanceBy(1, false);
          event.preventDefault();
          break;
        case that.export.KEY_PAGE_UP:
          that.imageAdvanceBy(-1 * that.cellsCountMajor() * that.getBreadth(), false);
          event.preventDefault();
          break;
        case that.export.KEY_PAGE_DOWN:
          that.imageAdvanceBy(that.cellsCountMajor() * that.getBreadth(), false);
          event.preventDefault();
          break;
        case that.export.KEY_HOME:
          that.imageAdvanceTo(0, false);
          event.preventDefault();
          break;
        case that.export.KEY_END:
          that.imageAdvanceTo(that.getTotalEntries()-1, false);
          event.preventDefault();
          break;
        case that.export.KEY_RETURN:
          that.imageToggleFullscreen();
          event.preventDefault();
          break;
        case that.export.KEY_NUMBER_1:
          that.hashUpdate( { 'breadth': 1 }, false, false);
          event.preventDefault();
          break;
        case that.export.KEY_NUMBER_2:
          that.hashUpdate( { 'breadth': 2 }, false, false);
          event.preventDefault();
          break;
        case that.export.KEY_NUMBER_4:
          that.hashUpdate( { 'breadth': 4 }, false, false);
          event.preventDefault();
          break;
        case that.export.KEY_NUMBER_8:
          that.hashUpdate( { 'breadth': 8 }, false, false);
          event.preventDefault();
          break;
      }
    });
  }

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
  }

  /**
   *  if the image is clicked, redirect to in-page image
   */
  this['bindToImageLinks'] = function() {
    var that = this;
    $('ul.flow .selectablecell a.media-container').click(function(event) {
      // select image, then toggle
      var seq = $(this).parents('.selectablecell').data('seq');
      // seq changes don't go into history
      that.hashUpdate( { 'seq': seq }, false, false);
      // this is a bit nasty, because it's doing 2 hash updates in quick succession
      that.imageToggleFullscreen();
      event.preventDefault();
    });
  }

  // ------------------
  // FUNCTIONS: getters
  // ------------------

  /**
   * updated loaded-width and loaded-height data attributes
   * @param  {jQuery object} jqEnt image to check
   * @param  {jQuery.deferred} deferred async queue
   */
  this['getLoadedResolution'] = function(jqEnt, deferred) {
    var jqBoundable = jqEnt.find('.boundable');
    if (jqBoundable.length) {
      // update loaded resolution
      var im = new Image();
      im.onload = function() {
        jqBoundable.data('loaded-width', im.width);
        jqBoundable.data('loaded-height', im.height);
        im = null;
        if (debug && false) {
          console.log('loaded first thumbnail for image-'+jqEnt.data('seq'));
        }
        // notify promise of resolution
        deferred.resolve(jqEnt);
      }
      im.src = jqBoundable.attr('src');
    }
  }

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
  }

  /**
   * @return {jQuery} selected entity
   */
  this['getSelected'] = function() {
    var jqEnt = $('ul.flow .selectablecell.selected')
    return jqEnt;
  }

  /**
   * @return {int} sequence number of currently selected cell
   */
  this['getSeq'] = function() {
    var jqEnt = this.getSelected();
    // jq.data returns undefined (not 0) if not set, so first-run safe
    return jqEnt.data('seq');
  }

  /**
   * @return {int} total number of entities (max entry seq+1)
   */
  this['getTotalEntries'] = function() {
    var jq = $('ul.flow .selectablecell:last')
    return (parseInt(jq.data('seq'))+1);
  }

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
  }

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
   */
  this['setScrollPosition'] = function(seq) {
    var jqEnt = $('#seq-'+seq);
      // if we found the cell
    if (jqEnt.length) {
      if (!this.isVisible(jqEnt, true)) {
        if (this.getDirection() == 'x') {
          // get coordinate of selected image's cell
          position = jqEnt.offset();
          this.scrollUpdate(position.left, 0);
        } else {
          position = jqEnt.offset();
          this.scrollUpdate(0, position.top);
        }
      } else {
        // manually refresh the visible images
        this.refreshVisibility(0);
      }
    }
  }

  /**
   * Loop through all images (synchronously)
   * @return {[type]} [description]
   */
  this['setVisibleAll'] = function() {
    var that = this;
    // clear all the visible images
    $('ul.flow .selectablecell').removeClass('visible');
    // then recalculate them
    $('ul.flow .selectablecell').each(function() {
      var jqEnt = $(this);
      if (that.isVisible(jqEnt, true)) {
        that.setVisibleImage(jqEnt, true);
      } else {
        // don't test, because setVis(false) is just a .removeClass()
        that.setVisibleImage(jqEnt, false);
      }
    });
  }

  /**
   * either flag an image as visible or not visible
   * @param  {jQuery} jqEnt image
   * @param  {boolean} vis  true to make visible, false not
   */
  this['setVisibleImage'] = function(jqEnt, vis) {
    if (vis) {
      if (debug && false) {
        console.log('making image-'+jqEnt.data('seq')+' visible');
      }
      // make it visible
      jqEnt.addClass('visible');
      // make its src show if not there already
      var jqReresable = jqEnt.find('.reresable');
      if (jqReresable.length) {
        var attr = jqReresable.attr('src');
        if (typeof attr === 'undefined' || attr === false) {
          jqReresable.attr('src', jqReresable.data('desrc'));
        }
        // when an image becomes visible refresh all its facets
        this.refreshImage(jqEnt);
      }
    } else {
      if (debug && false) {
        console.log('making image-'+jqEnt.data('seq')+' not-visible');
      }
      // make it not-visible
      jqEnt.removeClass('visible');
    }
  }

  // --------------------
  // FUNCTIONS: image ops
  // --------------------

  /**
   * Swap out image using a temporary image (to get triggered on load event)
   * Can't just switch src on jqEnt, because that image is already loaded
   * Firebug doesn't show the updated data- attributes, but they are updated
   */
  this['imageReres'] = function(jqEnt, path) {
    var that = this;
    var jqReresable = jqEnt.find('.reresable');
    if (jqReresable.length) {
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
      }).each(function() {
        if(this.complete) $(this).load();
      });
    }
  };

  /**
   * advance forward or back by a certain number of images in the sequence
   * @param {int} increment positive to go to next, negative for previous
   */
  this['imageAdvanceBy'] = function(increment, numbListener) {
    // start with the current image
    var seq = this.getSeq();
    if (seq >= 0 && seq < this.getTotalEntries()) {
      // iterate to find next image
      if ((seq = this.getNextSeq(seq, increment)) !== false) {
        this.imageAdvanceTo(seq, numbListener);
      }
    } else {
      console.log('warning: erroneous seq('+seq+') returned by getseq');
    }
  };

  /**
   * advance to a specific image in the sequence
   * @param {int} image sequence number
   */
  this['imageAdvanceTo'] = function(seq, numbListener) {
    // update using hash change
    this.hashUpdate( { 'seq': seq }, false, numbListener);
  }

  /**
   * switch between the default breadth and fullscreen
   */
  this['imageToggleFullscreen'] = function() {
    var jqEnt = this.getSelected();
    switch (this.getType(jqEnt)) {
      case 'image':
        var numbListener = false;
        // toggle using hash change
        if (this.getBreadth() == 1) {
          this.hashUpdate( { 'breadth': this.previous['breadth'] }, false, numbListener);
        } else {
          this.hashUpdate( { 'breadth': 1 }, false, numbListener);
        }
        break;
      case 'directory':
        var jqClickable = jqEnt.find('.clickable');
        if (jqClickable.length) {
          window.location = jqClickable.attr('href');
        }
        break;
    }
  }

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
  }

  /**
   * redirect to another url
   * @param  {string} newUrl new location
   */
  this['urlGoto'] = function(newUrl) {
    window.location.href = newUrl;
  }

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
    // always have to set a hashbang ('' is not enough to trigger correct update)
    hash = this.export.HASHBANG + hash;
    return hash;
  }

  /**
   * parse out integers from hash attributes
   * @param  {string} hash string
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
  }

  /**
   * check that the values in this object are valid
   * @param  {object} hash name:value pairs
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
  }

  // -------------------------
  // FUNCTIONS: event triggers
  // -------------------------

  /** 
   * The numbQueue is used to stop the hashChanged listener from firing for certain hash changes
   */
  this['eventNumbQueue'] = [];

  /**
   * Make a change to the document's hash
   * @param  {object}  options      name:value pairs to go in the hash
   * @param  {boolean} push         true to push a history item
   * @param  {boolean} numbListener true to numb the hashChanged listener to this change
   */
  this['hashUpdate'] = function(options, push, numbListener) {
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
    if (debug && false) {
      console.log(hash);
    }
    // push hash string (options with defaults) on to numb queue if numb
    if (numbListener) {
      this['eventNumbQueue'].push('hash:'+hash);
      if (debug && false) {
        console.log('adding hash('+hash+') on to numbQueue, now len['+this['eventNumbQueue'].length+']');
      }
    }
    // fire event: change the window.location.hash
    if (push) {
      History.pushState({}, null, hash);
    } else {
      // -- doesn't always work!
      History.replaceState({}, 'Image', hash);
      // have to read it back and check; History hashes come back without #
      readback = History.getHash();
      if (hash != ('#'+readback)) {
        // -- leaves a messy history trail
        window.location.hash = hash;
      }
    }
  }

  /**
   * change the visible portion of the page by moving the scrollbars
   * @param  {int} left distance from left of page in pixels
   * @param  {int} top  distance from top of page in pixels
   * @param  {boolean}  numbListener true to numb the hashChanged listener to this change
   */
  this['scrollUpdate'] = function(left, top, numbListener) {
    if (numbListener) {
      this['eventNumbQueue'].push('scroll:'+'x='+left+'&y='+top);
      if (debug && false) {
        console.log('adding scroll('+'x='+left+'&y='+top+') on to numbQueue, now len['+this['eventNumbQueue'].length+']');
      }
    }
    // fire event: change the scroll position (comes through as single event)
    $(document).scrollLeft(left);
    $(document).scrollTop(top);
  }

  // -------------------------
  // FUNCTIONS: event handlers
  // -------------------------

  /** 
   * @param  {string} key  event description used to index in queue
   * @return {boolean} true if this event should be ignored
   */
  this['handler_numb'] = function(key) {
    var index = this['eventNumbQueue'].indexOf(key);
    if (index != -1) {
      if (debug && false) {
        console.log('ignoring '+key+' change');
      }
      // remove this hash from the numbQueue
      this['eventNumbQueue'].splice(index, 1);
      return true;
    }
    if (debug && false) {
      console.log('not ignoring '+key+' change');
    }
    return false;
  }

  /**
   * apply hash state (+current values for those unset) to page
   * downstream of: EVENT hash change
   * @param {bool} forceScrollPosition flag to control updates
   */
  this['handler_hashChanged'] = function(hash, forceScrollPosition) {
    // first of all find out if we should actually ignore this hash change
    if (this.handler_numb('hash:'+hash)) {
      // ignore this event
    } else {
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
      if (seqChanged || breadthChanged || forceScrollPosition) {
        // scroll to the selected image, which triggers refreshImage on .visibles
        this.setScrollPosition(obj.seq);
      }
      else if (breadthChanged) {
        var that = this;
        $('ul.flow .selectablecell.visible').each(function() {
          that.refreshImage($(this));
        })
      }
    }
  }

  /**
   * process events generated by mouse wheel scrolling
   * downstream of: EVENT mouse wheeled
   */
  this['handler_mouseWheeled'] = function(event) {
    var direction = this.getDirection();
    // active mousewheel reaction is dependent on which direction we're flowing in
    if (direction == 'x') {
      var xpos = $(document).scrollLeft();
      // get current cell size
      var cellsize = this.getCellSize();
      // get current x position, increment and write back, firing scroll event
      this.scrollUpdate(xpos + (0 - event.deltaY) * cellsize, 0, false);
      if (debug && false) {
        console.log('wheel dx[' + event.deltaX + '] dy[' + event.deltaY + '] factor[' + event.deltaFactor + ']');
      }
    }
  }

  /**
   * process events generated by window scrolling
   * downstream of: EVENT scroll
   */
  this['handler_scrolled'] = function(event) {
    var sx = $(document).scrollLeft(), sy = $(document).scrollTop();
    if (this.handler_numb('scroll:'+'x='+sx+'&y='+sy)) {
      if (debug && true) {
        console.log('numb scroll sx[' + sx + '] sy[' + sy + ']');
      }
      // insert hack to correct for onload scroll to top
      if (sx == 0 && sy == 0) {
        // manually jump back to the right place by firing handler_hashChanged
        this.handler_hashChanged(this.getHash());
        // need to force back to correct position
        this.setScrollPosition(this.getSeq());
      }
      // ignore this event
    } else {
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
      if (debug && true) {
        console.log('scroll dx[' + event.deltaX + '] dy[' + event.deltaY + '] factor[' + event.deltaFactor + ']');
      }
      // see if scroll has made any new images visible
      var scrolldir = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? 0 - event.deltaX : 0 - event.deltaY);
      this.refreshVisibility(scrolldir);
    }
  }

  // ------------------
  // FUNCTIONS: helpers
  // ------------------

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
   * @param  {string} hash to strip
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
     * @param  {string} name function name
     * @param  {[type]} obj  function arguments
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

    /**
     * add a button to the header
     * @param  {object} obj arguments
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
      var e = jQuery.Event( 'keydown', { which: key } );
      $(document).trigger(e);
    },

    /**
     * jump to a specific image
     * @param {int} seq image to advance to
     */
    'api_imageAdvanceTo': function(seq) {
      return that.imageAdvanceTo(seq, false);
    },

    // no comma on last entry
    lastEntry: true
  };

  // call init function then return API object
  this.init();
  return this['export'];

})(jQuery, undefined);