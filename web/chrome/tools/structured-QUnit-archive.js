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

        multi_test('reres of last page of images', function (arg) {
            return function () {
                resetTest(arg);
                // expand div (page-left) to force a vertical scrollbar (page-right)
                var original_height = $('#qunit').height();
                $('#qunit').height(3000);
                // refresh vistable incase QUnit fixture has upset offsets
                sfun.api_getVisTableMajor().updateAll(sfun.api_getDirection(), $('ul.flow .selectablecell'));
                // run test asynchronously
                QUnit.stop();
                sfun.api_triggerKeypress(sfun.KEY_END).done(function () {
                    equal($('ul.flow .selectablecell.selected').data('seq'), (sfun.api_getTotalEntries() - 1), 'End selected last image');
                    $('ul.flow .selectablecell.visible .reresable').each(function () {
                        var imw = $(this).width(), imh = $(this).height();
                        var $ent = $(this).parents('li');
                        var lodw = $(this).data('loaded-width'), lodh = $(this).data('loaded-height');
                        // test that loaded res > image res
                        ok(imw <= lodw && imh <= lodh, 'image #' + $ent.data('seq') + ' (' + imw + 'x' + imh + ') loaded(' + lodw + 'x' + lodh + ')');
                        // test that the cell has the correct bound on it
                        var cratio = $ent.width() / $ent.height();
                        var iratio = imw / imh;
                        var correctBound = ((cratio / iratio) > 1.0 ? 'y' : 'x');
                        if (correctBound == 'x') {
                            ok($(this).hasClass('x-bound'), 'image #' + $ent.data('seq') + ' (' + imw + 'x' + imh + ') in cell (' + $ent.width() + 'x' + $ent.height() + ') should be x-bound');
                        } else {
                            ok($(this).hasClass('y-bound'), 'image #' + $ent.data('seq') + ' (' + imw + 'x' + imh + ') in cell (' + $ent.width() + 'x' + $ent.height() + ') should be y-bound');
                        }
                    });
                    QUnit.start();
                    resetTest(arg);
                    // restore QUnit to original height
                    $('#qunit').height(original_height);
                });
            };
        }, ['#!direction=x']);

        test('image click #1, return, arrow next', function () {
            window.location.hash = 'image_click_1';
            var initialBreadth = sfun.api_getBreadth();
            QUnit.stop();
            sfun.api_triggerClick($('#seq-1').find('a')).done(function () {
                equal(sfun.api_getSeq(), 1, 'Click selected #1 image');
                equal(sfun.api_getBreadth(), 1, 'Showing image full-screen');
                sfun.api_triggerKeypress(sfun.KEY_RETURN).done(function () {
                    equal(sfun.api_getBreadth(), initialBreadth, 'Returned to initial breadth value');
                    sfun.api_triggerKeypress(sfun.KEY_ARROW_RIGHT).done(function () {
                        equal($('ul.flow .selectablecell.selected').data('seq'), 2, 'Right arrow selected #2 image (#1+1)');
                        QUnit.start();
                        resetTest();
                    });
                });
            });
        });

        multi_test('set breadth 4, image click #1, return', function (arg) {
            return function () {
                resetTest(arg);
                QUnit.stop();
                sfun.api_triggerKeypress(sfun.KEY_NUMBER_4).done(function () {
                    equal(sfun.api_getBreadth(), 4, 'Selected breadth');
                    // click to fullscreen, then return back
                    sfun.api_triggerClick($('#seq-1').find('a')).done(function () {
                        equal(sfun.api_getBreadth(), 1, 'Viewing full-screen');
                        sfun.api_triggerKeypress(sfun.KEY_RETURN).done(function () {
                            equal(sfun.api_getBreadth(), 4, 'Returned to selected breadth');
                            QUnit.start();
                            resetTest();
                        });
                    });
                });
            };
        }, ['#!direction=x']);

        multi_test('end select last, home select first, arrow next', function (arg) {
            return function () {
                resetTest();
                QUnit.stop();
                sfun.api_triggerKeypress(sfun.KEY_END).done(function () {
                    ok($('ul.flow .selectablecell.selected').data('seq') == (sfun.api_getTotalEntries() - 1), 'End selected last image');
                    sfun.api_triggerKeypress(sfun.KEY_HOME).done(function () {
                        ok($('ul.flow .selectablecell.selected').data('seq') == 0, 'Home selected #0 image');
                        sfun.api_triggerKeypress(sfun.KEY_ARROW_RIGHT).done(function () {
                            ok($('ul.flow .selectablecell.selected').data('seq') == 1, 'Right arrow selected #1 image');
                            QUnit.start();
                            resetTest();
                        });
                    });
                });
            };
        }, ['#!direction=x']);

        multi_test('end arrow next wrap-around', function (arg) {
            return function () {
                resetTest(arg);
                var last = sfun.api_getTotalEntries() - 1;
                QUnit.stop();
                sfun.api_triggerKeypress(sfun.KEY_END).done(function () {
                    equal($('ul.flow .selectablecell.selected').data('seq'), last, 'End selected last image');
                    sfun.api_triggerKeypress(sfun.KEY_ARROW_RIGHT).done(function () {
                        equal($('ul.flow .selectablecell.selected').data('seq'), 0, 'Right arrow selected #0 image');
                        sfun.api_triggerKeypress(sfun.KEY_END).done(function () {
                            equal($('ul.flow .selectablecell.selected').data('seq'), last, 'End re-selected last image');
                            sfun.api_triggerKeypress(sfun.KEY_HOME).done(function () {
                                equal($('ul.flow .selectablecell.selected').data('seq'), 0, 'Home selected #0 image');
                                QUnit.start();
                                resetTest(arg);
                            });
                        });
                    });
                });
            };
        }, ['#!direction=x']);

        test('vis non-vis simple', function () {
            var cellcount = sfun.api_getCellMajorCount(+1) * sfun.api_getBreadth();
            window.location.hash = 'vis-non-vis-simple';
            var initialSeq = $('ul.flow .selectablecell.selected').data('seq');
            // wait for keypress event to process
            QUnit.stop();
            // scroll to first off-screen element
            sfun.api_triggerKeypress(sfun.KEY_PAGE_DOWN).done(function () {
                ok($('ul.flow .selectablecell.selected').data('seq') != initialSeq, 'Page down selected a different image');
                // check that first off-screen element (now on-screen) is cellcount
                ok($('ul.flow .selectablecell.selected').data('seq') == $('#seq-' + cellcount).data('seq'), 'Page down selected the ' + (cellcount + 1) + 'th image (seq ' + cellcount + ')');
                // check that selected image is visible
                ok($('ul.flow .selectablecell.selected').hasClass('visible'), 'Selected cell is visible');
                // check that the first image is not visible
                ok(!$('#seq-' + initialSeq).hasClass('visible'), 'Initially selected cell is no longer visible');
                QUnit.start();
                resetTest();
            });
        });

        QUnit.start();
    }

    // call init function
    init();

})(jQuery, window.sfun, undefined);