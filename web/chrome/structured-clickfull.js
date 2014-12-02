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
      'key' : 'clickfull',
      'receiverRegistered' : cf_receiverRegistered,
      'receiverImageClicked' : cf_receiverImageClicked,
      'receiverKeyPressed' : cf_receiverKeyPressed,
    };
    // not sure of init order, so push async
    sfun.push('registerTool', obj);
  };

  /**
   * called by sfun when ready
   */
  var cf_receiverRegistered = function() {
    // no actions
  }

  /**
   * process a click on an image
   * downstream of: EVENT image click, HANDLER image click
   * @param {object} event raw DOM event
   * @param {object} $ent jQuery object
   * @param {string} selector (type.class) for the click target
   */
  var cf_receiverImageClicked = function(event, $ent, selector) {
    switch (selector) {
      case 'input':
      case 'textarea':
      case 'span.editable':
        break;
      default:
        var seq = $ent.data('seq');
        // select image, then toggle
        _imageToggleFullscreen(seq);
        // stop the event from bubbling up, leave active
        event.preventDefault();
        break;
    }
  };

  /**
   * process events generated by key presses
   * downstream of: EVENT key pressed, HANDLER key pressed
   * @return {object} jQuery deferred
   */
  var cf_receiverKeyPressed = function(event, eventContext) {
    // process key press
    switch (event.which) {
      case sfun.KEY_RETURN:
        var seq = sfun.api_getSeq();
        // stop the event from bubbling up, leave active
        event.preventDefault();
        return _imageToggleFullscreen(seq, eventContext);
    }
    return null;
  }

  //
  // FUNCTIONS: Helpers
  // begin _
  //

  /**
   * switch between the default breadth and fullscreen
   * @param {int} seq image to make fullscreen
   * @param {object} eventContext optional event context for decorating an existing deferred
   * @return {object} jQuery deferred
   */
  var _imageToggleFullscreen = function(seq, eventContext) {
    var $ent = sfun.api_$img(seq);
    switch (sfun.api_getType($ent)) {
      case 'image':
        var offseq = sfun.api_imageCentreOffseq(sfun.api_getDirection());
        // toggle using hash change
        if (sfun.api_getBreadth() == 1) {
          return sfun.api_fireHashUpdate( sfun.api_overwritePreviousState({ 'seq': seq }), false, eventContext);
        } else {
          return sfun.api_fireHashUpdate( { 'breadth': 1, 'seq': seq, 'offseq': offseq }, false, eventContext);
        }
        break;
      case 'directory':
        var $clickable = $ent.cachedFind('.clickable');
        if ($clickable.length) {
          window.location = $clickable.attr('href');
        }
        break;
    }
    return sfun.api_getEventQueue().resolve(eventContext);
  };

  // call init function
  init();

})(jQuery, window.sfun, undefined);
