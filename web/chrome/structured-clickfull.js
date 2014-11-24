/**
 * StructuredFun javascript
 * clickfull: click image to fullscreen tool
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
      'key' : 'flow',
      'callback' : cf_register,
    };
    // not sure of init order, so push async
    sfun.push('registerTool', obj);
  };

  // Layout API

  /**
   * called by sfun when ready
   */
  var cf_register = function() {
  }

  //
  // FUNCTIONS: Helpers
  // begin _
  //

  // call init function
  init();

})(jQuery, window.sfun, undefined);
