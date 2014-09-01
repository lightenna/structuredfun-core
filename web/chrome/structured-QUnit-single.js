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

    test( 'rapid scroll event queuing', function() {
      window.location.hash = 'rapid-scroll';
      var direction = sfun.api_getDirection();
      QUnit.stop();
      sfun.api_triggerKeypress(sfun.KEY_HOME).done(function() {
        var initialSeq = $('ul.flow .selectablecell.selected').data('seq');
        // scroll to last element
        sfun.api_triggerKeypress(sfun.KEY_END).done(function() {
          var finalSeq = sfun.api_getTotalEntries()-1;
          var $selected = $('ul.flow .selectablecell.selected');
          equal( $selected.data('seq'), finalSeq, 'Selected last image (#'+finalSeq+')' );
          // store major axis position of final image then use to calculate scroll limit
          var position = $selected.offset();
          var limitPos = (direction == 'x' ? position.left - sfun.api_getViewportWidth() : position.top - sfun.api_getViewportHeight());
          // scroll to middle
          var middleSeq = Math.floor((finalSeq - initialSeq) / 2);
          // scroll to middle image
          sfun.api_imageAdvanceTo(middleSeq).done(function() {
            $selected = $('ul.flow .selectablecell.selected');
            equal($selected.data('seq'), middleSeq, 'Selected middle image (#'+middleSeq+')' );
            // use position of middle image as startPos
            var position = $selected.offset();
            var startPos = (direction == 'x' ? position.left : position.top);
            // check that we have 1000 pixels to scroll within
            if (limitPos - startPos < 1000) {
              ok(true, 'image set not large enough to conduct scroll test');
            } else {
              // work out where we should end up
              var iterCount = 100;
              var iterMux = 10;
              var target = {
                'left': (direction == 'x' ? startPos + iterCount*iterMux : 0),
                'top': (direction == 'x' ? 0 : startPos + iterCount*iterMux)
              };
              // bind to final scroll event
              var targetKey = 'scroll:x='+target.left+'&y='+target.top;
              sfun.api_bindToContext(targetKey).done(function() {
                ok(true, 'target scroll event ('+targetKey+') triggered and resolved');
                QUnit.start();
              });
              var iter = { 'left': 0, 'top': 0 };
              // fire 100 x 10px scroll events in sequence
              for (var i=0 ; i<=iterCount ; i++) {
                if (direction == 'x') {
                  iter.left = startPos + (i * iterMux);
                } else {
                  iter.top = startPos + (i * iterMux);
                }
// START HERE
// slow down firing by using callback
                // fire, but not using api_triggerScroll, as browser drag doesn't do that!
                $(document).scrollLeft(iter.left);
                $(document).scrollTop(iter.top);
              }
              // test scroll position
              var endPos = (direction == 'x' ? $(document).scrollLeft() : $(document).scrollTop());
              equal(endPos, startPos + iterCount*iterMux, 'finished in correct scroll position');
            }
            endTest();
          });
        });
      });
    });

    QUnit.start();
  }

  // call init function
  init();

})(jQuery, window.sfun, undefined);