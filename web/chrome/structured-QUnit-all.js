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
      'receiverRegistered': bindToTemplate,
      'view': {
        'title': 'Test all'
      },
      'template': getTemplate()
    };
    // once script is loaded and executes, push header button async
    sfun.push('headerAddButton', obj);
  };

  var getTemplate = function() {
    var str = '<p class="debug-only"><a href="#" id="header-test-all">{{ title }}</a></p>';
    return str;
  }

  var bindToTemplate = function(obj) {
    $('#header-test-all').click(getClickHandler());
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

  /**
   * schedule multiple tests, usually with different hashbangs contexts
   * note: this (v1) doesn't really work; haven't worked out how to do transition
  var multi_test = function(name, func, bangs) {
    test(name + ' variant 0', func('#!'));
    // delay execution of variants in order to group them
    setTimeout(function() {
      sfun.api_setDirection('x');
      for (var i=0 ; i<bangs.length ; ++i) {
        test(name + ' variant '+(i+1), func(bangs[i]));
      }
    }, 10);
  }
   */

  var multi_test = function(name, func, bangs) {
    test(name + ' variant 0', func(function(){}));
    for (var i=0 ; i<bangs.length ; ++i) {
      test(name + ' variant '+(i+1), func(bangs[i]));
    }
  }

  // -----
  // TESTS
  // -----

  /**
   * execute tests
   */
  var tests = function() {
    QUnit.init();
    var resetTestMarker = '#!';
    var resetTest = function() {
      window.location.hash = resetTestMarker;
    };

    /**
     * maintain a list of functions
     */
    var dupTestList = dupTestList || [];
    var parameteriseTest = function(func) {
      // store function in list
      dupTestList[dupTestList.length] = func;
      // return pointer (for first call)
      return func;
    };

    /**
     * call stored tests
     */
    var recallTests = function(marker) {
      // update the marker, used to reset hashbang after each test
      resetTestMarker = marker;
      for (var i=0 ; i<dupTestList.length ; ++i) {
        // stack test in QUnit for execution
        test('recalled test '+i, dupTestList[i]);
      }
    }

    /*
     * top and tail each test with a hash clear (needs to be different to clear it)
     * 1. to reset the environment because tests can run in any order
     * 2. to drop us back at the top/left of the page after all tests finish
     */

    test( 'check enough images for test suite', function() {
      ok( sfun.api_getTotalEntries() >= 4 , sfun.api_getTotalEntries() + ' images in test set')
      // check basic properties of visTableMajor
      var vt = sfun.api_getVisTableMajor();
      equal( sfun.api_getTotalEntries(), vt.getSize(), ' correct number of images in vistable');
    });

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

    test( 'check longest loading', function() {
      // record initial value to reset after test
      var initial_longest = sfun.api_getLastLongest();
      // set to arbitrary value
      var arbitrary = 328;
      sfun.api_setLastLongest(arbitrary);
      // copy a test cell
      var $cell = $('ul.flow .selectablecell:first').clone();
      var $loadable = $cell.cachedFind('> .container > .loadable');
      // whack existing thumb (src)
      $loadable.attr('src', null);
      // attach to test fixture
      $("#qunit-fixture").append($cell);
      QUnit.stop();
      // reload the cell
      sfun.api_waitLoadCell($cell).done(function() {
        // longest edge should equal arb
        equal(Math.max($loadable.data('loaded-width'), $loadable.data('loaded-height')), arbitrary, 'longest edge matches arbitrary value ('+arbitrary+')');
        QUnit.start();
      });
      // reset last longest and check
      sfun.api_setLastLongest(initial_longest);
      notEqual(initial_longest, arbitrary, 'arbitrary value was valid (different from initial'+initial_longest+')');
      // drop test cell
      $cell.remove();
    });

    test( 'check eventQueue act-on critical delay', function() {
      expect(5);
      var result = true;
      var evq = sfun.api_getEventQueue();
      var localContext = evq.push({
        'key': 'test:act-on critical first'
      });
      // create a second context
      var delayedContext = evq.push({
        'key': 'test:act-on critical delayed'
      });
      // act on first context
      QUnit.stop();
      evq.actOnContext(localContext, function() {
        // check we're now flagged as being in our critical section
        equal( evq.critical_section, localContext, 'localContext is flagged criticalSection');
        // try to act on it; it should get delayed and queued
        evq.actOnContext(delayedContext, function() {
          // use semaphor to mark that we've been run (toggle result)
          result = !result;
          // when we eventually run, should be flagged as being in our critical section
          equal( evq.critical_section, delayedContext, 'delayedContext is flagged criticalSection');
        });
        // check that delayedContext got delayed; result should still be in its original state (true)
        equal(result, true, 'delayedContext has not been run yet');
        QUnit.start();
      });
      // resolve first context
      evq.resolve(localContext);
      // check that delayedContext has not been run
      equal(result, false, 'delayedContext has now been run');
      // check that delayedContext also got resolved
      equal(delayedContext.deferred.state(), 'resolved', 'delayedContext was implicitly resolved');
    });

    test( 'check eventQueue act-on simple with critical', function() {
      expect(3);
      var evq = sfun.api_getEventQueue();
      // no action, just shouldn't generate an error
      evq.actOnContext(null);
      // check nothing is in its critical section
      equal( evq.critical_section, null, 'nothing in criticalSection');
      var localContext = evq.push({
        'key': 'test:act-on simple',
        'comment': 'localContext for check eventQueue act-on simple test'
      });
      // act on simple context
      QUnit.stop();
      evq.actOnContext(localContext, function() {
        // check we're now flagged as being in our critical section
        equal( evq.critical_section, localContext, 'localContext is flagged criticalSection');
        QUnit.start();
      });
      evq.resolve(localContext);
      notEqual( evq.critical_section, localContext, 'localContext is no longer flagged as criticalSection');
    });

    test( 'check eventQueue act-on replace', function() {
      expect(1);
      var evq = sfun.api_getEventQueue();
      var localContext = evq.push({
        'key': 'test:act-on replace',
        'comment': 'localContext for check eventQueue simple test',
        'replaceEvent': true
      });
      // act-on the replaced function, not the passed one
      QUnit.stop();
      evq.actOnContext(localContext, function() {
        ok(false, 'act on '+localContext.key+' not replacing event');
        QUnit.start();
      });
      // check that the localContext gets resolved without calling func
      localContext.deferred.then(function() {
        ok(true, 'act on '+localContext.key+' resolved properly');
        QUnit.start();
      });
      evq.resolve(localContext);
    });

    test( 'check eventQueue parent multi-child', function() {
      // use expect to ensure that we get our async test
      expect(3);
      var evq = sfun.api_getEventQueue();
      // push a parent context
      var parentContext = evq.push({
        'key': 'test:parent multi',
        'comment': 'parent context for check eventQueue parent multi-child test',
      });
      // push first child context
      var child1 = evq.push({
        'key': 'test:child1',
        'comment': 'child1 context for check eventQueue parent multi-child test'
      });
      // create second child, then parent (two stage)
      var child2 = evq.push({
        'key': 'test:child2',
        'comment': 'child2 context for check eventQueue parent multi-child test'
      });
      evq.parent(child1, parentContext);
      evq.parent(child2, parentContext);
      // setup add-mux test variable
      var result = 3;
      // attach functions to each context
      var muxten = function() {
        result = result * 10;
      };
      child1.deferred.done(muxten);
      child2.deferred.done(muxten);
      parentContext.deferred.done(function() {
        result = result - 1;
        equal( result, 299, 'result = 3 * 10 * 10 - 1');
      });
      // pull the child1 context
      var retrievedContext = evq.get('test:child1');
      // resolve child1
      evq.resolve(retrievedContext);
      // check that neither parent nor child2 have been resolved
      equal( result, 30, 'result = 3 * 10 after only child1 resolved');
      equal( parentContext.deferred.state(), 'pending', 'parent is still pending');
      // resolve child2
      evq.resolve(child2);
    });

    test( 'check eventQueue parent', function() {
      // use expect to ensure that we get our async test
      expect(3);
      var evq = sfun.api_getEventQueue();
      // push a parent context
      var parentContext = evq.push({
        'key': 'test:parent',
        'comment': 'parent context for check eventQueue parent test'
      });
      // push a child context
      var childContext = evq.push({
        'key': 'test:child',
        'comment': 'child context for check eventQueue parent test'
      });
      evq.parent(childContext, parentContext);
      // setup add-mux test variable
      var result = 3;
      // attach functions to each context
      childContext.deferred.done(function() {
        console.log('child');
        result = result * 10;
      });
      parentContext.deferred.done(function() {
        console.log('parent');
        result = result - 1;
      });
      $.when(childContext.deferred, parentContext.deferred).done(function() {
        // result = 3 * 10 - 1; result = 20 means parent is resolving before child
        equal( result, 29, 'result = 3 * 10 - 1');
      })
      // pull the child context
      var retrievedContext = evq.get('test:child');
      // check that it's pending
      equal( retrievedContext.deferred.state(), 'pending', 'context is pending');
      // resolve
      evq.resolve(retrievedContext);
      // check that it's resolved [sync]
      equal( retrievedContext.deferred.state(), 'resolved', 'context is now resolved [sync]');
    });

    test( 'check eventQueue simple', function() {
      // use expect to ensure that we get our async test
      expect(4);
      var evq = sfun.api_getEventQueue();
      // push a context
      var localContext = evq.push({
        'key': 'test:simple',
        'comment': 'localContext for check eventQueue simple test'
      });
      // fetch back context
      var retrievedContext = evq.get('test:simple');
      equal( localContext, retrievedContext, 'retrieved context same as local');
      retrievedContext.deferred.done(function() {
        // check that it's resolved [async]
        equal( localContext.deferred.state(), 'resolved', 'context is now resolved [async]');
      });
      // check that it's pending
      equal( localContext.deferred.state(), 'pending', 'context is pending');
      // resolve
      evq.resolve(retrievedContext);
      // check that it's resolved [sync]
      equal( localContext.deferred.state(), 'resolved', 'context is now resolved [sync]');
    });

    test( 'check eventQueue merged', function() {
      // use expect to ensure that we get our async test
      expect(7);
      var evq = sfun.api_getEventQueue();
      // push a context
      var localContext = evq.push({
        'key': 'test:simple pre-merge',
        'comment': 'localContext for check eventQueue simple test'
      });
      // merge in a second context
      var mergedContext = evq.pushOrMerge({
        'key': 'test:merged',
        'comment': 'second context created to merge localContext and mergedContext',
      }, localContext);
      // fetch back context
      var retrievedContext = evq.get('test:merged');
      equal( mergedContext, retrievedContext, 'retrieved context same as local');
      retrievedContext.deferred.done(function() {
        // check that both contexts get resolved [async]
        equal( localContext.deferred.state(), 'resolved', 'local context is now resolved [async]');
        // check that merged gets resolved [async]
        equal( mergedContext.deferred.state(), 'resolved', 'merged context is now resolved [async]');
      });
      // check that both contexts are pending
      equal( localContext.deferred.state(), 'pending', 'local context is pending');
      equal( mergedContext.deferred.state(), 'pending', 'merged context is pending');
      // resolve just one (retrieved) merged context
      evq.resolve(retrievedContext);
      // check that it's resolved [sync]
      equal( localContext.deferred.state(), 'resolved', 'local context is now resolved [sync]');
      equal( mergedContext.deferred.state(), 'resolved', 'merged context is now resolved [sync]');
    });

    test( 'check image bounds', function() {
      QUnit.stop();
      $('ul.flow .selectablecell.visible .boundable').each(function() {
        var tolerance = 1;
        var imw = $(this).width(), imh = $(this).height();
        var $ent = $(this).parents('li');
        var cellw = $ent.width(), cellh = $ent.height();
        var withinWidth = (imw <= cellw + tolerance);
        var withinHeight = (imh <= cellh + tolerance);
        ok( withinWidth && withinHeight, 'image #'+$ent.data('seq')+' ('+imw+'x'+imh+') bounded within it\'s cell ('+cellw+'x'+cellh+')' );
      }).promise().done(function() {
        QUnit.start();
      });
    });

    /**
     * URL-reactive tests
     */

    multi_test( 'check vistable refresh', function(arg) { return function() {
      resetTest(arg);
      var direction = sfun.api_getDirection();
      var breadth = sfun.api_getBreadth();
      var vt = sfun.api_createVisTable();
      var vt_partial = sfun.api_createVisTable();
      var $cells = $('ul.flow .selectablecell');
      if ($cells.length < (4 * breadth)) {
        ok(false, "Not enough cells " + $cells.length + "to conduct test");
      } else {
        var ref3 = 2 * breadth, ref4 = 3 * breadth;
        var off3 = $cells.eq(ref3).offset(), off4 = $cells.eq(ref4).offset();
        var major3 = Math.floor(direction == 'x' ? off3.left : off3.top), major4 = Math.floor(direction == 'x' ? off4.left : off4.top);
        // update all vis table entries
        vt.updateAll(direction, $cells);
        // look for major3 and major4 to check mid-array load
        equal( vt.findCompare(major3, sfun.compareGTE), ref3, 'vistable found major 3 at ref 3');
        equal( vt.findCompare(major4, sfun.compareGTE), ref4, 'vistable found major 4 at ref 4');
        // update only some entries in vt_partial
        // this creates a sparse array, which isn't typical
        vt_partial.updateRange(direction, ref3, ref4);
        // look for first and last to check partials
        equal( vt_partial.findCompare(0, sfun.compareGTE), ref3, 'vistable found ref 3 >= 0');
        equal( vt_partial.findCompare(9999, sfun.compareLTE), ref4, 'vistable found ref 4 <= 9999');
        // imagine we expand the size of column 3 and calculate delta_b
        var delta_b = 50;
        // apply delta to affected cells
        vt_partial.keyShift(ref4, vt_partial.getSize()-1, delta_b);
        // check update
        var major4b = vt_partial.select(ref4).key;
        equal( major4b, major4 + delta_b, 'delta correctly applied to post range cells');
      }
      resetTest(arg);
    }; }, ['#!direction=x']);

    multi_test( 'reres of first page of images', function(arg) { return function() {
      resetTest(arg);
      QUnit.stop();
      sfun.api_triggerKeypress(sfun.KEY_HOME).done(function() {
        equal( $('ul.flow .selectablecell.selected').data('seq'), 0, 'Home selected #0 image' );
        $('ul.flow .selectablecell.visible .reresable').each(function() {
          var imw = $(this).width(), imh = $(this).height();
          var $ent = $(this).parents('li');
          var lodw = $(this).data('loaded-width'), lodh = $(this).data('loaded-height');
          ok( imw <= lodw && imh <= lodh, 'image #'+$ent.data('seq')+' ('+imw+'x'+imh+') loaded('+lodw+'x'+lodh+')');
        });
        resetTest(arg);
        QUnit.start();
      });
    }; }, ['#!direction=x']);

    multi_test( 'reres of last page of images', function(arg) { return function() {
      resetTest(arg);
      // expand div (page-left) to force a vertical scrollbar (page-right)
      var original_height = $('#qunit').height();
      $('#qunit').height(3000);
      // refresh vistable incase QUnit fixture has upset offsets
      sfun.api_getVisTableMajor().updateAll(sfun.api_getDirection(), $('ul.flow .selectablecell'));
      // run test asynchronously
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
        resetTest(arg);
        // restore QUnit to original height
        $('#qunit').height(original_height);
      });
    }; }, ['#!direction=x']);

    multi_test( 'image click #0', function(arg) { return function() {
      resetTest(arg);
      $('#seq-0').find('a').trigger('click');
      ok( sfun.api_getBreadth() == 1, 'Went to fullscreen mode' );
      ok( $('ul.flow .selectablecell.selected').data('seq') == 0, 'Selected image zero');
      resetTest(arg);
    }; }, ['#!direction=x']);

/*
    test( 'image click #1, return, arrow next', function() {
      window.location.hash = 'image_click_1';
      var initialBreadth = sfun.api_getBreadth();
      QUnit.stop();
      sfun.api_triggerClick($('#seq-1').find('a')).done(function() {
        equal(sfun.api_getSeq(), 1, 'Click selected #1 image');
        equal(sfun.api_getBreadth(), 1, 'Showing image full-screen');
        sfun.api_triggerKeypress(sfun.KEY_RETURN).done(function() {
          equal(sfun.api_getBreadth(), initialBreadth, 'Returned to initial breadth value');
          sfun.api_triggerKeypress(sfun.KEY_ARROW_RIGHT).done(function(){
            equal($('ul.flow .selectablecell.selected').data('seq'), 2, 'Right arrow selected #2 image (#1+1)' );
            QUnit.start();
            resetTest();
          });
        });
      });
    });
*/
    multi_test( 'set breadth 4, image click #1, return', function(arg) { return function() {
      resetTest(arg);
      QUnit.stop();
      sfun.api_triggerKeypress(sfun.KEY_NUMBER_4).done(function() {
        equal(sfun.api_getBreadth(), 4, 'Selected breadth' );
        // click to fullscreen, then return back
        sfun.api_triggerClick($('#seq-1').find('a')).done(function() {
          equal(sfun.api_getBreadth(), 1, 'Viewing full-screen' );
          sfun.api_triggerKeypress(sfun.KEY_RETURN).done(function() {
            equal(sfun.api_getBreadth(), 4, 'Returned to selected breadth' );
            QUnit.start();
            resetTest();
          });
        });
      });
    }; }, ['#!direction=x']);

    multi_test( 'end select last, home select first, arrow next', function(arg) { return function() {
      resetTest();
      QUnit.stop();
      sfun.api_triggerKeypress(sfun.KEY_END).done(function() {
        ok( $('ul.flow .selectablecell.selected').data('seq') == (sfun.api_getTotalEntries()-1), 'End selected last image' );
        sfun.api_triggerKeypress(sfun.KEY_HOME).done(function() {
          ok( $('ul.flow .selectablecell.selected').data('seq') == 0, 'Home selected #0 image' );
          sfun.api_triggerKeypress(sfun.KEY_ARROW_RIGHT).done(function() {
            ok( $('ul.flow .selectablecell.selected').data('seq') == 1, 'Right arrow selected #1 image' );
            QUnit.start();
            resetTest();
          });
        });
      });
    }; }, ['#!direction=x']);

    multi_test( 'end arrow next wrap-around', function(arg) { return function() {
      resetTest(arg);
      var last = sfun.api_getTotalEntries()-1;
      QUnit.stop();
      sfun.api_triggerKeypress(sfun.KEY_END).done(function() {
        equal( $('ul.flow .selectablecell.selected').data('seq'), last, 'End selected last image' );
        sfun.api_triggerKeypress(sfun.KEY_ARROW_RIGHT).done(function() {
          equal( $('ul.flow .selectablecell.selected').data('seq'), 0, 'Right arrow selected #0 image' );
          sfun.api_triggerKeypress(sfun.KEY_END).done(function() {
            equal( $('ul.flow .selectablecell.selected').data('seq'), last, 'End re-selected last image' );
            sfun.api_triggerKeypress(sfun.KEY_HOME).done(function() {
              equal( $('ul.flow .selectablecell.selected').data('seq'), 0, 'Home selected #0 image' );
              QUnit.start();        
              resetTest(arg);
            });
          });
        });
      });
    }; }, ['#!direction=x']);

    multi_test( 'rapid scroll event queuing', function(arg) { return function() {
      // clear hash because this test uses bindToContext
      resetTest(arg);
      var direction = sfun.api_getDirection();
      var evq = sfun.api_getEventQueue();
      // get initial dump count
      var initial_dump_count = evq.dump_count;
      // start test
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
          // scroll back to first page
          sfun.api_triggerKeypress(sfun.KEY_HOME).done(function() {
            $selected = $('ul.flow .selectablecell.selected');
            equal($selected.data('seq'), initialSeq, 'Selected first image (#'+initialSeq+') again' );
            // use position as startPos
            var position = $selected.offset();
            var startPos = Math.floor(direction == 'x' ? position.left : position.top);
            // check that we have 1000 pixels to scroll within
            if (limitPos - startPos < 1000) {
              ok(true, 'image set not large enough to conduct scroll test');
            } else {
              // work out where we should end up
              var iterCount = 100;
              // use integer mux so that product is integer
              // this is important for getting/setting scroll position
              var iterMux = Math.floor((limitPos - startPos) / iterCount);
              var iterStep = 1;
              var target = {
                'left': (direction == 'x' ? startPos + iterCount*iterMux : 0),
                'top': (direction == 'x' ? 0 : startPos + iterCount*iterMux)
              };
              // bind to final scroll event
              var targetKey = 'scroll:x='+target.left+'&y='+target.top;
              sfun.api_bindToContext(targetKey, true).done(function() {
                ok(true, 'target scroll event ('+targetKey+') triggered and resolved');
                QUnit.start();
              });
              var iter = { 'left': 0, 'top': 0 };
              // fire iterCount x iterMux px scroll events in sequence, one every 1 ms
              var i = 1;
              var interval = setInterval(function() {
                // prep next position
                if (direction == 'x') {
                  iter.left = startPos + (i * iterMux);
                } else {
                  iter.top = startPos + (i * iterMux);
                }
                // fire, but not using api_triggerScroll, as browser drag doesn't do that!
                $(document).scrollLeft(iter.left);
                $(document).scrollTop(iter.top);
                // increment count
                i += iterStep;
                // notice count is 1-based
                if (i > iterCount) {
                  clearInterval(interval);
                  // test scroll position
                  var endPos = (direction == 'x' ? $(document).scrollLeft() : $(document).scrollTop());
                  equal(endPos, startPos + iterCount*iterMux, 'finished in correct scroll position');
                  // @deprecated check that we dumped events
                  // notEqual(initial_dump_count, evq.dump_count, (evq.dump_count - initial_dump_count) + ' events dumped');
                }
              }, 1);
            }
            resetTest(arg);
          });
        });
      });
    }; }, ['#!direction=x']);

/*
    test( 'vis non-vis simple', function() {
      var cellcount = sfun.api_getCellMajorCount(+1) * sfun.api_getBreadth();
      window.location.hash = 'vis-non-vis-simple';
      var initialSeq = $('ul.flow .selectablecell.selected').data('seq');
      // wait for keypress event to process
      QUnit.stop();
      // scroll to first off-screen element
      sfun.api_triggerKeypress(sfun.KEY_PAGE_DOWN).done(function() {
        ok( $('ul.flow .selectablecell.selected').data('seq') != initialSeq, 'Page down selected a different image' );
        // check that first off-screen element (now on-screen) is cellcount
        ok( $('ul.flow .selectablecell.selected').data('seq') == $('#seq-'+cellcount).data('seq'), 'Page down selected the '+(cellcount+1)+'th image (seq '+cellcount+')' );
        // check that selected image is visible
        ok( $('ul.flow .selectablecell.selected').hasClass('visible'), 'Selected cell is visible');
        // check that the first image is not visible
        ok( ! $('#seq-'+initialSeq).hasClass('visible'), 'Initially selected cell is no longer visible');
        QUnit.start();        
        resetTest();
      });
    });
*/

    test( 'vis block', function() {
      resetTest();
      QUnit.stop();
      sfun.api_triggerKeypress(sfun.KEY_HOME).done(function() {
        var initialSeq = $('ul.flow .selectablecell.selected').data('seq');
        // scroll to last element
        sfun.api_triggerKeypress(sfun.KEY_END).done(function() {
          var finalSeq = sfun.api_getTotalEntries()-1;
          ok( $('ul.flow .selectablecell.selected').data('seq') == finalSeq, 'Selected last image (#'+finalSeq+')' );
          // scroll to middle
          var middleSeq = Math.floor((finalSeq - initialSeq) / 2);
          // scroll to middle image
          sfun.api_imageAdvanceTo(middleSeq).done(function() {
            ok( $('ul.flow .selectablecell.selected').data('seq') == middleSeq, 'Selected middle image (#'+middleSeq+')' );
            // check all visible images are in a single block
            initialSeq = $('ul.flow .selectablecell.visible:first').data('seq');
            finalSeq = $('ul.flow .selectablecell.visible:last').data('seq');
            for (var i = initialSeq ; i <= finalSeq ; ++i) {
              ok( $('#seq-'+i).hasClass('visible'), 'Image in selected block visible (#'+i+')' );
            }
            // check that selected image is within visible range
            ok( initialSeq <= middleSeq && middleSeq <= finalSeq, 'Selected middle image is within visible range');
            QUnit.start();
            resetTest();
          });
        });
      });
    });

    QUnit.start();
  }

  // call init function
  init();

})(jQuery, window.sfun, undefined);