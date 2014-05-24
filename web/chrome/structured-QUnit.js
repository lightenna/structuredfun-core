/**
 * StructuredFun javascript
 * QUnit test harness
 */
(function($, sfun, undefined) {

  // ---------
  // CONSTANTS
  // ---------

  // ---------
  // FUNCTIONS
  // ---------

  this.init = function() {
    sfun.headerAddButton({ 'title': 'Test', 'template': this.getTemplate(), 'handler' : this.getClickHandler() });
  };

  this['getClickHandler'] = function() {
    var that = this;
    return(function(event) {
      console.log('test button clicked');
    });
  }

  // call init function
  this.init();

})(jQuery, undefined);