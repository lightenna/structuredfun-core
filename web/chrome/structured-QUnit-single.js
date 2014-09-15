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

    test( 'reres of first page of images', function() {
      QUnit.stop();
      sfun.api_triggerKeypress(sfun.KEY_HOME).done(function() {
        equal( $('ul.flow .selectablecell.selected').data('seq'), 0, 'Home selected #0 image' );
        $('ul.flow .selectablecell.visible .reresable').each(function() {
          var imw = $(this).width(), imh = $(this).height();
          var $ent = $(this).parents('li');
          var lodw = $(this).data('loaded-width'), lodh = $(this).data('loaded-height');
          ok( imw <= lodw && imh <= lodh, 'image #'+$ent.data('seq')+' ('+imw+'x'+imh+') loaded('+lodw+'x'+lodh+')');
        });
        endTest();
        QUnit.start();
      });
    });

    test( 'reres of last page of images', function() {
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