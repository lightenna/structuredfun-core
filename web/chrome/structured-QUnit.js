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
    sfun.push('headerAddButton', obj);
  };

  this['getTemplate'] = function() {
    var str = '<p><a href="#" id="header-test">{{ title }}</a></p>';
    return str;
  }

  this['bindToTemplate'] = function() {
    var that = this;
    return(function(obj) {
      $('#header-test').click(that.getClickHandler());
    });
  }

  this['getClickHandler'] = function() {
    var that = this;
    return(function(event) {
      // write QUnit harness into page
      var qs = '<div id="qunit"></div><div id="qunit-fixture"></div>';
      $('body').prepend(qs);
      // execute tests
      that.tests();
    });
  }

  // call init function
  this.init();

  // -----
  // TESTS
  // -----

  /**
   * execute tests
   */
  this['tests'] = function() {
    QUnit.init();
    test( "hello test", function() {
      ok( 1 == "1", "Passed!" );
    });
    QUnit.start();
  }

})(jQuery, window.sfun, undefined);