/**
 * StructuredFun javascript
 * flow: layout engine (v2)
 *
 */
(function($, sfun, undefined) {

  // ---------
  // CONSTANTS
  // ---------

  var debug = true;
  var $document = $(document);

  // ---------
  // FUNCTIONS
  // ---------

  var init = function() {
    var obj = {
      'context' : this,
      'key' : 'flow2',
      'receiverRegistered' : flow_registered,
      'receiverLayoutResized' : flow_layoutResized,
    };
    // not sure of init order, so push async
    // sfun.push('registerLayout', obj);
  };

  // Layout API

  /**
   * called by sfun when ready
   */
  var flow_registered = function() {
    $('.resizeablecell').addClass('resizepending');
  }

  /**
   * refresh the visible cell sizes by minor axis then major
   * @param {object} range {first_1, last_n, selected} range of sequence numbers to resize
   */
  var flow_layoutResized = function(range) {
    var that = this;
    var direction = sfun.api_getDirection();
    var $selected = sfun.api_getCell(range.selected);
    if (!$selected.length) {
      // if we can't find the selected image, just use the first
      $selected = sfun.api_getCell(range.first_1);
    }
    // record the initial absolute coord of the image
    var selectedMajorCoordabsInitial = (direction == 'x' ? $selected.offset().left : $selected.offset().top);
    // use range to refresh visible cells
    // use position in normalX

    // return a resolved deferred in case we wait to make any of this resync in the future
    return $.Deferred().resolve();
  }

  //
  // FUNCTIONS: Helpers
  //

  // call init function
  init();

})(jQuery, window.sfun, undefined);
