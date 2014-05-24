/**
 * StructuredFun javascript
 */
window.sfun = (function($, undefined) {

  var debug = false;

  // ---------
  // CONSTANTS
  // ---------

  var KEY_ARROW_LEFT = 37;
  var KEY_ARROW_RIGHT = 39;
  var KEY_ARROW_UP = 38;
  var KEY_ARROW_DOWN = 40;
  var KEY_TAB = 9;
  var KEY_HOME = 36;
  var KEY_END = 35;
  var KEY_PAGE_UP = 33;
  var KEY_PAGE_DOWN = 34;
  var KEY_SHIFT = 16;
  var KEY_CTRL = 17;
  var KEY_ALT = 18;
  var KEY_RETURN = 13;
  var KEY_NUMBER_1 = 49;
  var KEY_NUMBER_2 = 50;
  var KEY_NUMBER_4 = 52;
  var KEY_NUMBER_8 = 56;

  // defaults
  this.defaultSeq = 0;
  this.defaultBreadth = null;
  this.defaultDirection = null;

  // ms to wait after resize event before re-bound/re-res
  this.resizeTimeout = null;
  // for screenpc width/height, set using px/pc
  this.setScreenPcUsing = null;

  // -----
  // STATE
  // - duplicated/cached from HTML
  // + keep to a minimum
  // -----

  this.totalEntries = null;

  // ---------
  // FUNCTIONS
  // ---------

  this.init = function() {
    var that = this;
    // initialise vars
    this.setScreenPcUsing = 'pc';
    $(document).ready(function() {
      // process state in page HTML next
      that.defaultDirection = that.getDirection();
      that.defaultBreadth = that.getBreadth();
      // bind to page
      that.bindToHeaderLinks();
      that.bindToHotKeys();
      that.bindToHashChange();
      that.bindToImageLinks();
      // process state if set in URL (hash) first
      that.hashAction(History.getHash());
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
        // find all images and attach load listener
        that.checkImages(true);
      })
      // attach listener to window for resize (rare, but should update)
      $(window).resize(function() {
        // if we're already timing out, delay for another x milliseconds
        if (that.resizeTimeout != null) {
          clearTimeout(this.resizeTimeout);
        }
        that.resizeTimeout = setTimeout(function() {
          that.refreshCells();
          that.checkImages(false);
        }, 50); // 50 ms
      });
      // if we're sideways scrolling, bind to scroll event
      that.setDirection(that.getDirection());
    });
  };

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
   * Check through all the images in this gallery for size/ratio/bounding/metadata
   */
  this['checkImages'] = function(waitForLoad) {
    var that = this;
    // re-check images
    $('.cell').each(function() {
      var jqCell = $(this);
      var callback = function(){
        // 1. look to see if the x-bound/y-bound has changed
        that.checkImageBound(jqCell, $(this));
        // 2. change out the image for a better resolution
        that.checkImageRes($(this));
        // 3. use this to count the number of images (remember zero-based)
        that.totalEntries = Math.max(that.totalEntries,  $(this).data('seq')+1);
        // 4. change out folder thumbnails as images
      };
      // either we can check now, or check when the image loads
      if (waitForLoad) {
        // note callback in the args to one(), each is only a pusher
        $(this).find('img.bounded').one('load', callback).each(function() {
          if(this.complete) $(this).load();
        });
      } else {
        $(this).find('img.bounded').each(callback);
      }
    });
  }

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
    // update loaded resolution
    var im = new Image();
    im.src = jqImg.attr('src');
    jqImg.data('loaded-width', im.width);
    jqImg.data('loaded-height', im.height);
    im = null;
    // detect if the image is bound by width/height in this container
    var ix = jqImg.data('loaded-width'), iy = jqImg.data('loaded-height');
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
      // console.log('received metadata width['+jqImg.data('native-width')+']');
      // trigger image resolution check again now that we've updated data- attributes
      this.checkImageRes(jqImg);
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
    var perc;
    if (met.length) {
      var width_current = jqImg.width(), height_current = jqImg.height();
      var width_native = jqImg.data('native-width'), height_native = jqImg.data('native-height');
      // calculate percentage based on image area, or width
      // perc = Math.round((width_current * height_current) * 100 / (width_native * height_native));
      perc = Math.round(width_current * 100 / width_native);
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
      met.find('span.perc').html(perc+'%');
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

  // -----------------
  // FUNCTIONS: Header
  // Dynamic toolbar
  // -----------------
  
  this['headerAddButton'] = function(obj) {
    var output;
    Mustache.parse(obj.template);
    output = Mustache.render(obj.template, obj.view);
    // attach output to header
    $('.header').append(output);
    // allow element to bind its handlers
    obj.callbackBind.call(this, obj);
  }

  // ------------------
  // FUNCTIONS: Binding
  // ------------------

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
      that.checkImages(false);
      event.preventDefault();
    });
    $('#flow-y').click(function(event) {
      that.setDirection('y');
      that.checkImages(false);
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
      that.setBreadth(1);
      that.checkImages(false);
      event.preventDefault();
    });
    $('#flow-2').click(function(event) {
      that.setBreadth(2);
      that.checkImages(false);
      event.preventDefault();
    });
    $('#flow-4').click(function(event) {
      that.setBreadth(4);
      that.checkImages(false);
      event.preventDefault();
    });
    $('#flow-8').click(function(event) {
      that.setBreadth(8);
      that.checkImages(false);
      event.preventDefault();
    });
    
  };

  /**
   * Bind to hotkeys for navigation
   */
  this['bindToHotKeys'] = function() {
    var that = this;
    $(document).keydown(function(event){
      switch (event.keyCode) {
        case KEY_ARROW_LEFT:
        case KEY_ARROW_UP:
          if (!event.altKey) {
            // advance to previous image
            that.imageAdvanceBy(-1);
            event.preventDefault();
          }
          break;
        case KEY_ARROW_RIGHT:
        case KEY_TAB:
        case KEY_ARROW_DOWN:
          // advance to next image
          that.imageAdvanceBy(1);
          event.preventDefault();
          break;
        case KEY_PAGE_UP:
          break;
        case KEY_PAGE_DOWN:
          break;
        case KEY_HOME:
          if (event.ctrlKey) {

          }
          break;
        case KEY_END:
          if (event.ctrlKey) {

          }
          break;
        case KEY_RETURN:
          that.imageToggleFullscreen();
          break;
        case KEY_NUMBER_1:
          that.imageBreadth(1);
          break;
        case KEY_NUMBER_2:
          that.imageBreadth(2);
          break;
        case KEY_NUMBER_4:
          that.imageBreadth(4);
          break;
        case KEY_NUMBER_8:
          that.imageBreadth(8);
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
    History.Adapter.bind(window, 'anchorchange', function() {
      that.hashAction(History.getHash());
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
      that.hashUpdate( { 'seq': seq }, false );
      that.imageToggleFullscreen();
      event.preventDefault();
    });
  }

  // ------------------------------
  // FUNCTIONS: getter then setters
  // ------------------------------

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
   * @return {int} sequence number of currently selected image
   */
  this['getSeq'] = function() {
    var jq = $('ul.flow li.cell img.selected')
    return jq.data('seq');
  }

  /**
   * set all 'flow' elements to flow in the direction
   */
  this['setDirection'] = function(direction) {
    var invdir = (direction == 'x' ? 'y' : 'x');
    $('.flow').addClass('flow-' + direction).removeClass('flow-' + invdir);
    // remove old handler
    $(window).unbind('mousewheel', this.mousewheelHandler);
    // attach new handler if required
    if (direction == 'x') {
      $(window).mousewheel(this.mousewheelHandler);
    }
  };

  /**
   * set the width of the screen flow
   * e.g. number of cells vertically if in vertical mode
   */
  this['setBreadth'] = function(breadth) {
    // remove all the other breadths
    for (var i=1 ; i <= 8 ; i=i*2) {
      // don't remove the breadth we're setting
      if (i == breadth) {
        continue;
      }
      $('.flow').removeClass('flow-'+i);
    }
    $('.flow').addClass('flow-' + breadth);
  };

  /**
   * @param int sequence number of image to make current
   */
  this['setSeq'] = function(seq) {
    var jqCurrent, position;
    // deselect old image
    $('ul.flow li.cell img.selected').removeClass('selected');
    // select new image
    jqCurrent = $('#imgseq-'+seq);
    jqCurrent.addClass('selected');
  };

  /** 
   * ensure that a given image lies within the current viewport
   * @param {int} seq image sequence number
   */
  this['setVisible'] = function(seq) {
    var jq = $('#imgseq-'+seq);
    var cellsize = this.getCellSize();
    // get coordinate of selected image's cell
    position = jq.parents('li.cell').offset();
    // if we found the cell
    if (jq.length) {
      // if horizontal (flow-x), scroll horizontally
      if (this.getDirection() == 'x') {
        var min = $(window).scrollLeft();
        var max = $(window).width() + $(window).scrollLeft() - cellsize;
        if (position.left >= min && position.left <= max) {
          // visibile, do nothing
        } else {
          // scroll to show
          window.scrollTo(position.left, 0);
        }
      } else {
        var min = $(window).scrollTop();
        var max = $(window).height() + $(window).scrollTop() - cellsize;
        if (position.top >= min && position.top <= max) {
          window.scrollTo(0, position.top);
        }
      }      
    }
  }

  // --------------------
  // FUNCTIONS: image ops
  // --------------------

  /**
   * advance to another image in sequence
   * @param {int} increment positive to go to next, negative for previous
   */
  this['imageAdvanceBy'] = function(increment) {
    // start with the current image
    var seq = this.getSeq();
    var startingPointSeq = seq;
    if (seq >= 0 && (seq < this.totalEntries+1)) {
      // iterate to find next image
      do {
        seq = (seq+increment) % this.totalEntries;
        if ($('#imgseq-'+seq).length) {
          break;
        }
      } while (seq != this.startingPointSeq);
      // update using hash change
      this.hashUpdate( { 'seq': seq }, false);
    } else {
      console.log('warning: erroneous seq('+seq+') returned by getseq');
    }
  };

  /**
   * switch between the default breadth and fullscreen
   */
  this['imageToggleFullscreen'] = function() {
    // toggle using hash change
    if (this.getBreadth() == 1) {
      this.hashUpdate( { 'breadth': this.defaultBreadth }, false);
    } else {
      this.hashUpdate( { 'breadth': 1 }, false);
    }
  }

  // ---------------
  // FUNCTIONS: Hash
  // ---------------

  this['hashUpdate'] = function(options, push) {
    var hash = '';
    // start with defaults
    var obj = { 'breadth': this.defaultBreadth, 'seq': this.defaultSeq};
    // overwrite with current hash values
    fromHash = this.hashParse(History.getHash());
    this.merge(obj, fromHash);
    // overwrite with options
    this.merge(obj, options);
    // convert to hash string
    hash = this.hashGenerate(obj);
    if (push) {
      History.pushState({}, null, hash);
    } else {
      History.replaceState({}, null, hash);
    }
  }

  /**
   * look for state in the URL hash
   */
  this['hashAction'] = function(hash) {
    // start with defaults
    var obj = { 'breadth': this.defaultBreadth, 'seq': this.defaultSeq};
    // overwrite with current hash values
    fromHash = this.hashParse(History.getHash());
    this.merge(obj, fromHash);
    // apply all in one go
    this.setBreadth(obj.breadth);
    this.setSeq(obj.seq);
    this.checkImages(false);
    this.setVisible(obj.seq);

  }

  /**
   * convert an object to a hash string
   * @param {object} values as an object
   * @return {string} hash as string
   */
  this['hashGenerate'] = function(obj) {
    var hash = '#';
    for (var key in obj) {
      if (hash != '#') {
        hash += '&';
      }
      hash += key+'='+obj[key];
    }
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
      // strip leading # if set
      if (hash[0] == '#') {
        hash = hash.substring(1);
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


  // ------------------
  // FUNCTIONS: Helpers
  // ------------------

  /**
   * process events generated by mouse wheel scrolling this function is executed to return a handler with context (that)
   */
  this['mousewheelHandler'] = (function() {
    var that = this;
    return function(event) {
      // 'this' scope is the jQuery object, not the class-wide 'that'
      var xpos = $(this).scrollLeft();
      // get current cell size
      var cellsize = that.getCellSize();
      // get current x position, increment and write back
      $(this).scrollLeft(xpos + (0 - event.deltaY) * cellsize);
      if (debug) {
        console.log('scroll dx[' + event.deltaX + '] dy[' + event.deltaY + '] factor[' + event.deltaFactor + ']');
      }
      // stop even bubbling up, otherwise we get some weird diagonal scrolling
      event.preventDefault();
      return false;
    };
  })();

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

  // call init function
  this.init();

})(jQuery, undefined);