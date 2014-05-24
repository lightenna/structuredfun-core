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
    var obj = {
      'view': {
        'title': 'Test'
      },
      'template': this.getTemplate(),
      'callbackBind' : this.bindToTemplate()
    };
    sfun.headerAddButton(obj);
  };

  this['getTemplate'] = function() {
    var str = '<a href="" id="header-test">{{ title }}</a>';
    return str;
  }

  this['bindToTemplate'] = function() {
    var that = this;
    return(function(obj) {
      $('#header-test').click(this.getClickHandler());
    });
  }

  this['getClickHandler'] = function() {
    var that = this;
    return(function(event) {
      console.log('test button clicked');
    });
  }

  // call init function
  this.init();

})(jQuery, window.sfun, undefined);