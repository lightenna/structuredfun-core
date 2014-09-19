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

  var init = function() {
    var obj = {
      'context': this,
      'callback': bindToTemplate,
      'view': {
        'title': 'Test'
      },
      'template': getTemplate()
    };
    // once script is loaded and executes, push header button async
    sfun.push('headerAddButton', obj);
  };

  var getTemplate = function() {
    var str = '<p><a href="#" id="header-test-single">{{ title }}</a></p>';
    return str;
  }

  var bindToTemplate = function(obj) {
    $('#header-test-single').click(getClickHandler());
  }

  var getClickHandler = function() {
    return(function(event) {
      // write QUnit harness into page
      var qs = '<div id="qunit"></div><div id="qunit-fixture"></div>';
      $('body').prepend(qs);
      // pull in QUnit library (triggers scroll:x=0&y=0)
      $.getScript("/chrome/vendor/qunit/qunit-1.14.0.min.js").done(function() {
        // execute tests
        tests();
      });
      event.preventDefault();
    });
  }

  // -----
  // TESTS
  // -----

  /**
   * execute tests
   */
  var tests = function() {
    QUnit.init();
    var endTest = function() {
      window.location.hash = '#!';
    }

    test( 'reres of last page of images', function() {
      // expand qunit div (page-left) to force a vertical scrollbar (page-right)
      $('#qunit').height(2000);
      QUnit.stop();
      sfun.api_triggerKeypress(sfun.KEY_END).done(function() {
        equal( $('ul.flow .selectablecell.selected').data('seq'), (sfun.api_getTotalEntries()-1), 'End selected last image' );
        $('ul.flow .selectablecell.visible .reresable').each(function() {
          var imw = $(this).width(), imh = $(this).height();
          var $ent = $(this).parents('li');
          var lodw = $(this).data('loaded-width'), lodh = $(this).data('loaded-height');
          // test that loaded res > image res
          ok( imw <= lodw && imh <= lodh, 'image #'+$ent.data('seq')+' ('+imw+'x'+imh+') loaded('+lodw+'x'+lodh+')');
          // test that the cell has the correct bound on it
          var cratio = $ent.width() / $ent.height();
          var iratio = imw / imh;
          var correctBound = ((cratio / iratio) > 1.0 ? 'y' : 'x');
          if (correctBound == 'x') {
            ok($(this).hasClass('x-bound'), 'image #'+$ent.data('seq')+' ('+imw+'x'+imh+') in cell ('+$ent.width()+'x'+$ent.height()+') should be x-bound');
          } else {
            ok($(this).hasClass('y-bound'), 'image #'+$ent.data('seq')+' ('+imw+'x'+imh+') in cell ('+$ent.width()+'x'+$ent.height()+') should be y-bound');
          }
        });
        QUnit.start();
        endTest();
      });
    });

    QUnit.start();
  }

  // call init function
  init();

})(jQuery, window.sfun, undefined);