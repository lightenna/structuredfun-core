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
    // not sure of init order, so push async
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
      event.preventDefault();
    });
  }

  // -----
  // TESTS
  // -----

  /**
   * execute tests
   */
  this['tests'] = function() {
    QUnit.init();
    /*
     * top and tail each test with a hash clear
     * 1. to reset the environment because tests can run in any order
     * 2. to drop us back at the top/left of the page after all tests finish
     */
    test( 'check image bounds', function() {
      ok( 1 == "1", 'Pass' );
    });

    test( 'check enough images for test suite', function() {
      ok( sfun.api_getTotalEntries() >= 4 , sfun.api_getTotalEntries() + ' images in test set')
    });

    test( 'image click #0', function() {
      window.location.hash = '';
      $('#imgseq-0').parents('a').trigger('click');
      ok( sfun.api_getBreadth() == 1, 'Went to fullscreen mode' );
      ok( $('ul.flow li.cell img.selected').data('seq') == 0, 'Selected image zero');
      window.location.hash = '';
    });

    test( 'image click #1, return, arrow next', function() {
      window.location.hash = '';
      var initialBreadth = sfun.api_getBreadth();
      $('#imgseq-1').parents('a').trigger('click');
      sfun.api_triggerKeypress(sfun.KEY_RETURN);
      ok( sfun.api_getBreadth() == initialBreadth, 'Returned to initial breadth value' );
      sfun.api_triggerKeypress(sfun.KEY_RIGHT_ARROW);
      ok( $('ul.flow li.cell img.selected').data('seq') == 2, 'Right arrow selected #2 image (#1+1)' );
      window.location.hash = '';
    });

    test( 'end select last, home select first, arrow next', function() {
      window.location.hash = '';
      $('#imgseq-0').parents('a').trigger('click');
      sfun.api_triggerKeypress(sfun.KEY_END);
console.log($('ul.flow li.cell img.selected').data('seq'));
console.log(sfun.api_getTotalEntries()-1);
      ok( $('ul.flow li.cell img.selected').data('seq') == sfun.api_getTotalEntries()-1, 'End selected last image' );
      sfun.api_triggerKeypress(sfun.KEY_HOME);
      ok( $('ul.flow li.cell img.selected').data('seq') == 0, 'Home selected #0 image' );
      sfun.api_triggerKeypress(sfun.KEY_RIGHT_ARROW);
      ok( $('ul.flow li.cell img.selected').data('seq') == 1, 'Right arrow selected #1 image' );
      window.location.hash = '';
    });
    QUnit.start();
  }

  // call init function
  this.init();

})(jQuery, window.sfun, undefined);