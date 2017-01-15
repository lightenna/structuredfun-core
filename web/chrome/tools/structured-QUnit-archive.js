/**
 * StructuredFun javascript
 * QUnit test harness
 */
(function ($, sfun, undefined) {

    // ---------
    // CONSTANTS
    // ---------

    // ---------
    // FUNCTIONS
    // ---------

    var init = function () {
        var obj = {
            'context': this,
            'receiverRegistered': bindToTemplate,
            'view': {
                'title': 'Test all'
            },
            'template': getTemplate()
        };
        // ARCHIVE - so don't actually process
        // once script is loaded and executes, push header button async
        // sfun.push('headerAddButton', obj);
    };

    var getTemplate = function () {
        var str = '<li class="debug-only"><a href="#" id="header-test-all">{{ title }}</a></li>';
        return str;
    }

    var bindToTemplate = function (obj) {
        $('#header-test-all').click(getClickHandler());
    }

    var getClickHandler = function () {
        return (function (event) {
            // write QUnit harness into page
            var qs = '<div id="qunit"></div><div id="qunit-fixture"></div>';
            $('body').prepend(qs);
            // pull in QUnit library (triggers scroll:x=0&y=0)
            $.getScript("/chrome/vendor/qunit/qunit-1.14.0.min.js").done(function () {
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

    var multi_test = function (name, func, bangs) {
        test(name + ' variant 0', func(function () {
        }));
        for (var i = 0; i < bangs.length; ++i) {
            test(name + ' variant ' + (i + 1), func(bangs[i]));
        }
    }

    // -----
    // TESTS
    // -----

    /**
     * execute tests
     */
    var tests = function () {
        QUnit.init();
        var resetTestMarker = '#!';
        var resetTest = function () {
            window.location.hash = resetTestMarker;
        };

        /**
         * maintain a list of functions
         */
        var dupTestList = dupTestList || [];
        var parameteriseTest = function (func) {
            // store function in list
            dupTestList[dupTestList.length] = func;
            // return pointer (for first call)
            return func;
        };

        /**
         * call stored tests
         */
        var recallTests = function (marker) {
            // update the marker, used to reset hashbang after each test
            resetTestMarker = marker;
            for (var i = 0; i < dupTestList.length; ++i) {
                // stack test in QUnit for execution
                test('recalled test ' + i, dupTestList[i]);
            }
        }

        /*
         * top and tail each test with a hash clear (needs to be different to clear it)
         * 1. to reset the environment because tests can run in any order
         * 2. to drop us back at the top/left of the page after all tests finish
         */



        QUnit.start();
    }

    // call init function
    init();

})(jQuery, window.sfun, undefined);