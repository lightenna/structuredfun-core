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
      'context': this,
      'callback': this.bindToTemplate,
      'view': {
        'title': 'Test'
      },
      'template': this.getTemplate()
    };
    // pull in QUnit library
    // $.getScript("/chrome/vendor/qunit/qunit-1.14.0.min.js").done(function() {
    //   // once script is loaded and executes, push header button async
    //   sfun.push('headerAddButton', obj);
    // });
  };

  this['getTemplate'] = function() {
    var str = '<p><a href="#" id="header-test">{{ title }}</a></p>';
    return str;
  }

  this['bindToTemplate'] = function(obj) {
    $('#header-test').click(this.getClickHandler());
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
    var endTest = function() {
      window.location.hash = '#!';
    }
    /*
     * top and tail each test with a hash clear (needs to be different to clear it)
     * 1. to reset the environment because tests can run in any order
     * 2. to drop us back at the top/left of the page after all tests finish
     */
/*
    test( 'check vistable working', function() {
      var vt = sfun.api_createVisTable();
      vt.add([-6, 0, 1, 10, 14, 18, 22, 99, 1000, 1000, 1001]);
      equal( vt.findCompare(16, sfun.compareLTE), 4, 'vistable found 14 <= 16');
      equal( vt.findCompare(16, sfun.compareGTE), 5, 'vistable found 18 >= 16');
      equal( vt.findCompare(18, sfun.compareLTE), 5, 'vistable found 18 <= 18');
      equal( vt.findCompare(18, sfun.compareGTE), 5, 'vistable found 18 >= 18');
      equal( vt.findCompare(17.99, sfun.compareGTE), 5, 'vistable found 18 >= 17.99');
      equal( vt.findCompare(1, sfun.compareGTE), 2, 'vistable found 1 >= 1');
      equal( vt.findCompare(-9999, sfun.compareGTE), 0, 'vistable found -6 >= -9999');
      equal( vt.findCompare(-9999, sfun.compareLTE), -1, 'vistable found nothing <= -9999');
      equal( vt.findCompare(9999, sfun.compareGTE), -1, 'vistable found nothing >= 9999');
    });
*/
    test( 'check enough images for test suite', function() {
      ok( sfun.api_getTotalEntries() >= 4 , sfun.api_getTotalEntries() + ' images in test set')
      // check basic properties of visTableMajor
      var vt = sfun.api_getVisTableMajor();
      equal( sfun.api_getTotalEntries(), vt.length, vt.length + ' images in vistable');
    });

/*
    test( 'reres of first page of images', function() {
      QUnit.stop();
      sfun.api_triggerKeypress(sfun.KEY_HOME).then(function() {
        ok( $('ul.flow .selectablecell.selected').data('seq') == 0, 'Home selected #0 image' );
        $('ul.flow .selectablecell.visible .reresable').each(function() {
          var imw = $(this).width(), imh = $(this).height();
          var jqEnt = $(this).parents('li');
          var lodw = $(this).data('loaded-width'), lodh = $(this).data('loaded-height');
          ok( imw <= lodw && imh <= lodh, 'image #'+jqEnt.data('seq')+' ('+imw+'x'+imh+') loaded('+lodw+'x'+lodh+')');
        });
        endTest();
        QUnit.start();
      });
    });
*/
    test( 'reres of last page of images', function() {
      QUnit.stop();
      sfun.api_triggerKeypress(sfun.KEY_END).then(function() {
        ok( $('ul.flow .selectablecell.selected').data('seq') == (sfun.api_getTotalEntries()-1), 'End selected last image' );
        $('ul.flow .selectablecell.visible .reresable').each(function() {
          var imw = $(this).width(), imh = $(this).height();
          var jqEnt = $(this).parents('li');
          var lodw = $(this).data('loaded-width'), lodh = $(this).data('loaded-height');
          ok( imw <= lodw && imh <= lodh, 'image #'+jqEnt.data('seq')+' ('+imw+'x'+imh+') loaded('+lodw+'x'+lodh+')');
        });
        QUnit.start();
        endTest();
      });
    });
/*
    test( 'check image bounds', function() {
      QUnit.stop();
      $('ul.flow .selectablecell.visible .boundable').each(function() {
        var tolerance = 1;
        var imw = $(this).width(), imh = $(this).height();
        var jqEnt = $(this).parents('li');
        var cellw = jqEnt.width(), cellh = jqEnt.height();
        var withinWidth = (imw <= cellw + tolerance);
        var withinHeight = (imh <= cellh + tolerance);
        ok( withinWidth && withinHeight, 'image #'+jqEnt.data('seq')+' ('+imw+'x'+imh+') bounded within it\'s cell ('+cellw+'x'+cellh+')' );
      }).promise().done(function() {
        QUnit.start();
      });
    });

    test( 'image click #0', function() {
      window.location.hash = 'image_click_0';
      $('#seq-0').find('a').trigger('click');
      ok( sfun.api_getBreadth() == 1, 'Went to fullscreen mode' );
      ok( $('ul.flow .selectablecell.selected').data('seq') == 0, 'Selected image zero');
      endTest();
    });

    test( 'image click #1, return, arrow next', function() {
      window.location.hash = 'image_click_1';
      var initialBreadth = sfun.api_getBreadth();
      $('#seq-1').find('a').trigger('click');
      sfun.api_triggerKeypress(sfun.KEY_RETURN);
      ok( sfun.api_getBreadth() == initialBreadth, 'Returned to initial breadth value ('+initialBreadth+')' );
      sfun.api_triggerKeypress(sfun.KEY_ARROW_RIGHT);
      ok( $('ul.flow .selectablecell.selected').data('seq') == 2, 'Right arrow selected #2 image (#1+1)' );
      endTest();
    });

    test( 'set breadth 4, image click #1, return', function() {
      window.location.hash = 'breadth_4_image_click_1';
      sfun.api_triggerKeypress(sfun.KEY_NUMBER_4);
      ok( sfun.api_getBreadth() == 4, 'Selected breadth value 4' );
      // click to fullscreen, then return back
      $('#seq-1').find('a').trigger('click');
      sfun.api_triggerKeypress(sfun.KEY_RETURN);
      ok( sfun.api_getBreadth() == 4, 'Returned to breadth value (4)' );
      endTest();
    });

    test( 'end select last, home select first, arrow next', function() {
      window.location.hash = 'end_select_last';
      $('#seq-0').parents('a').trigger('click');
      sfun.api_triggerKeypress(sfun.KEY_END);
      ok( $('ul.flow .selectablecell.selected').data('seq') == (sfun.api_getTotalEntries()-1), 'End selected last image' );
      sfun.api_triggerKeypress(sfun.KEY_HOME);
      ok( $('ul.flow .selectablecell.selected').data('seq') == 0, 'Home selected #0 image' );
      sfun.api_triggerKeypress(sfun.KEY_ARROW_RIGHT);
      ok( $('ul.flow .selectablecell.selected').data('seq') == 1, 'Right arrow selected #1 image' );
      endTest();
    });

    test( 'end arrow next wrap-around', function() {
      var last = sfun.api_getTotalEntries()-1;
      window.location.hash = 'end_arrow_next';
      sfun.api_triggerKeypress(sfun.KEY_END);
      ok( $('ul.flow .selectablecell.selected').data('seq') == last, 'End selected last image' );
      sfun.api_triggerKeypress(sfun.KEY_ARROW_RIGHT);
      ok( $('ul.flow .selectablecell.selected').data('seq') == 0, 'Right arrow selected #0 image' );
      sfun.api_triggerKeypress(sfun.KEY_END);
      ok( $('ul.flow .selectablecell.selected').data('seq') == last, 'End re-selected last image' );
      sfun.api_triggerKeypress(sfun.KEY_HOME);
      ok( $('ul.flow .selectablecell.selected').data('seq') == 0, 'Home selected #0 image' );
      endTest();
    });

    test( 'vis non-vis simple', function() {
      var cellcount = sfun.api_getCountMajor() * sfun.api_getBreadth();
      window.location.hash = 'vis-non-vis-simple';
      var initialSeq = $('ul.flow .selectablecell.selected').data('seq');
      // scroll to first off-screen element
      sfun.api_triggerKeypress(sfun.KEY_PAGE_DOWN);
      // wait for keypress event to process
      QUnit.stop();
      setTimeout(function() {
        ok( $('ul.flow .selectablecell.selected').data('seq') != initialSeq, 'Page down selected a different image' );
        // check that first off-screen element (now on-screen) is cellcount
        ok( $('ul.flow .selectablecell.selected').data('seq') == $('#seq-'+cellcount).data('seq'), 'Page down selected the '+(cellcount+1)+'th image (seq '+cellcount+')' );
        // check that selected image is visible
        ok( $('ul.flow .selectablecell.selected').hasClass('visible'), 'Selected cell is visible');
        // check that the first image is not visible
        ok( ! $('#seq-'+initialSeq).hasClass('visible'), 'Initially selected cell is no longer visible');
        endTest();
        QUnit.start();
      }, 1);
    });

    test( 'vis block', function() {
      window.location.hash = 'vis-block';
      sfun.api_triggerKeypress(sfun.KEY_HOME);
      var initialSeq = $('ul.flow .selectablecell.selected').data('seq');
      // scroll to last element
      sfun.api_triggerKeypress(sfun.KEY_END);
      var finalSeq = sfun.api_getTotalEntries()-1;
      ok( $('ul.flow .selectablecell.selected').data('seq') == finalSeq, 'Selected last image (#'+finalSeq+')' );
      // scroll to middle
      var middleSeq = Math.floor((finalSeq - initialSeq) / 2);
      // scroll to middle image
      sfun.api_imageAdvanceTo(middleSeq);
      QUnit.stop();
      setTimeout(function() {
        ok( $('ul.flow .selectablecell.selected').data('seq') == middleSeq, 'Selected middle image (#'+middleSeq+')' );
        // check all visible images are in a single block
        initialSeq = $('ul.flow .selectablecell.visible:first').data('seq');
        finalSeq = $('ul.flow .selectablecell.visible:last').data('seq');
        for (var i = initialSeq ; i <= finalSeq ; ++i) {
          ok( $('#seq-'+i).hasClass('visible'), 'Image in selected block visible (#'+i+')' );
        }
        // check that selected image is within visible range
        ok( initialSeq <= middleSeq && middleSeq <= finalSeq, 'Selected middle image is within visible range');
        endTest();
        QUnit.start();
      }, 1);
    });
*/
    QUnit.start();
  }

  // call init function
  this.init();

})(jQuery, window.sfun, undefined);