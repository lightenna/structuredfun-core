/**
 * StructuredFun javascript
 */
(function($, undefined) {

  debug = true;

  // ms to wait after resize event before re-bound/re-res
  this.resizeTimeout = null;
  
  // for screenpc width/height, set using px/pc
  this.setScreenPcUsing = null;

  // real flow direction
  this.direction = null;

  this.init = function() {
    var that = this;
    // initialise vars
    this.setScreenPcUsing = 'pc';
    $(document).ready(function() {
      that.bindToHeaderLinks();
      // calculate scroll direction
      that.direction = that.getDirection();
      // find all imagebind containers, setup images to listen for load and bind
      $('.cell').each(function() {
        var jqCell = $(this);
        // bind to image's first loaded event
        $(this).find('img.bounded').one('load', function() {
          // check its binding, then resolution
          that.checkImageBound(jqCell, $(this));
          that.checkImageRes($(this));
          // console.log('loaded image w['+$(this).width()+'] h['+$(this).height()+']');
        }).each(function() {
          if(this.complete) $(this).load();
        });
      });
      // find all screenpc elements, extract pc and store as data- attribute
      $('.screenpc-width').each(function() {
        return that.generate_data_pc($(this), 'width');
      });
      $('.screenpc-height').each(function() {
        // can't simply use css('height') because it returns height in px not %
        // console.log($(this).css('height'));
        return that.generate_data_pc($(this), 'height');
      });
      // call refresh function to apply widths/heights
      refresh();
      // attach listener to window for resize (rare, but should update)
      $(window).resize(function() {
        // if we're already timing out, delay for another x milliseconds
        if (that.resizeTimeout != null) {
          clearTimeout(this.resizeTimeout);
        }
        that.resizeTimeout = setTimeout(function() {
          that.refresh();
        }, 50); // 50 ms
      });
      // if we're sideways scrolling, bind to scroll event
      that.setDirection(that.direction);
    });
  };

  /**
   * Refresh element width/heights when screen size changes
   */
  this['refresh'] = function() {
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
        // after resizing cells
        if (pcwidth || pcheight) {
          // if there's an image inside
          var jqImg = jqCell.find('img.bounded').each(function(){
            // 1. look to see if the x-bound/y-bound has changed
            that.checkImageBound(jqCell, $(this));
            // 2. change out the image for a better resolution
            that.checkImageRes($(this));
          });
        }
      }
    );
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
    return undefined;
  };

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
  };

  /**
   * update (x/y)-bound on image
   * 
   * @param jQuery
   *          object parent container, which has changed size
   * @param jQuery
   *          object bounded image within
   */
  this['checkImageBound'] = function(jqCell, jqImg) {
    // read container width/height
    var cx = jqCell.width(), cy = jqCell.height();
    var cratio = cx / cy;
    // detect if the image is bound by width/height in this container
    var ix = jqImg.width(), iy = jqImg.height();
    var iratio = ix / iy;
    var direction = ((cratio / iratio) > 1.0 ? 'y' : 'x');
    var invdir = (direction == 'x' ? 'y' : 'x');
    if (debug && false) {
      console.log('cx[' + cx + '] cy[' + cy + '] cratio[' + cratio + '], ix[' + ix + '] iy[' + iy + '] iratio['
          + iratio + ']: ' + (cratio / iratio).toPrecision(3) + '= ' + direction + '-bound');
    }
    // apply class to image
    jqImg.addClass(direction + '-bound').removeClass(invdir + '-bound');
  };

  /**
   * Check the display resolution of the image and swap out src if higher res available 
   */
  this['checkImageRes'] = function(jqImg) {
    var resbracket = 250, brackWidth, brackHeight;
    var imageWidth = jqImg.width() * window.devicePixelRatio;
    var imageHeight = jqImg.height() * window.devicePixelRatio;
    var loadedWidth = jqImg.data('loaded-width');
    var loadedHeight = jqImg.data('loaded-height');
    var nativeWidth = jqImg.data('native-width');
    var nativeHeight = jqImg.data('native-height');
    var bigger = imageWidth > loadedWidth || imageHeight > loadedHeight;
    var available = loadedWidth < nativeWidth || loadedHeight < nativeHeight;
    var swappedOut = false, metaedOut = false;
    // test to see if we're displaying an image at more than 100%
    if (typeof(nativeWidth) == 'undefined' || typeof(nativeHeight) == 'undefined') {
      // fire request for metadata, then callback this (checkImageRes) function later
      this.checkMetadata(jqImg);
      metaedOut = true;
    } else {
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
            this.swapImageOut(jqImg, jqImg.data('base-src') + 'maxwidth='+brackWidth);
            swappedOut = true;
            // console.log('swap imageWidth['+imageWidth+'] brackWidth['+brackWidth+']');        
          }
        } else {
          // same but pivot on height rather than width
          brackHeight = Math.min(Math.ceil(imageHeight/resbracket) * resbracket, nativeHeight);
          if (brackHeight > loadedHeight) {
            this.swapImageOut(jqImg, jqImg.data('base-src') + 'maxheight='+brackHeight);
            swappedOut = true;
          }
        }
      }
    }
    // if we didn't swap out this image or go off to check its metadata, update imgmetric
    if (!swappedOut && !metaedOut) {
      this.imgmetricUpdate(jqImg);
    }
    // console.log('checking '+jqImg.attr('id')+' w['+imageWidth+'] h['+imageHeight+'] nativeWidth['+nativeWidth+'] nativeHeight['+nativeHeight+'] loadedWidth['+loadedWidth+'] loadedHeight['+loadedHeight+']');
  };

  /**
   * Request metadata about this image from the server
   */
  this['checkMetadata'] = function(jqImg) {
    var that = this;
    $.ajax({
      url: jqImg.attr('src').replace('image','imagemeta'),
      dataType: 'json',
    })
    .done(function( data ) {
      that.processMetadata(jqImg, data);
    });
  };

  /**
   * Store processed metadata in data- attributes if returned
   */
  this['processMetadata'] = function(jqImg, data) {
    if (typeof(data.meta) != 'undefined') {
      jqImg.data('native-width', data.meta.width);
      jqImg.data('native-height', data.meta.height);
      // trigger image resolution check again now that we've updated data- attributes
      this.checkImageRes(jqImg);
    } else {
      // START HERE
      console.log('metadata returned without meta substructure');
    }
  };
  
  /**
   * Swap out image using a temporary image (to get triggered on load event)
   * Can't just switch src on jqImg, because that image is already loaded
   * Firebug doesn't show the updated data- attributes, but they are updated
   */
  this['swapImageOut'] = function(jqImg, path) {
    var that = this;
    // create temporary image container
    var img = $('<img id="dynamic" />');
    // attach listener to catch when the new image has loaded
    img.attr('src', path).one('load', function() {
      // now that it's pre-cached by the temp, apply to original image
      jqImg.attr('src', path);
      // store loaded width and height
      jqImg.data('loaded-width', this.width);
      jqImg.data('loaded-height', this.height);
      that.imgmetricUpdate(jqImg);
      // console.log('loaded imageWidth['+this.width+'] imageHeight['+this.height+'] src['+$(this).attr('src')+']');        
    }).each(function() {
      if(this.complete) $(this).load();
    });
    // console.log('swapped path['+path+']');
  };

  /**
   * Read data about the image and update metric display
   * @param  {object} jqImg jQuery object for image
   */
  this['imgmetricUpdate'] = function(jqImg) {
    // find the imgmetric if it's set
    var common_parent = jqImg.parents('li');
    var imgpos = jqImg.offset();
    var met = common_parent.find('.imgmetric');
    var width_current = jqImg.width(), height_current = jqImg.height();
    var width_native = jqImg.data('native-width'), height_native = jqImg.data('native-height');
    if (met.length) {
      if (debug) {
        // show the size of the image that's been loaded into this img container
        met.find('span.width').html(Math.round(jqImg.data('loaded-width')));
        met.find('span.height').html(Math.round(jqImg.data('loaded-height')));
        met.find('span.size').show();
      } else {
        // update with current image width and height
        met.find('span.width').html(Math.round(width_current));
        met.find('span.height').html(Math.round(height_current));
      }
      met.find('span.perc').html(Math.round((width_current * height_current) * 100 / (width_native * height_native))+'%');
      // analyse to see if we're over/under the native res
      if (width_current > width_native || height_current > height_native) {
        met.removeClass('super').addClass('sub');
      } else {
        met.removeClass('sub').addClass('super');          
      }
      // move the metric to the corner of the image using absolute coords
      met.css( { 'top': imgpos.top, 'left': imgpos.left });
    }
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
    $('#flow-x').click(function(event) {
      that.setDirection('x');
      event.preventDefault();
    });
    $('#flow-y').click(function(event) {
      that.setDirection('y');
      event.preventDefault();
    });
    $('#theme-light').click(function(event) {
      $('html').removeClass('theme-dark');
      event.preventDefault();
    });
    $('#theme-dark').click(function(event) {
      $('html').addClass('theme-dark');
      event.preventDefault();
    });
  };

  /**
   * Get the real flow direction, not just what the class says because the browser might not support all directions
   * (needs flexbox)
   * 
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
   * set all 'flow' elements to flow in the direction
   */
  this['setDirection'] = function(direction) {
    var that = this;
    var invdir = (direction == 'x' ? 'y' : 'x');
    $('.flow').addClass('flow-' + direction).removeClass('flow-' + invdir);
    // remove old handler
    $(window).unbind('mousewheel', this.mousewheelHandler);
    // store new direction
    this.direction = this.getDirection();
    // attach new handler if required
    if (this.direction == 'x') {
      $(window).mousewheel(this.mousewheelHandler);
    }
    // re-check images
    $('.cell').each(function() {
      var jqCell = $(this);
      var jqImg = $(this).find('img.bounded').each(function(){
        // 1. look to see if the x-bound/y-bound has changed
        that.checkImageBound(jqCell, $(this));
        // 2. change out the image for a better resolution
        that.checkImageRes($(this));
      });
    });
  };

  /**
   * process events generated by mouse wheel scrolling this function is executed to return a handler with context (that)
   */
  this['mousewheelHandler'] = (function() {
    var that = this;
    return function(event) {
      // 'this' scope is the jQuery object, not the class-wide 'that'
      var xpos = $(this).scrollLeft();
      // get current x position, increment and write back
      $(this).scrollLeft(xpos + event.deltaFactor * (0 - event.deltaY));
      if (debug) {
        console.log('scroll dx[' + event.deltaX + '] dy[' + event.deltaY + '] factor[' + event.deltaFactor + ']');
      }
      // stop even bubbling up, otherwise we get some weird diagonal scrolling
      event.preventDefault();
      return false;
    };
  })();

  // call init function
  this.init();

})(jQuery, undefined);