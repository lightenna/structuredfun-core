/**
 * StructuredFun javascript
 */
(function($, undefined) {

  var resizeTimeout = null;
  var debug = true;

  this.init = function() {
    var that = this;
    $(document).ready(function(){
      // find all imagebind containers, setup images to listen for load and bind
      $('.cell').each(function() {
        var jqCell = $(this);
        // bind to image's loaded event
        $(this).find('img.bounded').load(function() {
          that.checkImageBound(jqCell, $(this));
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
    });
  };

  /**
   * Refresh element width/heights when screen size changes
   */
  this['refresh'] = function() {
    var that = this;
    var win = $(window);
    var ww = win.width(), wh = win.height();
    var pcwidth = undefined, pcheight = undefined;
    // try to find a yardstick-(x/y) and use if found for width/height
    var yardx = $('#yardstick-x'), yardy = $('#yardstick-y');
    if (yardx.length) {
      ww = yardx.width();
    }
    if (yardy.length) {
      wh = yardy.height();
    }
    if (debug) {
      console.log('viewport w['+ww+'] h['+wh+']');
    }
    // loop through all 'ready' elements
    $('.screenpc-ready').each(function() {
      // read data-screen-pc-width|height if set
      pcwidth = $(this).data('screenpc-width');
      pcheight = $(this).data('screenpc-height');
      // apply screen percentage as px
      if (pcwidth) {
        $(this).width(ww * pcwidth / 100);
      }
      if (pcheight) {
        $(this).height(wh * pcheight / 100);
      }
      if (debug && false) {
        console.log('screenpc['+$(this).attr('id')+'] w['+pcwidth+'%] h['+pcheight+'%] now w['+$(this).width()+'] h['+$(this).height()+']');
      }
      // after resizing elements:
      // 1. look to see if the x-bound/y-bound has changed
      // 2. change out the image for a better resolution
      if (pcwidth || pcheight) {
        that.checkImageBound($(this), $(this).find('img.bounded'));
      }
    });
  };
  
  /**
   * Extract percentage and store as data- attribute
   * @param object jQuery object
   * @param string {width|height} axis to extract percentage for 
   */
  this['generate_data_pc'] = function(jq, axis) {
    var elemclass, elemid, elempc = undefined;
    // parse stylesheets for #id:width
    elemid = jq.attr('id');
    if (elemid != undefined) {
      // parse stylesheets for class(n):width
      elempc = this.lookupSelectorProp('#'+elemid, axis, '%');
    }
    if (elempc != undefined) {
      // found width on #id, apply to data
      jq.data('screenpc-'+axis, elempc).addClass('screenpc-ready');
    } else {
      // break class list into array
      elemclass = jq.attr('class').split(' ');
      // search list for a class defined in stylesheet
      for (var i=0 ; i<elemclass.length ; i++) {
        var elemc = elemclass[i];
        // lookup class in style sheets to find width definition
        elempc = this.lookupSelectorProp('.'+elemc, axis, '%');
        if (elempc != undefined) {
          // found property, store in data tag
          jq.data('screenpc-'+axis, elempc).addClass('screenpc-ready');
          // don't carry on the search
          break;
        }
      }
    }
  };
  
  /**
   * Search for a property in a stylesheet class
   * @todo optimise, suggest caching of found rules
   * @param string element selector
   * @param string property to search for
   * @param [string] matchstrip characters to match and strip from the result
   */
  this['lookupSelectorProp'] = function(elem, prop) {
    var matchstrip = undefined;
    // look for optional third argument
    if (arguments.length > 2) {
      matchstrip = arguments[2];
    }
    // iterate over stylesheets
    for (var j=0 ; j<document.styleSheets.length ; j++) {
      var rules = document.styleSheets[0].rules || document.styleSheets[0].cssRules;
      // iterate over rules within current stylesheet
      for (var i=0 ; i < rules.length ; i++) {
        var rule = rules[i];
        // test rule name against elem
        if (endswith(rule.selectorText, elem)) {
          if (debug && false) {
            console.log('matched rule['+rule.selectorText+'] against elem['+elem+']');
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
              } else {
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
   * @param string to search within
   * @param string to search for
   * @return true if the haystack ends with the needle
   */
  this.endswith = function(haystack, needle) {
    // roll on ECMAScript 6
    return haystack.indexOf(needle, haystack.length - needle.length) !== -1;
  };
  
  /**
   * update (x/y)-bound on image
   * @param jQuery object parent container, which has changed size
   * @param jQuery object bounded image within
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
      console.log('cx['+cx+'] cy['+cy+'] cratio['+cratio+'], ix['+ix+'] iy['+iy+'] iratio['+iratio+']: '+(cratio / iratio).toPrecision(3)+'= '+direction+'-bound');
    }
    // apply class to image
    jqImg.addClass(direction+'-bound').removeClass(invdir+'-bound');
  };
  
  // call init function
  this.init();

})(jQuery, undefined);