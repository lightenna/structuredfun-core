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
                'title': 'Test'
            },
            'template': getTemplate()
        };
        // once script is loaded and executes, push header button async
        sfun.push('headerAddButton', obj);
    };

    var getTemplate = function () {
        var str = '<li class="debug-only"><a href="#" id="header-test-single">{{ title }}</a></li>';
        return str;
    }

    var bindToTemplate = function (obj) {
        $('#header-test-single').click(getClickHandler());
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

        test('vis non-vis simple', function () {
            resetTest();
            var cellcount = sfun.api_getCellMajorCount(+1) * sfun.api_getBreadth();
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