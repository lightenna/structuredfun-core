/**
 * StructuredFun javascript
 */
(function($, undefined) {

	// constants
	var numberOfImageVariants = 4;
	var ARG_SEPARATOR = '~args&';

	// hunt out sfun-thumb images and attach resize listener
	$(document).ready(function() {
		$('.sfun-thumb').click(function() {
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
					var newsrc = $(im).data('base-src') + ARG_SEPARATOR + 'maxwidth=' + req;
					$(im).attr('src', newsrc);
				}
			}
			// don't bubble up the event
			return(false);
		});
	});

})(jQuery, undefined);