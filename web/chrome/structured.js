/**
 * StructuredFun javascript
 */
(function($, undefined) {

  // constants
  var numberOfImageVariants = 4;
  
  // group images up into bundles of bundleSize
  $(document).ready(function() {
    // setup defaults
    if ($.cookie('sfun_bundleSize') == undefined) {
      // default value X to expire after Y days
      $.cookie('sfun_bundleSize', 6, 30);
    }
    if ($.cookie('sfun_bundleOrientation') == undefined) {
      // default value X to expire after Y days
      $.cookie('sfun_bundleOrientation', 'horiz', {path: '/', expires: 30});
    }
    // apply current orientation to content
    applyOrientation($.cookie('sfun_bundleOrientation'));
    // attach listeners to buttons
    $('#sfun-horiz').click(function() {
      $.cookie('sfun_bundleOrientation', 'horiz', {path: '/', expires: 30});
      applyOrientation($.cookie('sfun_bundleOrientation'));
      // START HERE
      // re-bundle!
      // then do auto-fill
      return false;
    });
    $('#sfun-vert').click(function() {
      $.cookie('sfun_bundleOrientation', 'vert', {path: '/', expires: 30});
      applyOrientation($.cookie('sfun_bundleOrientation'));
      return false;
    });
    // get bundleSize from cookie
    createBundles(
      $('ul.bundleable'),
      'ul',
      'li',
      $.cookie('sfun_bundleOrientation') == 'horiz' ? $.cookie('sfun_bundleSize') : 0,
      'bundle'
    );
  });

  // catch window resize
  $(window).resize(function() {
    // check all the thumbnails
    $('.thumb').each(function() {
      var im = this;
      // if the image is oversampled
      if (im.clientWidth > $(im).data('loaded-width')) {
        // and the original image is bigger than the one we loaded
        if ($(im).data('loaded-width') < $(im).data('native-width')) {
          // calculate the variant intervals
          var interval = $(im).data('native-width') / numberOfImageVariants;
          // get the variant equal to or slightly bigger than we need
          var req = (Math.floor(im.clientWidth / interval) + 1) * interval;
          // swap the image for a bigger one
          // assumption: no other args on im image
          var newsrc = $(im).data('base-src') + 'maxwidth=' + req;
          $(im).attr('src', newsrc);
        }
      }
    });
  });

  /**
   * @param jq jQuery object
   * @param bundle_type html DOM object type to use for each bundle
   * @param list_item string to match items within jq
   * @param length items per bundle, or 0 to auto-detect
   * @param jq jQuery object
   * @todo optimise
   */
  function createBundles(jq, bundle_type, list_item, length, bclass) {
    var bundle = null, seq = 0;
    // loop through all the images
    jq.find(list_item).each(function() {
      // if the last bundle is empty or full, create it
      if ((bundle == null) || (bundle.find(list_item).length >= length)) {
        bundle = $('<'+bundle_type+'></'+bundle_type+'>').appendTo(jq.parent());
        bundle.addClass(bclass+' '+'bundle-t'+length);
        bundle.addClass();
        bundle.attr('data-seq', seq++);
      }
      // move the current list item into the bundle
      $(this).appendTo(bundle);
    });
    // if it's empty, remove the original list
    if (jq.find(list_item).length == 0) {
      jq.remove();
    }
  }

  /**
   * Apply orientation to gallery
   * @param orient {horiz | vert} 
   */
  function applyOrientation(orient) {
    var jq = $('.content');
    jq.removeClass('content-horiz');
    jq.removeClass('content-vert');
    jq.addClass('content-'+orient);
  }
  
})(jQuery, undefined);