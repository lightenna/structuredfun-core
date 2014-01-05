/**
 * StructuredFun javascript
 */
(function($, undefined) {

	// constants
	var numberOfImageVariants = 4;

	// catch window resize
	$(window).resize(function () {
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
	
})(jQuery, undefined);