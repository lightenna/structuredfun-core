/**
 * StructuredFun javascript
 */
window.sfun = (function($, undefined) {

  var debug = true;

  // default values for view state
  this.default = [];

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
      that.default['direction'] = that.getDirection();
      that.default['breadth'] = that.getBreadth();
      that.default['seq'] = 0;
      // bind to page
      that.bindToScroll();
      that.bindToHeaderLinks();
      that.bindToHotKeys();
      that.bindToHashChange();
      that.bindToImageLinks();
      // if we're sideways scrolling, bind to scroll event
      that.setDirection(that.getDirection());
      // find all screenpc elements, extract pc and store as data- attribute
      $('.screenpc-width').each(function() {
        return that.generate_data_pc($(this), 'width');
      }).promise().done(function() {
        $('.screenpc-height').each(function() {
          // can't simply use css('height') because it returns height in px not %
          // console.log($(this).css('height'));
          return that.generate_data_pc($(this), 'height');
        });
      }).promise().done(function() {
        // call refresh function to apply cell widths/heights
        refreshCells();
        // on page load, browser will scroll to the top, prepare to ignore it
        that.eventNumbQueue.push('scroll:x=0&y=0');
        // process state if set in URL (hash) first
        that.handler_hashChanged(that.getHash());
        // execute queue of API calls
        that.export.flush();
      })
      // attach listener to window for resize (rare, but should update)
      $(window).resize(function() {
        // if we're already timing out, delay for another x milliseconds
        if (that.resizeTimeout != null) {
          clearTimeout(this.resizeTimeout);
        }
        that.resizeTimeout = setTimeout(function() {
          that.refreshCells();
          that.refreshVisibility(0);
        }, 50); // 50 ms
      });
    });
  };

  /**
   * Extract percentage and store as data- attribute
   * 
   * @param object
   *          jQuery object
   * @param string
   *          {width|height} axis to extract percentage for
   */
  this['generate_data_pc'] = function(jq, axis) {
    var elemclass, elemid, elempc = undefined;
    // parse stylesheets for #id:width
    elemid = jq.attr('id');
    if (elemid != undefined) {
      // parse stylesheets for class(n):width
      elempc = this.lookupSelectorProp('#' + elemid, axis, '%');
    }
    if (elempc != undefined) {
      // found width on #id, apply to data
      jq.data('screenpc-' + axis, elempc).addClass('screenpc-ready');
    }
    else {
      // break class list into array
      elemclass = jq.attr('class').split(' ');
      // search list for a class defined in stylesheet
      for ( var i = 0; i < elemclass.length; i++) {
        var elemc = elemclass[i];
        // lookup class in style sheets to find width definition
        elempc = this.lookupSelectorProp('.' + elemc, axis, '%');
        if (elempc != undefined) {
          // found property, store in data tag
          jq.data('screenpc-' + axis, elempc).addClass('screenpc-ready');
          // don't carry on the search
          break;
        }
      }
    }
  };

  /**
   * Search for a property in a stylesheet class
   * 
   * @todo optimise, suggest caching of found rules
   * @param string
   *          element selector
   * @param string
   *          property to search for
   * @param [string]
   *          matchstrip characters to match and strip from the result
   */
  this['lookupSelectorProp'] = function(elem, prop) {
    var matchstrip = undefined;
    // look for optional third argument
    if (arguments.length > 2) {
      matchstrip = arguments[2];
    }
    // iterate over stylesheets
    for ( var j = 0; j < document.styleSheets.length; j++) {
      var rules = document.styleSheets[0].rules || document.styleSheets[0].cssRules;
      // iterate over rules within current stylesheet
      for ( var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (typeof(rule.selectorText) != 'undefined') {
          // test rule name against elem
          if (endswith(rule.selectorText, elem)) {
            if (debug && false) {
              console.log('matched rule[' + rule.selectorText + '] against elem[' + elem + ']');
            }
            var elempc = rule.style.getPropertyValue(prop);
            // if we actually found that property in this stylesheet class
            if (elempc != undefined) {
              // if we're suppose to match and strip characters from the end
              if (matchstrip != undefined) {
                // if the characters are there
                if (elempc.indexOf(matchstrip) !== -1) {
                  // if we can match it, strip it
                  elempc = elempc.replace(matchstrip, '');
                }
                else {
                  // but if we can't match it, don't return it at all
                  continue;
                }
              }
              return elempc;
            }
          }
        }
      }
    }
    return undefined;
  };

  /**
   * update (x/y)-bound on image
   * 
   * @param jQuery
   *          object parent container, which has changed size
   * @param jQuery
   *          object bounded image within
   */
  this['checkImageBound'] = function(jqEnt) {
    // use jQuery deferred promises
    var deferred = new $.Deferred();
    // queue up the bound checking
    deferred.then(function(jqEnt) {
      var jqCell = jqEnt.parents('li');
      // read container width/height
      var cx = jqCell.width(), cy = jqCell.height();
      var cratio = cx / cy;
      // detect if the image is bound by width/height in this container
      var ix = jqEnt.data('loaded-width'), iy = jqEnt.data('loaded-height');
      if (debug && false) {
        console.log('image '+jqEnt.attr('id')+' ['+ix+','+iy+'] checking bound within ['+cx+','+cy+']');
      }
      var iratio = ix / iy;
      var direction = ((cratio / iratio) > 1.0 ? 'y' : 'x');
      var invdir = (direction == 'x' ? 'y' : 'x');
      if (debug && false) {
        console.log('cx[' + cx + '] cy[' + cy + '] cratio[' + cratio + '], ix[' + ix + '] iy[' + iy + '] iratio['
            + iratio + ']: ' + (cratio / iratio).toPrecision(3) + '= ' + direction + '-bound');
      }
      // apply class to image
      jqEnt.addClass(direction + '-bound').removeClass(invdir + '-bound');
    });
    // but update loaded resolution if necessary first
    if (jqEnt.data('loaded-width') == undefined || jqEnt.data('loaded-height') == undefined) {
      if (debug) {
        console.log('image '+jqEnt.attr('id')+' update loaded resolution');
      }
      this.getLoadedResolution(jqEnt, deferred);
    } else {
      // either way flag that this image has loaded-width/height updated
      deferred.resolve(jqEnt);
    }
    // return object so that outside code can queue functions to get notified on resolve
    // but restrict using promise() so we cannot interfere with it
    return deferred.promise();
  };

  /**
   * Check the display resolution of the image and swap out src if higher res available 
   */
  this['checkImageRes'] = function(jqEnt) {
    var nativeWidth = jqEnt.data('native-width');
    var nativeHeight = jqEnt.data('native-height');
    var swappedOut = false, metaedOut = false;
    // don't attempt to check image resolution on folder
    var type = this.getType(jqEnt);
    if (!(type == 'image' || type == 'video')) {
      return;
    }
    if (debug && false) {
      console.log('image '+jqEnt.attr('id')+': checking resolution');
    }
    // test to see if we're displaying an image at more than 100%
    if (typeof(nativeWidth) == 'undefined' || typeof(nativeHeight) == 'undefined') {
      // fire request for metadata, then callback this (checkImageRes) function later
      this.checkMetadata(jqEnt);
      metaedOut = true;
    } else {
      var resbracket = 250, brackWidth, brackHeight;
      var imageWidth = jqEnt.width() * window.devicePixelRatio;
      var imageHeight = jqEnt.height() * window.devicePixelRatio;
      var loadedWidth = jqEnt.data('loaded-width');
      var loadedHeight = jqEnt.data('loaded-height');
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
            this.swapImageOut(jqEnt, jqEnt.data('base-src') + 'maxwidth='+brackWidth);
            swappedOut = true;
            // console.log('swap imageWidth['+imageWidth+'] brackWidth['+brackWidth+']');        
          }
        } else {
          // same but pivot on height rather than width
          brackHeight = Math.min(Math.ceil(imageHeight/resbracket) * resbracket, nativeHeight);
          if (brackHeight > loadedHeight) {
            this.swapImageOut(jqEnt, jqEnt.data('base-src') + 'maxheight='+brackHeight);
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
    // console.log('checking '+jqEnt.attr('id')+' w['+imageWidth+'] h['+imageHeight+'] nativeWidth['+nativeWidth+'] nativeHeight['+nativeHeight+'] loadedWidth['+loadedWidth+'] loadedHeight['+loadedHeight+']');
  };

  /**
   * Request metadata about this image from the server
   */
  this['checkMetadata'] = function(jqEnt) {
    var that = this;
    $.ajax({
      url: jqEnt.attr('src').replace('image','imagemeta'),
      dataType: 'json',
    })
    .done(function( data ) {
      that.processMetadata(jqEnt, data);
    });
  };

  /**
   * Store processed metadata in data- attributes if returned
   */
  this['processMetadata'] = function(jqEnt, data) {
    if (typeof(data.meta) != 'undefined') {
      jqEnt.data('native-width', data.meta.width);
      jqEnt.data('native-height', data.meta.height);
      console.log('received metadata width['+jqEnt.data('native-width')+'] height['+jqEnt.data('native-height')+']');
      // trigger image resolution check again now that we've updated data- attributes
      this.checkImageRes(jqEnt);
    }
  };
  
  /**
   * Swap out image using a temporary image (to get triggered on load event)
   * Can't just switch src on jqEnt, because that image is already loaded
   * Firebug doesn't show the updated data- attributes, but they are updated
   */
  this['swapImageOut'] = function(jqEnt, path) {
    var that = this;
    // create temporary image container
    var img = $('<img id="dynamic" />');
    // attach listener to catch when the new image has loaded
    img.attr('src', path).one('load', function() {
      // now that it's pre-cached by the temp, apply to original image
      jqEnt.attr('src', path);
      // store loaded width and height
      jqEnt.data('loaded-width', this.width);
      jqEnt.data('loaded-height', this.height);
      if (debug) {
        console.log('image '+jqEnt.attr('id')+': swapped out for ('+jqEnt.data('loaded-width')+','+jqEnt.data('loaded-height')+')');
      }
      that.refreshMetric(jqEnt);
      // console.log('loaded imageWidth['+this.width+'] imageHeight['+this.height+'] src['+$(this).attr('src')+']');        
    }).each(function() {
      if(this.complete) $(this).load();
    });
    // console.log('swapped path['+path+']');
  };

  // ------------------
  // FUNCTIONS: refresh
  // ------------------

  /**
   * Refresh element width/heights when screen size changes
   */
  this['refreshCells'] = function() {
    var that = this;
    var win = $(window), doc = $(document);
    var ww = win.width(), wh = win.height(), dw = doc.width(), dh = doc.height();
    var pcwidth = undefined, pcheight = undefined;
    // try to find a yardstick-(x/y) and use if found for width/height
    var yardx = $('#yardstick-x'), yardy = $('#yardstick-y');
    if (yardx.length) {
      ww = yardx.width();
    }
    if (yardy.length) {
      wh = yardy.height();
    }
    if (debug && false) {
      console.log('viewport w[' + ww + '] h[' + wh + ']');
    }
    // loop through all 'ready' elements
    $('.screenpc-ready').each(
      function() {
        var jqCell = $(this);
        var pxval, pcval;
        // read data-screen-pc-width|height if set
        pcwidth = jqCell.data('screenpc-width');
        pcheight = jqCell.data('screenpc-height');
        // resize cells as applicable
        if (that.setScreenPcUsing == 'pc') {
          // don't re-apply same pc every refresh
        } else {
          // apply screen percentage as pixels (px) or document percentage (dpc), transformed from window pc
          if (pcwidth) {
            pxval = ww * pcwidth / 100;
            pcval = (pxval * 100 / dw) + '%';
            jqCell.width(that.setScreenPcUsing == 'dpc' ? pcval : pxval);
            if (debug && false) {
              console.log('ww[' + ww + '] dw['+ dw +'] pcwidth[' + pcwidth + '] pxval[' + pxval + '] pcval[' + pcval + ']');
            }
          }
          if (pcheight) {
            pxval = wh * pcheight / 100;
            pcval = (pxval * 100 / dh) + '%';
            jqCell.height(that.setScreenPcUsing == 'dpc' ? pcval : pxval);
            if (debug && false) {
              console.log('wh[' + wh + '] dh[' + dh + '] pcheight[' + pcheight + '] pxval[' + pxval + '] pcval[' + pcval + ']');
            }
          }
          if (debug && false) {
            console.log('post-set screenpc[' + jqCell.attr('id') + '] w[' + pcwidth + '%] h[' + pcheight + '%] now w['+ jqCell.width() + '] h[' + jqCell.height() + ']');
          }
        }
      }
    );
  };

  /**
   * Read data about the image and update metric display
   * @param  {object} jqEnt jQuery object for image
   */
  this['refreshMetric'] = function(jqEnt) {
    // find the imgmetric if it's set
    var common_parent = jqEnt.parents('li');
    var met = common_parent.find('.imgmetric');
    var perc;
    if (met.length) {
      var width_current = jqEnt.width(), height_current = jqEnt.height();
      var width_native = jqEnt.data('native-width'), height_native = jqEnt.data('native-height');
      // calculate percentage based on image area, or width
      // perc = Math.round((width_current * height_current) * 100 / (width_native * height_native));
      perc = Math.round(width_current * 100 / width_native);
      if (debug && false) {
        // show the size of the image that's been loaded into this img container
        met.find('span.width').html(Math.round(jqEnt.data('loaded-width')));
        met.find('span.height').html(Math.round(jqEnt.data('loaded-height')));
        met.find('span.size').show();
      } else {
        // update with current image width and height
        met.find('span.width').html(Math.round(width_current));
        met.find('span.height').html(Math.round(height_current));
      }
      if (!isNaN(perc)) {
        met.find('span.perc').html(perc+'%').show();
      }
      // analyse to see if we're over/under the native res
      if (width_current > width_native || height_current > height_native) {
        met.removeClass('super').addClass('sub');
      } else {
        met.removeClass('sub').addClass('super');          
      }
    }
  }

  /**
   * check that the image metric is in the right place
   */
  this['refreshMetricPosition'] = function(jqEnt) {
    var met = jqEnt.parents('li').find('.imgmetric');
    // move the metric to the corner of the image using absolute coords
    met.css( { 'top': jqEnt.offset().top, 'left': jqEnt.offset().left });
  }

  /**
   * refresh the img.visible status on all/some of the images
   * @param  {int} scrolldir direction of scroll (+ve/-ve) or 0 for no scroll
   */
  this['refreshVisibility'] = function(scrolldir) {
    if (scrolldir == 0) {
      // if no scroll direction, refresh test all images for visibility
      this.setVisibleAll();
    } else {
      this.setVisibleNewlyVisible(scrolldir);
    }
    // check to see if the selected image is now no longer visible
    jqEnt = $('ul.flow li.cell .selectable.selected');
    if (!jqEnt.hasClass('visible')) {
      if (debug && false) {
        console.log('previously selected image '+jqEnt.data('seq')+' no longer visible');
      }
      // find the next visible one in the scroll direction
      jqEnt = $('ul.flow li.cell .selectable.visible:'+(scrolldir > 0 ? 'first' : 'last'));
      if (jqEnt.length) {
        // use hash to select new and deselect old, but numb listener
        that.imageAdvanceTo(jqEnt.data('seq'), true);
      }
    }
  }

  /** 
   * refresh the metric, metric position on visible images
   */
  this['refreshVisibles'] = function() {
    var that = this;
    $('ul.flow li.cell .selectable.visible').each(function() {
      that.refreshImage($(this));
    })
  }

  /**
   * refresh a single image, but ensure that it's loaded first
   * @param  {jQuery} jqEnt image
   */
  this['refreshImage'] = function(jqEnt) {
    var that = this;
    // check the image bound (asynchronous)
    this.checkImageBound(jqEnt)
    .then(function(jqEnt) {
      that.refreshImageSameBound(jqEnt);
    });
  }

  /**
   * refresh a single image within the same bounding box
   * @param  {jQuery} jqEnt image
   */
  this['refreshImageSameBound'] = function(jqEnt) {
    // change out the image for a better resolution if one's available
    that.checkImageRes(jqEnt);
    // update metric
    that.refreshMetric(jqEnt);
    that.refreshMetricPosition(jqEnt);    
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
      if (debug && false) {
        console.log('keydown event code['+event.which+']');
      }
      switch (event.which) {
        case that.export.KEY_ARROW_LEFT:
        case that.export.KEY_ARROW_UP:
          if (!event.altKey) {
            // advance to previous image
            that.imageAdvanceBy(-1, false);
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
          break;
        case that.export.KEY_PAGE_DOWN:
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
    $('.cell a.image-container').click(function(event) {
      // select image, then toggle
      var seq = $(this).find('img').data('seq');
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
    // update loaded resolution
    var im = new Image();
    im.onload = function() {
      jqEnt.data('loaded-width', im.width);
      jqEnt.data('loaded-height', im.height);
      im = null;
      // notify promise of resolution
      deferred.resolve(jqEnt);
    }
    im.src = jqEnt.attr('src');
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
    var jq = $('ul.flow li.cell .selectable.selected')
    return jq;
  }

  /**
   * @return {int} sequence number of currently selected image
   */
  this['getSeq'] = function() {
    var jq = this.getSelected();
    // jq.data returns undefined (not 0) if not set, so first-run safe
    return jq.data('seq');
  }

  /**
   * @return {int} total number of entities (max entry seq+1)
   */
  this['getTotalEntries'] = function() {
    var jq = $('ul.flow li.cell .selectable:last')
    return (parseInt(jq.data('seq'))+1);
  }

  /**
   * @return {string} type of entity
   */
  this['getType'] = function(jqEnt) {
    if (jqEnt.is('img')) {
      if (jqEnt.hasClass('video')) {
        return 'video';
      } else {
        return 'image';
      }
    }
    if (jqEnt.is('.folder-container')) {
      return 'folder';
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
    $('ul.flow li.cell .selectable.selected').removeClass('selected');
    // select new image
    jqCurrent = $('#selseq-'+seq);
    jqCurrent.addClass('selected');
    return changed;
  };

  /** 
   * ensure that a given image lies within the current viewport
   * @param {int} seq image sequence number
   * downstream of: EVENT
   */
  this['setVisibleByScrolling'] = function(seq) {
    var jq = $('#selseq-'+seq);
      // if we found the cell
    if (jq.length) {
      if (!this.isVisible(jq)) {
        if (this.getDirection() == 'x') {
          // get coordinate of selected image's cell
          position = jq.parents('li.cell').offset();
          this.scrollUpdate(position.left, 0);
        } else {
          position = jq.parents('li.cell').offset();
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
    $('ul.flow li.cell .selectable').each(function() {
      var jqEnt = $(this);
      if (that.isVisible(jqEnt)) {
        if (!jqEnt.hasClass('visible')) {
          that.setVisibleImage(jqEnt, true);
        }
      } else {
        // don't test, because setVis(false) is just a .removeClass()
        that.setVisibleImage(jqEnt, false);
      }
    });
  }

  /**
   * Loop through those images newly exposed, flagging as visible
   * Protected against case where accidentally called before there are any visible images
   * @param  {int} scrolldir scroll direction
   */
  this['setVisibleNewlyVisible'] = function(scrolldir) {
    // find first invisible image in scroll direction by finding last visible
    var jqEnt = $('ul.flow li.cell .selectable.visible:'+(scrolldir > 0 ? 'last' : 'first'));
    // if there aren't visible images, start at zero
    if (!jqEnt.length) {
      return this.setVisibleAll();
    }
    // initial sequence number is the one after the last visible, or before the first visible
    var initialSeq = jqEnt.data('seq');
    var seq = this.getNextSeq(jqEnt.data('seq'), scrolldir > 0 ? 1 : -1);
    jqEnt = $('#selseq-'+seq);
    if (debug && false) {
      console.log('testing image for visible '+seq);      
    }
    // test to see if the scroll segments are connected or not
    if (!this.isVisible(jqEnt)) {
      // if disconnected, start from scratch
      return this.setVisibleAll();
    } else {
      // if the scroll revealed a contiguous segment, loop forward from there
      while (this.isVisible(jqEnt) && (seq !== false)) {
        // but it wasn't previously
        if (!jqEnt.hasClass('visible')) {
          this.setVisibleImage(jqEnt, true);
        }
        // identify next image
        seq = this.getNextSeq(jqEnt.data('seq'), scrolldir > 0 ? 1 : -1);
        // check we haven't looped through them all
        if (seq == initialSeq) {
          break;
        } else {
          // prepare to check next image
          jqEnt = $('#selseq-'+seq);
        }
      }
      // now look for images that have been hidden
      this.setVisibleNewlyHidden(scrolldir);
    }
  };

  /**
   * Loop through images flagging those scrolled out of view as not-visible
   * Protected against case where accidentally called before there are any visible images
   * @param  {int} scrolldir scroll direction
   */
  this['setVisibleNewlyHidden'] = function(scrolldir) {
    // find first hidden image in opposite-scroll direction by finding first visible
    var jqEnt = $('ul.flow li.cell .selectable.visible:'+(scrolldir > 0 ? 'first' : 'last'));
    // if there aren't visible images, start at zero
    if (!jqEnt.length) {
      return this.setVisibleAll();
    }
    // initial sequence number is the one after the last visible, or before the first visible
    var initialSeq = seq = jqEnt.data('seq');
    if (debug && false) {
      console.log('testing image for not-visible '+seq);
    }
    // go through all the images that are now not visible
    while (!this.isVisible(jqEnt) && (seq !== false)) {
      // but it was previously
      if (jqEnt.hasClass('visible')) {
        this.setVisibleImage(jqEnt, false);
      }
      // prepare to check next image (in scrolldir because started at furthest back)
      seq = this.getNextSeq(jqEnt.data('seq'), scrolldir > 0 ? 1 : -1);
      jqEnt = $('#selseq-'+seq);
    }
  };

  /**
   * either flag an image as visible or not visible
   * @param  {jQuery} jqEnt image
   * @param  {boolean} vis  true to make visible, false not
   */
  this['setVisibleImage'] = function(jqEnt, vis) {
    if (vis) {
      if (debug && false) {
        console.log('making image '+jqEnt.data('seq')+' visible');
      }
      // make its src show if not there already
      var attr = jqEnt.attr('src');
      if (typeof attr === 'undefined' || attr === false) {
        jqEnt.attr('src', jqEnt.data('desrc'));
      }
      // make it visible and swap it out
      jqEnt.addClass('visible');
      this.refreshImage(jqEnt);
    } else {
      if (debug && false) {
        console.log('making image '+seq+' not-visible');
      }
      // make it not-visible
      jqEnt.removeClass('visible');
    }
  }

  // --------------------
  // FUNCTIONS: image ops
  // --------------------

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
    jqEnt = this.getSelected();
    switch (this.getType(jqEnt)) {
      case 'image':
        var numbListener = false;
        // toggle using hash change
        if (this.getBreadth() == 1) {
          this.hashUpdate( { 'breadth': this.default['breadth'] }, false, numbListener);
        } else {
          this.hashUpdate( { 'breadth': 1 }, false, numbListener);
        }
        break;
      case 'folder':
        window.location = jqEnt.attr('href');
        break;
    }
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
   */
  this['handler_hashChanged'] = function(hash) {
    // first of all find out if we should actually ignore this hash change
    if (this.handler_numb('hash:'+hash)) {
      // ignore this event
    } else {
      // keep track of whether this update could have affected all images and selected images
      var allImagesChanged = false;
      var selectedImageChanged = false;
      // start with defaults
      var obj = { 'breadth': this.default['breadth'], 'seq': this.default['seq']};
      // overwrite with current hash values
      fromHash = this.hashParse(hash);
      // check the hash values are valid, fallback to defaults if not
      if (!this.hashValidate(fromHash)) {
        console.log('illegal hash values, falling back to defaults');
      }
      this.merge(obj, fromHash);
      // stage 1: apply [hash] state to DOM
      // breadth changes potentially affect all images
      allImagesChanged |= this.setBreadth(obj.breadth);
      // seq changes at most only affect the image being selected
      selectedImageChanged |= this.setSeq(obj.seq);
      // scroll to the selected image
      this.setVisibleByScrolling(obj.seq);
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
      // insert hack to correct for onload scroll to top
      if (sx == 0 && sy == 0) {
        // manually jump back to the right place by firing handler_hashChanged
        this.handler_hashChanged(this.getHash());
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
      if (debug && false) {
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
   * @param {jQuery} jq jQuery entity that lives inside a cell
   * @return {bool} True if this image is currently visible in the viewport
   */
  this['isVisible'] = function(jq) {
    // var jqCell = jq.parents('li.cell');
    var jqCell = jq;
    // get coordinate of selected image's cell
    var position = jqCell.offset();
    // if horizontal (flow-x), scroll horizontally
    if (this.getDirection() == 'x') {
      var min = $(document).scrollLeft();
      var max = $(window).width() + $(document).scrollLeft() - jqCell.width();
      if (debug && false) {
        console.log('min['+min+'] max['+max+'] position['+position.left+']');
      }
      return (position.left >= min && position.left <= max);
    } else {
      var min = $(document).scrollTop();
      var max = $(window).height() + $(document).scrollTop() - jqCell.height();
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
      if ($('#selseq-'+seq).length) {
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
     * helper function to make testing key presses easier
     */
    'api_triggerKeypress': function(key) {
      var e = jQuery.Event( 'keydown', { which: key } );
      $(document).trigger(e);
    },

    // no comma on last entry
    lastEntry: true
  };

  // call init function then return API object
  this.init();
  return this['export'];

})(jQuery, undefined);